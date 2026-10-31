BEGIN;
-- Remove Supabase default table grants beyond the authorized processor scope.
REVOKE ALL ON public.admin_email_notifications FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.admin_email_notifications TO service_role;
COMMIT;