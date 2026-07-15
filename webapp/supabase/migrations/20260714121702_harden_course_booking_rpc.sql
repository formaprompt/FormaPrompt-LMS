-- La logique privilégiée reste hors du schéma exposé par la Data API.
-- La fonction publique est un relais SECURITY INVOKER et la fonction privée
-- conserve toutes les vérifications d'identité, d'achat et de disponibilité.

ALTER FUNCTION public.create_course_booking_request(
  text, text, uuid[], text, text
) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.create_course_booking_request(
  text, text, uuid[], text, text
) FROM PUBLIC, anon, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_course_booking_request(
  text, text, uuid[], text, text
) TO authenticated;

CREATE FUNCTION public.create_course_booking_request(
  p_delivery_mode text,
  p_schedule_format text,
  p_slot_ids uuid[],
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_course_booking_request(
    p_delivery_mode,
    p_schedule_format,
    p_slot_ids,
    p_city,
    p_postal_code
  );
$$;

REVOKE ALL ON FUNCTION public.create_course_booking_request(
  text, text, uuid[], text, text
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_course_booking_request(
  text, text, uuid[], text, text
) TO authenticated;
