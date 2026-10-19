ALTER TABLE public.diagnostic_ia_bookings
  DROP CONSTRAINT diagnostic_ia_bookings_claim_check,
  ADD CONSTRAINT diagnostic_ia_bookings_claim_check CHECK (
    (status = 'booking_pending'
      AND claim_expires_at > updated_at
      AND claim_expires_at <= updated_at + interval '15 minutes')
    OR (status <> 'booking_pending' AND claim_expires_at IS NULL)
  );
