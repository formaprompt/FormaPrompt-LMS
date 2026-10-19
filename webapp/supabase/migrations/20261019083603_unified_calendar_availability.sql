-- Server attestations follow a fresh two-calendar check in the trusted Edge.
-- This does not make Google Calendar and PostgreSQL a distributed transaction.
BEGIN;
CREATE TABLE private.unified_calendar_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL,
  request_id uuid,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 seconds',
  executed_at timestamptz,
  execution_txid bigint,
  result jsonb
);
ALTER TABLE private.unified_calendar_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.unified_calendar_actions FROM PUBLIC, anon, authenticated, service_role;
CREATE UNIQUE INDEX unified_calendar_actions_request_uidx
ON private.unified_calendar_actions(coalesce(actor_id,'00000000-0000-0000-0000-000000000000'::uuid),action,request_id)
WHERE request_id IS NOT NULL;

CREATE FUNCTION private.require_unified_calendar_action() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.unified_calendar_actions a
    WHERE a.id::text = current_setting('formaprompt.calendar_action', true)
      AND a.execution_txid = txid_current() AND a.executed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Une vérification des agendas est requise.' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.require_unified_calendar_action() FROM PUBLIC,anon,authenticated,service_role;
-- Existing authenticated business RPCs may call this guard; the private table
-- cannot be forged through set_config/JWT claims, even with its UUID known.
GRANT EXECUTE ON FUNCTION private.require_unified_calendar_action() TO authenticated,service_role;

CREATE FUNCTION private.unified_calendar_snapshot(p_actor_id uuid,p_action text,p_payload jsonb,p_lock boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_slot_ids uuid[];
  v_cohort_id uuid;
  v_booking public.calendar_bookings%ROWTYPE;
  v_diagnostic public.diagnostic_ia_bookings%ROWTYPE;
  v_rows jsonb;
  v_intervals jsonb;
  v_events jsonb := '[]'::jsonb;
  v_state jsonb := '{}'::jsonb;
  v_date date;
  v_slot text;
  v_dates date[];
  v_type text;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Action invalide.' USING ERRCODE='22023';
  END IF;
  IF p_action NOT IN ('create_calendar_booking','confirm_calendar_booking','create_course_booking',
    'save_course_cohort','publish_course_cohort','confirm_course_cohort','join_course_cohort',
    'enroll_creativity_cohort','claim_diagnostic_booking','claim_diagnostic_reschedule','approve_course_booking') THEN
    RAISE EXCEPTION 'Action inconnue.' USING ERRCODE='22023';
  END IF;
  IF p_action <> 'create_calendar_booking' AND p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE='42501';
  END IF;
  IF p_action IN ('save_course_cohort','publish_course_cohort','confirm_course_cohort','enroll_creativity_cohort','claim_diagnostic_reschedule')
    AND NOT coalesce(private.is_strict_admin(),false) THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE='42501';
  END IF;
  IF p_action = 'approve_course_booking' THEN
    IF NOT coalesce(private.is_admin(),false) THEN RAISE EXCEPTION 'Accès personnel requis.' USING ERRCODE='42501'; END IF;
    IF p_lock THEN PERFORM 1 FROM public.course_booking_requests WHERE id=(p_payload->>'p_booking_request_id')::uuid FOR UPDATE; END IF;
    SELECT jsonb_build_object('id',id,'status',status,'distance_status',distance_status,'schedule_format',schedule_format)
    INTO v_state FROM public.course_booking_requests WHERE id=(p_payload->>'p_booking_request_id')::uuid AND delivery_mode='in_person' AND status='pending_distance';
    IF v_state IS NULL THEN RAISE EXCEPTION 'Demande présentielle non disponible.' USING ERRCODE='22023'; END IF;
    IF p_lock THEN PERFORM 1 FROM public.course_session_bookings WHERE booking_request_id=(p_payload->>'p_booking_request_id')::uuid ORDER BY id FOR SHARE; END IF;
    SELECT jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at,'status',status) ORDER BY starts_at,id),
      jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at) ORDER BY starts_at,id)
    INTO v_rows,v_intervals FROM public.course_session_bookings WHERE booking_request_id=(p_payload->>'p_booking_request_id')::uuid;
    IF coalesce(jsonb_array_length(v_intervals),0)=0 THEN RAISE EXCEPTION 'Séances requises.' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('intervals',v_intervals,'own_events',v_events,'rows',v_rows,'state',v_state);
  ELSIF p_action = 'create_calendar_booking' THEN
    v_slot := p_payload->'booking'->>'slot';
    v_type := coalesce(p_payload->'booking'->>'type','option');
    IF jsonb_typeof(p_payload->'booking') IS DISTINCT FROM 'object'
      OR v_slot NOT IN ('Matin','Après-midi','Journée')
      OR v_type NOT IN ('option','confirmé')
      OR (v_type <> 'option' AND NOT coalesce(private.is_admin(),false))
      OR coalesce(char_length(btrim(p_payload->'booking'->>'of_name')),0) NOT BETWEEN 2 AND 150
      OR char_length(coalesce(p_payload->'booking'->>'comments','')) > 2000 THEN
      RAISE EXCEPTION 'Réservation invalide.' USING ERRCODE='22023';
    END IF;
    v_date := (p_payload->'booking'->>'date')::date;
    IF v_date IS NULL OR v_date NOT BETWEEN current_date AND current_date+730 THEN
      RAISE EXCEPTION 'Date invalide.' USING ERRCODE='22023';
    END IF;
    v_state := jsonb_build_object('date',v_date,'slot',v_slot);
  ELSIF p_action = 'confirm_calendar_booking' THEN
    IF NOT coalesce(private.is_admin(),false) THEN RAISE EXCEPTION 'Accès personnel requis.' USING ERRCODE='42501'; END IF;
    IF p_lock THEN PERFORM 1 FROM public.calendar_bookings WHERE id=(p_payload->>'booking_id')::uuid FOR UPDATE; END IF;
    SELECT * INTO STRICT v_booking FROM public.calendar_bookings WHERE id=(p_payload->>'booking_id')::uuid;
    v_date := v_booking.date; v_slot := v_booking.slot;
    v_state := jsonb_build_object('id',v_booking.id,'date',v_date,'slot',v_slot,'type',v_booking.type);
  ELSIF p_action IN ('create_course_booking','claim_diagnostic_booking','claim_diagnostic_reschedule','save_course_cohort') THEN
    IF p_action = 'save_course_cohort' THEN
      v_cohort_id := (p_payload->>'p_cohort_id')::uuid;
      SELECT array_agg(id::uuid ORDER BY id::uuid) INTO v_slot_ids
      FROM jsonb_array_elements(p_payload->'p_sessions') AS s(value)
      CROSS JOIN LATERAL jsonb_array_elements_text(s.value->'slot_ids') AS slots(id);
    ELSE
      SELECT array_agg(id::uuid ORDER BY id::uuid) INTO v_slot_ids FROM jsonb_array_elements_text(p_payload->'p_slot_ids') AS ids(id);
    END IF;
    IF p_action = 'claim_diagnostic_booking' THEN
      IF (p_payload->>'p_user_id')::uuid IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Identité incohérente.' USING ERRCODE='42501';
      END IF;
      -- The business RPC still validates the paid order and ownership under lock.
      IF NOT EXISTS (SELECT 1 FROM public.diagnostic_ia_orders WHERE id=(p_payload->>'p_order_id')::uuid
        AND user_id=p_actor_id AND status='paid' AND paid_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Paiement confirmé requis.' USING ERRCODE='42501';
      END IF;
    END IF;
    IF p_action = 'claim_diagnostic_reschedule' THEN
      IF p_lock THEN PERFORM 1 FROM public.diagnostic_ia_bookings WHERE id=(p_payload->>'p_booking_id')::uuid FOR UPDATE; END IF;
      SELECT * INTO STRICT v_diagnostic FROM public.diagnostic_ia_bookings WHERE id=(p_payload->>'p_booking_id')::uuid;
      v_state := jsonb_build_object('id',v_diagnostic.id,'status',v_diagnostic.status,'starts_at',v_diagnostic.starts_at,'ends_at',v_diagnostic.ends_at);
      IF v_diagnostic.google_event_id IS NOT NULL THEN
        v_events := jsonb_build_array(jsonb_build_object('calendar_id',v_diagnostic.google_calendar_id,'event_id',v_diagnostic.google_event_id,
          'starts_at',v_diagnostic.starts_at,'ends_at',v_diagnostic.ends_at));
      END IF;
    END IF;
  ELSE
    v_cohort_id := (p_payload->>'p_cohort_id')::uuid;
  END IF;
  IF v_date IS NOT NULL THEN
    v_intervals := jsonb_build_array(jsonb_build_object(
      'starts_at',timezone('Europe/Paris',v_date::timestamp + CASE WHEN v_slot='Après-midi' THEN interval '13 hours' ELSE interval '0 hours' END),
      'ends_at',timezone('Europe/Paris',v_date::timestamp + CASE WHEN v_slot='Matin' THEN interval '13 hours' ELSE interval '1 day' END)));
  ELSE
    IF v_cohort_id IS NOT NULL THEN
      IF p_lock THEN PERFORM 1 FROM public.course_cohorts WHERE id=v_cohort_id FOR UPDATE; END IF;
      SELECT jsonb_build_object('id',id,'status',status,'course_id',course_id,'capacity',capacity,'minimum_participants',minimum_participants)
      INTO v_state FROM public.course_cohorts WHERE id=v_cohort_id;
      IF v_state IS NULL THEN RAISE EXCEPTION 'Groupe introuvable.' USING ERRCODE='22023'; END IF;
      IF p_action <> 'save_course_cohort' THEN
        IF p_lock THEN PERFORM 1 FROM public.course_cohort_sessions WHERE cohort_id=v_cohort_id ORDER BY id FOR SHARE; END IF;
        SELECT jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at) ORDER BY starts_at,id),
          jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at) ORDER BY starts_at,id)
        INTO v_rows,v_intervals FROM public.course_cohort_sessions WHERE cohort_id=v_cohort_id;
      END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object('calendar_id',google_calendar_id,'event_id',google_event_id,'starts_at',starts_at,'ends_at',ends_at)
        ORDER BY starts_at,id),'[]'::jsonb) INTO v_events
      FROM public.course_cohort_sessions WHERE cohort_id=v_cohort_id AND google_event_id IS NOT NULL;
    END IF;
    IF v_slot_ids IS NOT NULL THEN
      IF cardinality(v_slot_ids) NOT BETWEEN 1 AND 200 OR
        (SELECT count(DISTINCT id) FROM unnest(v_slot_ids) AS ids(id)) <> cardinality(v_slot_ids) THEN
        RAISE EXCEPTION 'Créneaux invalides.' USING ERRCODE='22023';
      END IF;
      IF p_lock THEN PERFORM 1 FROM public.training_availability_slots WHERE id=ANY(v_slot_ids) ORDER BY id FOR UPDATE; END IF;
      SELECT jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at,'is_reserved',is_reserved,'is_active',is_active,'delivery_modes',delivery_modes) ORDER BY id),
        jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at) ORDER BY starts_at,id)
      INTO v_rows,v_intervals FROM public.training_availability_slots WHERE id=ANY(v_slot_ids);
      IF jsonb_array_length(v_rows) <> cardinality(v_slot_ids) THEN RAISE EXCEPTION 'Créneaux introuvables.' USING ERRCODE='22023'; END IF;
    END IF;
  END IF;
  IF coalesce(jsonb_array_length(v_intervals),0)=0 THEN RAISE EXCEPTION 'Séances requises.' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('intervals',v_intervals,'own_events',v_events,'rows',v_rows,'state',v_state);
END;
$$;
REVOKE ALL ON FUNCTION private.unified_calendar_snapshot(uuid,text,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.prepare_unified_calendar_action(p_actor_id uuid,p_action text,p_payload jsonb,p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_snapshot jsonb; v_action private.unified_calendar_actions%ROWTYPE;
  v_sub text := current_setting('request.jwt.claim.sub',true);
  v_claims text := current_setting('request.jwt.claims',true);
  v_request_id uuid := coalesce(p_request_id,(p_payload->>'request_id')::uuid);
BEGIN
  -- Only the trusted Edge service can issue an attestation.
  PERFORM pg_advisory_xact_lock(hashtextextended('formaprompt-unified-actions',0));
  SELECT * INTO v_action FROM private.unified_calendar_actions a
  WHERE a.actor_id IS NOT DISTINCT FROM p_actor_id AND a.action=p_action
    AND ((v_request_id IS NOT NULL AND a.request_id=v_request_id)
      OR (v_request_id IS NULL AND a.request_id IS NULL AND a.payload=p_payload AND a.created_at>clock_timestamp()-interval '30 seconds'))
  ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_action.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Identifiant de demande déjà utilisé.' USING ERRCODE='22023'; END IF;
    IF v_action.executed_at IS NOT NULL AND p_action NOT IN ('claim_diagnostic_booking','claim_diagnostic_reschedule') THEN
      RETURN jsonb_build_object('action_id',v_action.id,'result',v_action.result,'already_executed',true);
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_actor_id::text,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_id,'role',CASE WHEN p_actor_id IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
  v_snapshot := private.unified_calendar_snapshot(p_actor_id,p_action,p_payload,false);
  PERFORM set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(v_claims,''),true);
  IF v_action.id IS NULL THEN
    INSERT INTO private.unified_calendar_actions(actor_id,action,payload,request_id,snapshot)
    VALUES(p_actor_id,p_action,p_payload,v_request_id,v_snapshot) RETURNING * INTO v_action;
  ELSE
    UPDATE private.unified_calendar_actions SET snapshot=v_snapshot,proof=gen_random_uuid(),expires_at=clock_timestamp()+interval '30 seconds',executed_at=NULL,execution_txid=NULL,result=NULL
    WHERE id=v_action.id RETURNING * INTO v_action;
  END IF;
  RETURN jsonb_build_object('action_id',v_action.id,'proof',v_action.proof,'intervals',v_snapshot->'intervals','own_events',v_snapshot->'own_events');
END;
$$;

CREATE FUNCTION public.execute_unified_calendar_action(p_action_id uuid,p_proof uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a private.unified_calendar_actions%ROWTYPE; p jsonb; v_result jsonb;
  v_sub text := current_setting('request.jwt.claim.sub',true);
  v_claims text := current_setting('request.jwt.claims',true);
  v_context text := current_setting('formaprompt.calendar_action',true);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('formaprompt-unified-actions',0));
  SELECT * INTO a FROM private.unified_calendar_actions WHERE id=p_action_id AND proof=p_proof FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preuve invalide.' USING ERRCODE='42501'; END IF;
  IF a.executed_at IS NOT NULL THEN RETURN a.result; END IF;
  IF a.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Vérification expirée.' USING ERRCODE='40001'; END IF;
  PERFORM set_config('request.jwt.claim.sub',coalesce(a.actor_id::text,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a.actor_id,'role',CASE WHEN a.actor_id IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
  IF private.unified_calendar_snapshot(a.actor_id,a.action,a.payload,true) IS DISTINCT FROM a.snapshot THEN
    RAISE EXCEPTION 'Les disponibilités ont changé.' USING ERRCODE='40001';
  END IF;
  UPDATE private.unified_calendar_actions SET executed_at=clock_timestamp(),execution_txid=txid_current() WHERE id=a.id;
  PERFORM set_config('formaprompt.calendar_action',a.id::text,true);
  p := a.payload;
  CASE a.action
    WHEN 'approve_course_booking' THEN
      UPDATE public.course_booking_requests SET distance_status='approved',status=CASE WHEN schedule_format IN ('two_2h','two_3h30','two_5h') THEN 'awaiting_travel_payment' ELSE 'confirmed' END
      WHERE id=(p->>'p_booking_request_id')::uuid AND status='pending_distance'
      RETURNING jsonb_build_object('booking',to_jsonb(course_booking_requests)) INTO v_result;
    WHEN 'create_calendar_booking' THEN
      INSERT INTO public.calendar_bookings(date,slot,type,of_name,comments)
      VALUES ((p->'booking'->>'date')::date,p->'booking'->>'slot',coalesce(p->'booking'->>'type','option'),btrim(p->'booking'->>'of_name'),coalesce(p->'booking'->>'comments',''))
      RETURNING jsonb_build_object('bookings',jsonb_build_array(to_jsonb(calendar_bookings))) INTO v_result;
    WHEN 'confirm_calendar_booking' THEN
      UPDATE public.calendar_bookings SET type='confirmé' WHERE id=(p->>'booking_id')::uuid
      RETURNING jsonb_build_object('booking',to_jsonb(calendar_bookings)) INTO v_result;
    WHEN 'create_course_booking' THEN
      IF p->>'p_course_id' IN ('formation-ia','formation-ia-act','formation-prompt-level-1') THEN
        v_result := to_jsonb(public.create_course_booking_request(p->>'p_course_id',p->>'p_delivery_mode',p->>'p_schedule_format',ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p->'p_slot_ids')),p->>'p_city',p->>'p_postal_code'));
      ELSE
        v_result := to_jsonb(public.create_bureautique_booking_request(p->>'p_course_id',p->>'p_delivery_mode',p->>'p_schedule_format',ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p->'p_slot_ids')),p->>'p_city',p->>'p_postal_code'));
      END IF;
    WHEN 'save_course_cohort' THEN v_result:=to_jsonb(public.admin_save_course_cohort((p->>'p_cohort_id')::uuid,p->>'p_course_id',p->>'p_delivery_mode',p->>'p_schedule_format',(p->>'p_capacity')::integer,(p->>'p_minimum_participants')::integer,p->'p_sessions'));
    WHEN 'publish_course_cohort' THEN v_result:=to_jsonb(public.admin_publish_course_cohort((p->>'p_cohort_id')::uuid));
    WHEN 'confirm_course_cohort' THEN v_result:=to_jsonb(public.admin_confirm_course_cohort((p->>'p_cohort_id')::uuid));
    WHEN 'join_course_cohort' THEN v_result:=to_jsonb(public.join_course_cohort((p->>'p_cohort_id')::uuid));
    WHEN 'enroll_creativity_cohort' THEN v_result:=to_jsonb(public.admin_enroll_creativity_cohort((p->>'p_cohort_id')::uuid,(p->>'p_user_id')::uuid));
    WHEN 'claim_diagnostic_booking' THEN SELECT to_jsonb(r) INTO v_result FROM public.claim_diagnostic_ia_booking((p->>'p_order_id')::uuid,(p->>'p_user_id')::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p->'p_slot_ids'))) r;
    WHEN 'claim_diagnostic_reschedule' THEN SELECT to_jsonb(r) INTO v_result FROM public.admin_claim_diagnostic_ia_booking_reschedule((p->>'p_booking_id')::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p->'p_slot_ids'))) r;
  END CASE;
  UPDATE private.unified_calendar_actions SET result=v_result WHERE id=a.id;
  PERFORM set_config('formaprompt.calendar_action',coalesce(v_context,''),true);
  PERFORM set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(v_claims,''),true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_unified_calendar_action(uuid,text,jsonb,uuid),public.execute_unified_calendar_action(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_unified_calendar_action(uuid,text,jsonb,uuid),public.execute_unified_calendar_action(uuid,uuid) TO service_role;

CREATE FUNCTION private.guard_unified_calendar_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME='calendar_bookings' THEN
    PERFORM private.require_unified_calendar_action();
  ELSIF NEW.is_reserved THEN
    PERFORM private.require_unified_calendar_action();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_unified_calendar_write() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER calendar_bookings_require_calendar_check BEFORE INSERT OR UPDATE OF date,slot,type ON public.calendar_bookings
FOR EACH ROW EXECUTE FUNCTION private.guard_unified_calendar_write();
CREATE TRIGGER training_availability_require_calendar_check BEFORE INSERT OR UPDATE OF starts_at,ends_at,is_reserved ON public.training_availability_slots
FOR EACH ROW EXECUTE FUNCTION private.guard_unified_calendar_write();

CREATE FUNCTION private.guard_unified_course_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Initial allocation is guarded by the original RPC and availability trigger.
  -- A paid travel webhook only completes an already approved, held allocation;
  -- it must never roll back the financial proof because Google is unavailable.
  IF (NEW.distance_status='approved' AND OLD.distance_status IS DISTINCT FROM NEW.distance_status)
    OR (NEW.status IN ('confirmed','awaiting_travel_payment') AND OLD.status IS DISTINCT FROM NEW.status
      AND NOT (OLD.status='awaiting_travel_payment' AND OLD.distance_status='approved'
        AND OLD.travel_fee_status='pending' AND NEW.travel_fee_status='paid'
        AND NEW.status='confirmed' AND current_setting('role',true)='service_role')) THEN
    PERFORM private.require_unified_calendar_action();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_unified_course_approval() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER course_booking_requests_require_calendar_approval BEFORE UPDATE OF status,distance_status ON public.course_booking_requests
FOR EACH ROW EXECUTE FUNCTION private.guard_unified_course_approval();

CREATE FUNCTION private.guard_unified_session_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.availability_slot_id IS DISTINCT FROM OLD.availability_slot_id
    OR NEW.booking_request_id IS DISTINCT FROM OLD.booking_request_id THEN
    PERFORM private.require_unified_calendar_action();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_unified_session_move() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER course_session_bookings_require_calendar_move BEFORE UPDATE OF starts_at,ends_at,availability_slot_id,booking_request_id ON public.course_session_bookings
FOR EACH ROW EXECUTE FUNCTION private.guard_unified_session_move();

-- Preserve the complete current authorization/business implementations. This
-- inserts only the calendar guard, including private entry points still granted
-- to authenticated users, instead of replacing them with simplified wrappers.
DO $$
DECLARE f record; v_definition text;
BEGIN
  FOR f IN SELECT p.oid,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang WHERE l.lanname='plpgsql'
    AND ((n.nspname='private' AND p.proname IN ('create_course_booking_request','create_bureautique_booking_request'))
      OR (n.nspname='public' AND p.proname IN ('admin_save_course_cohort','admin_publish_course_cohort','admin_confirm_course_cohort','join_course_cohort','admin_enroll_creativity_cohort','claim_diagnostic_ia_booking','admin_claim_diagnostic_ia_booking_reschedule')))
  LOOP
    v_definition:=pg_get_functiondef(f.oid);
    IF position('private.require_unified_calendar_action()' IN v_definition)=0 THEN
      v_definition:=regexp_replace(v_definition,E'\\mBEGIN\\M','BEGIN' || chr(10) || '  PERFORM private.require_unified_calendar_action();');
      EXECUTE v_definition;
    END IF;
  END LOOP;
END;
$$;
-- Retry after a definite pre-event cancellation must not invalidate a paid
-- purchase. Unknown Google outcomes are never cancelled by the Edge; they keep
-- their pending claim for deterministic event recovery.
DO $retry$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.claim_diagnostic_ia_booking(uuid,uuid,uuid[])'::regprocedure) INTO v_definition;
  v_definition:=replace(v_definition,
    $$IF v_booking.status <> 'cancelled' OR v_booking.google_sync_error_code <> 'claim_expired' THEN$$,
    $$IF v_booking.status <> 'cancelled' OR v_booking.google_event_id IS NOT NULL OR v_booking.google_sync_error_code NOT IN ('claim_expired','slot_conflict','google_conflict','calendar_unavailable','google_busy','google_unavailable','google_freebusy_failed') THEN$$);
  EXECUTE v_definition;
END;
$retry$;
COMMIT;

