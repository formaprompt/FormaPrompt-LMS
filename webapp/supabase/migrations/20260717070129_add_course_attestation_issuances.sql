-- Registre immuable des attestations réellement délivrées.
-- Le contenu utile à l'apprenant est figé au moment de la délivrance ; les
-- preuves pédagogiques sources restent conservées dans leurs tables dédiées.

CREATE TABLE public.course_attestation_issuances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  document_type text NOT NULL,
  submission_id bigint NOT NULL
    REFERENCES public.course_final_project_submissions(id) ON DELETE RESTRICT,
  review_id bigint
    REFERENCES public.course_final_project_reviews(id) ON DELETE RESTRICT,
  booking_request_id uuid NOT NULL
    REFERENCES public.course_booking_requests(id) ON DELETE RESTRICT,
  issued_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content_snapshot jsonb NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_attestation_issuances_reference_check CHECK (
    reference ~ '^FP-(REA|COMP)-[0-9]{4}-[A-Z0-9]{8,}$'
  ),
  CONSTRAINT course_attestation_issuances_document_type_check CHECK (
    document_type IN ('realisation', 'competences')
  ),
  CONSTRAINT course_attestation_issuances_type_source_check CHECK (
    (
      document_type = 'realisation'
      AND review_id IS NULL
      AND reference LIKE 'FP-REA-%'
    )
    OR (
      document_type = 'competences'
      AND review_id IS NOT NULL
      AND reference LIKE 'FP-COMP-%'
    )
  ),
  CONSTRAINT course_attestation_issuances_snapshot_check CHECK (
    jsonb_typeof(content_snapshot) = 'object'
    AND content_snapshot ->> 'version' = '1'
    AND content_snapshot ?& ARRAY[
      'learnerName', 'courseTitle', 'nature', 'period', 'deliveryMode',
      'attendedMinutes', 'plannedMinutes', 'objectives', 'organization',
      'traceability'
    ]
    AND jsonb_typeof(content_snapshot -> 'objectives') = 'array'
    AND jsonb_typeof(content_snapshot -> 'organization') = 'object'
    AND jsonb_typeof(content_snapshot -> 'traceability') = 'object'
    AND jsonb_typeof(content_snapshot -> 'traceability' -> 'attendanceIds') = 'array'
    AND jsonb_typeof(content_snapshot -> 'attendedMinutes') = 'number'
    AND jsonb_typeof(content_snapshot -> 'plannedMinutes') = 'number'
    AND (content_snapshot ->> 'attendedMinutes')::integer >= 0
    AND (content_snapshot ->> 'plannedMinutes')::integer > 0
    AND (content_snapshot ->> 'attendedMinutes')::integer
      <= (content_snapshot ->> 'plannedMinutes')::integer
    AND char_length(btrim(content_snapshot ->> 'learnerName')) BETWEEN 3 AND 200
    AND char_length(btrim(content_snapshot ->> 'courseTitle')) BETWEEN 1 AND 250
    AND octet_length(content_snapshot::text) <= 65536
  ),
  CONSTRAINT course_attestation_issuances_one_document_per_submission
    UNIQUE (submission_id, document_type)
);

COMMENT ON TABLE public.course_attestation_issuances IS
  'Registre append-only des attestations délivrées avec contenu figé et références de preuve.';
COMMENT ON COLUMN public.course_attestation_issuances.content_snapshot IS
  'Copie minimisée du document délivré ; aucune adresse e-mail ni signature dessinée n''y est stockée.';

CREATE INDEX course_attestation_issuances_learner_date_idx
  ON public.course_attestation_issuances (user_id, issued_at DESC, id DESC);
CREATE INDEX course_attestation_issuances_course_date_idx
  ON public.course_attestation_issuances (course_id, issued_at DESC, id DESC);
CREATE INDEX course_attestation_issuances_booking_idx
  ON public.course_attestation_issuances (booking_request_id);
CREATE INDEX course_attestation_issuances_issuer_idx
  ON public.course_attestation_issuances (issued_by);

ALTER TABLE public.course_attestation_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_attestation_issuances FORCE ROW LEVEL SECURITY;

CREATE POLICY "L'apprenant consulte ses attestations et le personnel assure le suivi"
ON public.course_attestation_issuances
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

CREATE POLICY "Le personnel délivre une attestation à partir de preuves finalisées"
ON public.course_attestation_issuances
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.is_admin())
  AND issued_by = (SELECT auth.uid())
  AND issued_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
  AND content_snapshot -> 'traceability' ->> 'bookingId' = booking_request_id::text
  AND content_snapshot -> 'traceability' ->> 'submissionId' = submission_id::text
  AND content_snapshot -> 'traceability' ->> 'reviewId' = coalesce(review_id::text, '')
  AND reference = CASE document_type
    WHEN 'realisation' THEN
      'FP-REA-' || to_char(issued_at AT TIME ZONE 'UTC', 'YYYY') || '-'
      || upper(right(replace(booking_request_id::text, '-', ''), 8))
    WHEN 'competences' THEN
      'FP-COMP-' || to_char(issued_at AT TIME ZONE 'UTC', 'YYYY') || '-'
      || right(lpad(review_id::text, 8, '0'), 8)
  END
  AND EXISTS (
    SELECT 1
    FROM public.course_final_project_submissions AS submission
    WHERE submission.id = course_attestation_issuances.submission_id
      AND submission.user_id = course_attestation_issuances.user_id
      AND submission.course_id = course_attestation_issuances.course_id
      AND submission.status = 'submitted'
  )
  AND EXISTS (
    SELECT 1
    FROM public.course_booking_requests AS booking
    WHERE booking.id = course_attestation_issuances.booking_request_id
      AND booking.user_id = course_attestation_issuances.user_id
      AND booking.course_id = course_attestation_issuances.course_id
      AND booking.status IN ('confirmed', 'completed')
      AND (
        SELECT count(*)
        FROM public.course_session_attendance AS attendance
        WHERE attendance.booking_request_id = booking.id
          AND attendance.user_id = booking.user_id
      ) = CASE booking.schedule_format
        WHEN 'one_4h' THEN 1
        WHEN 'two_2h' THEN 2
        WHEN 'four_1h' THEN 4
        WHEN 'two_3h30' THEN 2
        WHEN 'one_day_7h' THEN 2
        WHEN 'two_5h' THEN 2
        WHEN 'four_2h30' THEN 4
        WHEN 'three_4h_4h_2h' THEN 3
        ELSE 0
      END
      AND (
        SELECT count(*)
        FROM public.course_session_attendance AS attendance
        WHERE attendance.booking_request_id = booking.id
          AND attendance.user_id = booking.user_id
          AND attendance.learner_confirmed_at IS NOT NULL
          AND attendance.learner_signature_sha256 IS NOT NULL
          AND attendance.trainer_status IN ('present', 'partial')
          AND attendance.trainer_validated_at IS NOT NULL
          AND attendance.trainer_signature_sha256 IS NOT NULL
          AND attendance.locked_at IS NOT NULL
      ) = CASE booking.schedule_format
        WHEN 'one_4h' THEN 1
        WHEN 'two_2h' THEN 2
        WHEN 'four_1h' THEN 4
        WHEN 'two_3h30' THEN 2
        WHEN 'one_day_7h' THEN 2
        WHEN 'two_5h' THEN 2
        WHEN 'four_2h30' THEN 4
        WHEN 'three_4h_4h_2h' THEN 3
        ELSE 0
      END
  )
  AND (
    (
      document_type = 'realisation'
      AND review_id IS NULL
    )
    OR (
      document_type = 'competences'
      AND EXISTS (
        SELECT 1
        FROM public.course_final_project_reviews AS review
        WHERE review.id = course_attestation_issuances.review_id
          AND review.submission_id = course_attestation_issuances.submission_id
          AND review.review_status = 'validated'
      )
    )
  )
);

-- Aucun droit UPDATE ou DELETE : une attestation délivrée ne peut pas être
-- réécrite. Une éventuelle rectification devra faire l'objet d'une migration
-- et d'un mécanisme d'annulation explicite, après validation métier.
REVOKE ALL ON public.course_attestation_issuances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_attestation_issuances TO authenticated;
GRANT INSERT (
  reference,
  user_id,
  course_id,
  document_type,
  submission_id,
  review_id,
  booking_request_id,
  issued_by,
  content_snapshot
) ON public.course_attestation_issuances TO authenticated;
GRANT ALL ON public.course_attestation_issuances TO service_role;
GRANT USAGE ON SEQUENCE public.course_attestation_issuances_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_attestation_issuances_id_seq TO service_role;
