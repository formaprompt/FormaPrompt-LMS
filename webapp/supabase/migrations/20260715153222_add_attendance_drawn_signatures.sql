-- Ajoute une signature manuscrite électronique liée au compte authentifié,
-- à l'horodatage serveur et à une empreinte SHA-256 du document signé.

ALTER TABLE public.course_session_attendance
  ADD COLUMN learner_signature_png bytea,
  ADD COLUMN learner_signature_sha256 text,
  ADD COLUMN learner_signed_payload_sha256 text,
  ADD COLUMN learner_signature_method text,
  ADD COLUMN trainer_signature_png bytea,
  ADD COLUMN trainer_signature_sha256 text,
  ADD COLUMN trainer_signed_payload_sha256 text,
  ADD COLUMN trainer_signature_method text;

ALTER TABLE public.course_session_attendance
  ADD CONSTRAINT course_attendance_learner_signature_consistency CHECK (
    (learner_signature_png IS NULL
      AND learner_signature_sha256 IS NULL
      AND learner_signed_payload_sha256 IS NULL
      AND learner_signature_method IS NULL)
    OR
    (learner_signature_png IS NOT NULL
      AND learner_signature_sha256 ~ '^[0-9a-f]{64}$'
      AND learner_signed_payload_sha256 ~ '^[0-9a-f]{64}$'
      AND learner_signature_method = 'drawn-on-screen-v1')
  ),
  ADD CONSTRAINT course_attendance_trainer_signature_consistency CHECK (
    (trainer_signature_png IS NULL
      AND trainer_signature_sha256 IS NULL
      AND trainer_signed_payload_sha256 IS NULL
      AND trainer_signature_method IS NULL)
    OR
    (trainer_signature_png IS NOT NULL
      AND trainer_signature_sha256 ~ '^[0-9a-f]{64}$'
      AND trainer_signed_payload_sha256 ~ '^[0-9a-f]{64}$'
      AND trainer_signature_method = 'drawn-on-screen-v1')
  ),
  ADD CONSTRAINT course_attendance_learner_signature_size CHECK (
    learner_signature_png IS NULL OR octet_length(learner_signature_png) BETWEEN 100 AND 250000
  ),
  ADD CONSTRAINT course_attendance_trainer_signature_size CHECK (
    trainer_signature_png IS NULL OR octet_length(trainer_signature_png) BETWEEN 100 AND 250000
  );

CREATE OR REPLACE FUNCTION private.decode_attendance_signature(p_signature_base64 text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_signature bytea;
BEGIN
  IF p_signature_base64 IS NULL OR length(p_signature_base64) < 100
    OR length(p_signature_base64) > 340000 THEN
    RAISE EXCEPTION 'Dessinez une signature valide avant de continuer.';
  END IF;

  BEGIN
    v_signature := pg_catalog.decode(p_signature_base64, 'base64');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Le format de la signature est invalide.';
  END;

  IF octet_length(v_signature) NOT BETWEEN 100 AND 250000
    OR pg_catalog.substring(v_signature, 1, 8)
      <> pg_catalog.decode('iVBORw0KGgo=', 'base64') THEN
    RAISE EXCEPTION 'La signature doit être une image PNG valide de moins de 250 Ko.';
  END IF;

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION private.decode_attendance_signature(text)
FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz);
DROP FUNCTION private.confirm_course_attendance(uuid, timestamptz, timestamptz);

CREATE FUNCTION private.confirm_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz,
  p_signature_base64 text
)
RETURNS public.course_session_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_session record;
  v_attendance public.course_session_attendance%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_automatic_window boolean;
  v_signature bytea;
  v_signature_hash text;
  v_payload_hash text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM private.validate_attendance_session(
    p_booking_request_id, p_session_starts_at, p_session_ends_at
  );

  IF v_session.validated_user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Vous ne pouvez signer que votre propre feuille de présence.' USING ERRCODE = '42501';
  END IF;

  IF v_session.validated_booking_status NOT IN ('confirmed', 'completed') THEN
    RAISE EXCEPTION 'La réservation doit être confirmée avant la signature.';
  END IF;

  SELECT * INTO v_attendance
  FROM public.course_session_attendance
  WHERE booking_request_id = p_booking_request_id
    AND session_starts_at = p_session_starts_at
    AND session_ends_at = p_session_ends_at
  FOR UPDATE;

  IF v_attendance.learner_signature_png IS NOT NULL THEN
    RETURN v_attendance;
  END IF;

  v_automatic_window :=
    v_now >= p_session_starts_at - interval '2 hours'
    AND v_now <= p_session_ends_at + interval '2 hours'
    AND (v_now AT TIME ZONE 'Europe/Paris')::date
      = (p_session_starts_at AT TIME ZONE 'Europe/Paris')::date;

  IF NOT v_automatic_window AND NOT (
    v_attendance.check_in_opened_at IS NOT NULL
    AND v_attendance.check_in_closed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'La signature ouvrira le jour de la séance ou lorsque le formateur l’ouvrira.';
  END IF;

  v_signature := private.decode_attendance_signature(p_signature_base64);
  v_signature_hash := pg_catalog.encode(extensions.digest(v_signature, 'sha256'), 'hex');
  v_payload_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(
      p_booking_request_id::text || '|' || v_actor_id::text || '|'
      || p_session_starts_at::text || '|' || p_session_ends_at::text || '|'
      || v_now::text || '|' || v_signature_hash,
      'UTF8'
    ),
    'sha256'
  ), 'hex');

  INSERT INTO public.course_session_attendance (
    booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode,
    learner_confirmed_at, learner_confirmation_version,
    learner_signature_png, learner_signature_sha256,
    learner_signed_payload_sha256, learner_signature_method
  ) VALUES (
    p_booking_request_id, v_actor_id, p_session_starts_at, p_session_ends_at,
    v_session.validated_delivery_mode, v_now, 'drawn-signature-v2-2026-07-15',
    v_signature, v_signature_hash, v_payload_hash, 'drawn-on-screen-v1'
  )
  ON CONFLICT (booking_request_id, session_starts_at, session_ends_at)
  DO UPDATE SET
    learner_confirmed_at = EXCLUDED.learner_confirmed_at,
    learner_confirmation_version = EXCLUDED.learner_confirmation_version,
    learner_signature_png = EXCLUDED.learner_signature_png,
    learner_signature_sha256 = EXCLUDED.learner_signature_sha256,
    learner_signed_payload_sha256 = EXCLUDED.learner_signed_payload_sha256,
    learner_signature_method = EXCLUDED.learner_signature_method
  WHERE public.course_session_attendance.learner_signature_png IS NULL
  RETURNING * INTO v_attendance;

  INSERT INTO public.course_attendance_audit_log (
    attendance_id, booking_request_id, actor_id, event_type, event_details
  ) VALUES (
    v_attendance.id, p_booking_request_id, v_actor_id, 'learner_confirmed',
    jsonb_build_object(
      'confirmation_version', v_attendance.learner_confirmation_version,
      'signature_method', v_attendance.learner_signature_method,
      'signature_sha256', v_attendance.learner_signature_sha256,
      'signed_payload_sha256', v_attendance.learner_signed_payload_sha256,
      'session_starts_at', p_session_starts_at,
      'session_ends_at', p_session_ends_at
    )
  );

  RETURN v_attendance;
END;
$$;

REVOKE ALL ON FUNCTION private.confirm_course_attendance(uuid, timestamptz, timestamptz, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.confirm_course_attendance(uuid, timestamptz, timestamptz, text)
TO authenticated;

CREATE FUNCTION public.confirm_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz,
  p_signature_base64 text
)
RETURNS public.course_session_attendance
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.confirm_course_attendance(
    p_booking_request_id, p_session_starts_at, p_session_ends_at, p_signature_base64
  );
$$;

REVOKE ALL ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz, text)
TO authenticated;

DROP FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
);
DROP FUNCTION private.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
);

CREATE FUNCTION private.admin_manage_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz,
  p_action text,
  p_meeting_url text DEFAULT NULL,
  p_trainer_status text DEFAULT NULL,
  p_actual_ends_at timestamptz DEFAULT NULL,
  p_trainer_note text DEFAULT NULL,
  p_trainer_signature_base64 text DEFAULT NULL
)
RETURNS public.course_session_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_session record;
  v_attendance public.course_session_attendance%ROWTYPE;
  v_previous_status text;
  v_previous_signature_hash text;
  v_clean_url text := nullif(trim(p_meeting_url), '');
  v_now timestamptz := clock_timestamp();
  v_signature bytea;
  v_signature_hash text;
  v_payload_hash text;
BEGIN
  IF v_actor_id IS NULL OR NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'Accès administrateur ou formateur requis.' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('save_meeting_url', 'open_check_in', 'close_check_in', 'validate') THEN
    RAISE EXCEPTION 'Action d’émargement invalide.';
  END IF;

  SELECT * INTO v_session
  FROM private.validate_attendance_session(
    p_booking_request_id, p_session_starts_at, p_session_ends_at
  );

  INSERT INTO public.course_session_attendance (
    booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode
  ) VALUES (
    p_booking_request_id, v_session.validated_user_id,
    p_session_starts_at, p_session_ends_at, v_session.validated_delivery_mode
  )
  ON CONFLICT (booking_request_id, session_starts_at, session_ends_at)
  DO UPDATE SET delivery_mode = EXCLUDED.delivery_mode
  RETURNING * INTO v_attendance;

  v_previous_status := v_attendance.trainer_status;
  v_previous_signature_hash := v_attendance.trainer_signature_sha256;

  IF p_action = 'save_meeting_url' THEN
    IF v_session.validated_delivery_mode <> 'remote' THEN
      RAISE EXCEPTION 'Un lien de visioconférence ne concerne que les séances à distance.';
    END IF;
    IF v_clean_url IS NOT NULL AND (
      length(v_clean_url) > 1000 OR v_clean_url !~ '^https://[^[:space:]]+$'
    ) THEN
      RAISE EXCEPTION 'Le lien doit commencer par https:// et ne contenir aucun espace.';
    END IF;

    UPDATE public.course_session_attendance
    SET meeting_url = v_clean_url
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    UPDATE public.course_session_bookings
    SET meeting_url = v_clean_url
    WHERE booking_request_id = p_booking_request_id
      AND starts_at >= p_session_starts_at
      AND ends_at <= p_session_ends_at;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type, event_details
    ) VALUES (
      v_attendance.id, p_booking_request_id, v_actor_id, 'meeting_url_saved',
      jsonb_build_object('link_present', v_clean_url IS NOT NULL)
    );

  ELSIF p_action = 'open_check_in' THEN
    UPDATE public.course_session_attendance
    SET check_in_opened_at = v_now, check_in_closed_at = NULL
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type
    ) VALUES (v_attendance.id, p_booking_request_id, v_actor_id, 'check_in_opened');

  ELSIF p_action = 'close_check_in' THEN
    UPDATE public.course_session_attendance
    SET check_in_closed_at = v_now
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type
    ) VALUES (v_attendance.id, p_booking_request_id, v_actor_id, 'check_in_closed');

  ELSE
    IF p_trainer_status NOT IN ('present', 'partial', 'absent', 'technical_issue') THEN
      RAISE EXCEPTION 'Choisissez un état de présence valide.';
    END IF;
    IF p_trainer_status IN ('present', 'partial')
      AND v_attendance.learner_signature_png IS NULL THEN
      RAISE EXCEPTION 'La signature de l’apprenant est requise avant de valider sa présence.';
    END IF;
    IF p_trainer_note IS NOT NULL AND length(p_trainer_note) > 1500 THEN
      RAISE EXCEPTION 'La note est limitée à 1 500 caractères.';
    END IF;
    IF p_trainer_status = 'partial' AND (
      p_actual_ends_at IS NULL
      OR p_actual_ends_at <= p_session_starts_at
      OR p_actual_ends_at >= p_session_ends_at
    ) THEN
      RAISE EXCEPTION 'Indiquez l’heure réelle de départ, comprise dans la séance.';
    END IF;
    IF p_trainer_status = 'present' AND p_actual_ends_at IS NOT NULL
      AND p_actual_ends_at < p_session_ends_at THEN
      RAISE EXCEPTION 'Utilisez « départ anticipé » si la séance n’a pas été suivie jusqu’au bout.';
    END IF;

    v_signature := private.decode_attendance_signature(p_trainer_signature_base64);
    v_signature_hash := pg_catalog.encode(extensions.digest(v_signature, 'sha256'), 'hex');
    v_payload_hash := pg_catalog.encode(extensions.digest(
      pg_catalog.convert_to(
        p_booking_request_id::text || '|' || v_actor_id::text || '|'
        || p_session_starts_at::text || '|' || p_session_ends_at::text || '|'
        || p_trainer_status || '|' || coalesce(p_actual_ends_at::text, '') || '|'
        || v_now::text || '|' || v_signature_hash,
        'UTF8'
      ),
      'sha256'
    ), 'hex');

    UPDATE public.course_session_attendance
    SET
      trainer_status = p_trainer_status,
      actual_ends_at = CASE
        WHEN p_trainer_status = 'present' THEN coalesce(p_actual_ends_at, p_session_ends_at)
        WHEN p_trainer_status = 'absent' THEN NULL
        ELSE p_actual_ends_at
      END,
      trainer_note = nullif(trim(p_trainer_note), ''),
      trainer_validated_by = v_actor_id,
      trainer_validated_at = v_now,
      trainer_signature_png = v_signature,
      trainer_signature_sha256 = v_signature_hash,
      trainer_signed_payload_sha256 = v_payload_hash,
      trainer_signature_method = 'drawn-on-screen-v1',
      locked_at = v_now,
      check_in_closed_at = coalesce(check_in_closed_at, v_now)
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type, event_details
    ) VALUES (
      v_attendance.id,
      p_booking_request_id,
      v_actor_id,
      CASE WHEN v_previous_status = 'pending' THEN 'trainer_validated' ELSE 'trainer_corrected' END,
      jsonb_build_object(
        'previous_status', v_previous_status,
        'new_status', v_attendance.trainer_status,
        'actual_ends_at', v_attendance.actual_ends_at,
        'note_present', v_attendance.trainer_note IS NOT NULL,
        'signature_method', v_attendance.trainer_signature_method,
        'previous_signature_sha256', v_previous_signature_hash,
        'signature_sha256', v_attendance.trainer_signature_sha256,
        'signed_payload_sha256', v_attendance.trainer_signed_payload_sha256
      )
    );
  END IF;

  RETURN v_attendance;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text, text
) TO authenticated;

CREATE FUNCTION public.admin_manage_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz,
  p_action text,
  p_meeting_url text DEFAULT NULL,
  p_trainer_status text DEFAULT NULL,
  p_actual_ends_at timestamptz DEFAULT NULL,
  p_trainer_note text DEFAULT NULL,
  p_trainer_signature_base64 text DEFAULT NULL
)
RETURNS public.course_session_attendance
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_manage_course_attendance(
    p_booking_request_id, p_session_starts_at, p_session_ends_at, p_action,
    p_meeting_url, p_trainer_status, p_actual_ends_at, p_trainer_note,
    p_trainer_signature_base64
  );
$$;

REVOKE ALL ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text, text
) TO authenticated;

COMMENT ON COLUMN public.course_session_attendance.learner_signature_png IS
  'Signature dessinée PNG privée. Accès limité par RLS à l’apprenant concerné et à l’équipe pédagogique.';
COMMENT ON COLUMN public.course_session_attendance.learner_signed_payload_sha256 IS
  'Empreinte du lien entre la signature, l’identité authentifiée, la séance et l’horodatage serveur.';
COMMENT ON COLUMN public.course_session_attendance.trainer_signature_png IS
  'Signature dessinée PNG du formateur lors de sa validation ou correction.';
