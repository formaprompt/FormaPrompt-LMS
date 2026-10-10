BEGIN;

-- Durable anchor: never derived from the editable profile email or JWT metadata.
CREATE TABLE private.admin_role_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid UNIQUE,
  bound_at timestamptz
);
ALTER TABLE private.admin_role_owner ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_role_owner FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.admin_role_owner(singleton) VALUES (true);

DO $$
DECLARE v_owner uuid;
BEGIN
  IF (SELECT count(*) FROM auth.users WHERE lower(email) = 'thierry227@gmail.com') > 1 THEN
    RAISE EXCEPTION 'Identite Auth proprietaire ambigue.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'thierry227@gmail.com';
  IF v_owner IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_owner AND role = 'admin') THEN
      RAISE EXCEPTION 'Le proprietaire Auth doit deja disposer du role admin.' USING ERRCODE = '42501';
    END IF;
    UPDATE private.admin_role_owner SET user_id = v_owner, bound_at = now() WHERE singleton;
  END IF;
END;
$$;

CREATE FUNCTION private.guard_admin_role_owner_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM private.admin_role_owner WHERE singleton;
  IF TG_OP = 'DELETE' THEN
    IF OLD.id = v_owner OR lower(OLD.email) = 'thierry227@gmail.com' THEN
      RAISE EXCEPTION 'Le compte proprietaire est protege.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.id = v_owner AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Le compte proprietaire est protege.' USING ERRCODE = '42501';
  END IF;
  IF lower(NEW.email) = 'thierry227@gmail.com' THEN
    -- Only canonical identity binding/reuse needs the singleton lock.
    SELECT user_id INTO v_owner FROM private.admin_role_owner WHERE singleton FOR UPDATE;
    IF v_owner IS NOT NULL AND NEW.id IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'L identite proprietaire est deja liee.' USING ERRCODE = '42501';
    END IF;
    IF v_owner IS NULL THEN
      UPDATE private.admin_role_owner SET user_id = NEW.id, bound_at = now() WHERE singleton;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_admin_role_owner_identity() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_admin_role_owner_identity BEFORE INSERT OR UPDATE OR DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.guard_admin_role_owner_identity();

CREATE FUNCTION private.is_admin_role_owner(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.admin_role_owner WHERE singleton AND user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND lower(email) = 'thierry227@gmail.com');
$$;
REVOKE ALL ON FUNCTION private.is_admin_role_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Defense in depth for direct SQL/service writes; ordinary profile creation is preserved.
CREATE FUNCTION private.guard_profile_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_actor_role text; v_role_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF private.is_admin_role_owner(OLD.id) THEN
      RAISE EXCEPTION 'Le compte proprietaire est protege.' USING ERRCODE = '42501';
    END IF;
    IF v_actor IS NOT NULL THEN
      SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor FOR UPDATE;
      IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
      END IF;
    ELSIF current_setting('role', true) IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'L identite du profil est immuable.' USING ERRCODE = '42501';
    END IF;
    v_role_changed := NEW.role IS DISTINCT FROM OLD.role;
    IF v_role_changed AND private.is_admin_role_owner(OLD.id) AND NEW.role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Le compte proprietaire est protege.' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_role_changed := NEW.role IS DISTINCT FROM 'user';
  END IF;
  IF NOT v_role_changed THEN RETURN NEW; END IF;
  -- Trusted maintenance without a user session remains possible for non-owner accounts.
  -- An authenticated session, even when carried by service_role, must be a live admin.
  IF v_actor IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor FOR UPDATE;
    IF v_actor_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
    END IF;
  ELSIF current_setting('role', true) IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_admin_role() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_profile_admin_role BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_admin_role();

CREATE FUNCTION private.audit_profile_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_log(actor_user_id, action_type, target_type, target_id,
      target_user_id, previous_state, new_state, reason, metadata)
    VALUES (auth.uid(), 'profile_role_changed', 'profile', NEW.id::text, NEW.id,
      jsonb_build_object('role', OLD.role), jsonb_build_object('role', NEW.role),
      'Modification administrative du role', '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_profile_admin_role() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER audit_profile_admin_role AFTER UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.audit_profile_admin_role();

CREATE FUNCTION private.admin_set_user_role(p_user_id uuid, p_role text, p_expected_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_actor_role text; v_old_role text; v_protected boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
  END IF;
  -- Consistent actor/target order: concurrent admin changes cannot authorize from a stale role.
  PERFORM id FROM public.profiles WHERE id IN (v_actor, p_user_id) ORDER BY id FOR UPDATE;
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor;
  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_role IS NULL OR p_expected_role IS NULL
    OR p_role NOT IN ('user', 'employee', 'admin') OR p_expected_role NOT IN ('user', 'employee', 'admin') THEN
    RAISE EXCEPTION 'Parametres de role invalides.' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_old_role IS DISTINCT FROM p_expected_role THEN
    RAISE EXCEPTION 'Le role a change. Actualisez la liste.' USING ERRCODE = 'PT409';
  END IF;
  v_protected := private.is_admin_role_owner(p_user_id);
  IF v_protected AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Le compte proprietaire est protege.' USING ERRCODE = '42501';
  END IF;
  IF v_old_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
  END IF;
  RETURN jsonb_build_object('userId', p_user_id, 'role', p_role,
    'protected', v_protected, 'changed', v_old_role IS DISTINCT FROM p_role);
END;
$$;
REVOKE ALL ON FUNCTION private.admin_set_user_role(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_set_user_role(uuid,text,text) TO authenticated;
CREATE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text, p_expected_role text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.admin_set_user_role(p_user_id, p_role, p_expected_role);
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid,text,text) TO authenticated;
COMMENT ON FUNCTION public.admin_set_user_role(uuid,text,text) IS
  'Admin strict uniquement. user=inscrit, employee=formateur/collaborateur existant. Protection proprietaire et controle du role attendu.';

CREATE OR REPLACE FUNCTION public.admin_list_learners(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_search text := private.normalize_admin_learner_search(btrim(coalesce(p_search, '')));
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Pagination annuaire invalide.' USING ERRCODE = '22023';
  END IF;

  WITH identities AS (
    SELECT
      profile.id AS user_id,
      profile.email,
      profile.role,
      profile.created_at,
      coalesce(enrollment.full_name, positioning.learner_name) AS full_name,
      organization.organization_name
    FROM public.profiles AS profile
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(concat_ws(' ', NULLIF(btrim(e.learner_first_name), ''), NULLIF(btrim(e.learner_last_name), ''))), '') AS full_name
      FROM public.training_enrollments AS e
      WHERE e.user_id = profile.id
      ORDER BY e.updated_at DESC, e.id DESC
      LIMIT 1
    ) AS enrollment ON true
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(a.learner_name), '') AS learner_name
      FROM public.course_positioning_assessments AS a
      WHERE a.user_id = profile.id
      ORDER BY a.submitted_at DESC, a.id DESC
      LIMIT 1
    ) AS positioning ON true
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(e.organization_name), '') AS organization_name
      FROM public.training_enrollments AS e
      WHERE e.user_id = profile.id
        AND NULLIF(btrim(e.organization_name), '') IS NOT NULL
      ORDER BY e.updated_at DESC, e.id DESC
      LIMIT 1
    ) AS organization ON true
  ), filtered AS (
    SELECT *
    FROM identities
    WHERE v_search = '' OR NOT EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_search, ' ') AS token(value)
      WHERE private.normalize_admin_learner_search(concat_ws(' ', full_name, email, organization_name)) NOT LIKE '%' || token.value || '%'
    )
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY private.normalize_admin_learner_search(coalesce(full_name, email)), email, user_id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', item.user_id,
        'email', item.email,
        'role', item.role,
        'protected', private.is_admin_role_owner(item.user_id),
        'createdAt', item.created_at,
        'fullName', item.full_name,
        'organizationName', item.organization_name
      ) ORDER BY private.normalize_admin_learner_search(coalesce(item.full_name, item.email)), item.email, item.user_id)
      FROM page AS item
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'limit', p_limit,
    'offset', p_offset
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMIT;
