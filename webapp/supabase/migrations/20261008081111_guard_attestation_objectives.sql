-- Futures délivrances uniquement : aucun contrôle ni modification de l'historique.
CREATE FUNCTION private.guard_attestation_objectives()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  objective jsonb;
  -- Unicode White_Space plus BOM, identiques au contrôle du client.
  blank_characters text := E'\t\n\f\r ' || U&'\000B\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  IF pg_catalog.jsonb_typeof(NEW.content_snapshot -> 'objectives') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Les objectifs pédagogiques doivent être un tableau de textes non vides.' USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.jsonb_array_length(NEW.content_snapshot -> 'objectives') = 0 THEN
    RAISE EXCEPTION 'Les objectifs pédagogiques ne peuvent pas être vides.' USING ERRCODE = '23514';
  END IF;
  FOR objective IN SELECT value FROM pg_catalog.jsonb_array_elements(NEW.content_snapshot -> 'objectives') LOOP
    IF pg_catalog.jsonb_typeof(objective) IS DISTINCT FROM 'string'
      OR pg_catalog.btrim(objective #>> '{}', blank_characters) = '' THEN
      RAISE EXCEPTION 'Chaque objectif pédagogique doit être un texte non vide.' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_attestation_objectives() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_attestation_objectives_before_insert
BEFORE INSERT ON public.course_attestation_issuances
FOR EACH ROW EXECUTE FUNCTION private.guard_attestation_objectives();
