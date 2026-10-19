ALTER TABLE public.diagnostic_ia_bookings
  DROP CONSTRAINT diagnostic_ia_bookings_google_references_check,
  ADD CONSTRAINT diagnostic_ia_bookings_google_references_check CHECK (
    (google_sync_status <> 'synced'
      OR (google_calendar_id IS NOT NULL AND google_event_id IS NOT NULL))
    AND (google_meet_status <> 'created' OR google_meet_url IS NOT NULL)
    AND (google_meet_status = 'created' OR google_meet_url IS NULL)
    AND (google_calendar_id IS NULL OR char_length(btrim(google_calendar_id)) BETWEEN 3 AND 1024)
    AND (
      google_event_id IS NULL
      OR (
        char_length(google_event_id) BETWEEN 5 AND 1024
        AND google_event_id ~ '^[a-v0-9]+$'
      )
    )
    AND (google_meet_url IS NULL OR google_meet_url ~ '^https://meet[.]google[.]com/[A-Za-z0-9-]+$')
    AND (google_sync_error_code IS NULL OR char_length(google_sync_error_code) BETWEEN 2 AND 100)
  );
