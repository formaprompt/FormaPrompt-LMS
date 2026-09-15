BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_learner_record(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Acces strictement reserve a un administrateur.' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant apprenant requis.' USING ERRCODE = '22004';
  END IF;

  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'identity', jsonb_build_object(
      'userId', v_profile.id,
      'role', v_profile.role,
      'email', v_profile.email,
      'createdAt', v_profile.created_at,
      'fullName', COALESCE(
        (
          SELECT NULLIF(btrim(concat_ws(' ', NULLIF(btrim(e.learner_first_name), ''), NULLIF(btrim(e.learner_last_name), ''))), '')
          FROM public.training_enrollments AS e
          WHERE e.user_id = p_user_id
          ORDER BY e.updated_at DESC, e.id DESC
          LIMIT 1
        ),
        (
          SELECT NULLIF(btrim(a.learner_name), '')
          FROM public.course_positioning_assessments AS a
          WHERE a.user_id = p_user_id
          ORDER BY a.submitted_at DESC, a.id DESC
          LIMIT 1
        )
      ),
      'organizationName', (
        SELECT NULLIF(btrim(e.organization_name), '')
        FROM public.training_enrollments AS e
        WHERE e.user_id = p_user_id
          AND NULLIF(btrim(e.organization_name), '') IS NOT NULL
        ORDER BY e.updated_at DESC, e.id DESC
        LIMIT 1
      )
    ),
    'enrollments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'courseId', e.course_id,
        'status', e.status,
        'enrollmentSource', e.enrollment_source,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'updatedAt', e.updated_at
      ) ORDER BY e.starts_at DESC, e.id DESC)
      FROM public.training_enrollments AS e
      WHERE e.user_id = p_user_id
    ), '[]'::jsonb),
    'rights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', access.id,
        'courseId', access.course_id,
        'status', access.status,
        'accessSource', access.access_source,
        'grantedAt', access.granted_at,
        'expiresAt', access.expires_at,
        'statusChangedAt', access.status_changed_at
      ) ORDER BY access.status_changed_at DESC, access.id DESC)
      FROM public.course_access AS access
      WHERE access.user_id = p_user_id
    ), '[]'::jsonb),
    'purchases', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', purchase.id,
        'courseId', purchase.course_id,
        'paymentStatus', purchase.payment_status,
        'purchasedAt', purchase.purchased_at,
        'amountPaid', CASE
          WHEN purchase.payment_status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'chargeback')
          THEN purchase.amount_total
          ELSE NULL
        END,
        'currency', purchase.currency,
        'originalAmount', promotion.original_amount_cents,
        'discountAmount', promotion.discount_amount_cents,
        'promotionCode', NULL,
        'refundedAmount', finance.amount_refunded,
        'netAmount', CASE
          WHEN purchase.payment_status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'chargeback')
            AND purchase.amount_total IS NOT NULL
            AND finance.amount_refunded IS NOT NULL
          THEN greatest(purchase.amount_total - finance.amount_refunded, 0)
          ELSE NULL
        END
      ) ORDER BY purchase.purchased_at DESC, purchase.id DESC)
      FROM public.purchases AS purchase
      LEFT JOIN LATERAL (
        SELECT
          transaction.amount_refunded
        FROM public.stripe_payment_transactions AS transaction
        WHERE transaction.purchase_id = purchase.id
          AND transaction.user_id = p_user_id
          AND transaction.course_id = purchase.course_id
          AND transaction.payment_type = 'course'
          AND transaction.status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost')
          AND transaction.amount_total IS NOT DISTINCT FROM purchase.amount_total
          AND transaction.currency IS NOT DISTINCT FROM purchase.currency
        ORDER BY transaction.created_at DESC, transaction.id DESC
        LIMIT 1
      ) AS finance ON true
      LEFT JOIN LATERAL (
        SELECT
          intent.original_amount_cents,
          intent.discount_amount_cents
        FROM public.stripe_payment_transactions AS transaction
        JOIN public.commercial_checkout_intents AS intent
          ON intent.id = transaction.checkout_intent_id
        JOIN public.promo_redemptions AS redemption
          ON redemption.id = intent.promo_redemption_id
        WHERE transaction.purchase_id = purchase.id
          AND transaction.user_id = p_user_id
          AND transaction.course_id = purchase.course_id
          AND transaction.payment_type = 'course'
          AND transaction.status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost')
          AND intent.user_id = p_user_id
          AND intent.course_id = purchase.course_id
          AND intent.status = 'paid'
          AND redemption.status = 'consumed'
          AND intent.discount_amount_cents > 0
          AND intent.final_amount_cents IS NOT DISTINCT FROM purchase.amount_total
        ORDER BY transaction.created_at DESC, transaction.id DESC
        LIMIT 1
      ) AS promotion ON true
      WHERE purchase.user_id = p_user_id
    ), '[]'::jsonb),
    'gifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', access.id,
        'courseId', access.course_id,
        'status', access.status,
        'grantedAt', access.granted_at
      ) ORDER BY access.granted_at DESC, access.id DESC)
      FROM public.course_access AS access
      WHERE access.user_id = p_user_id
        AND access.access_source = 'gift'
        AND access.purchase_id IS NULL
    ), '[]'::jsonb),
    'progress', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'courseId', progress.course_id,
        'lessonId', progress.lesson_id,
        'status', progress.status,
        'progressPercent', progress.progress_percent,
        'lastViewedAt', progress.last_viewed_at
      ) ORDER BY progress.last_viewed_at DESC, progress.course_id, progress.lesson_id)
      FROM public.course_lesson_progress AS progress
      WHERE progress.user_id = p_user_id
    ), '[]'::jsonb),
    'pendingCorrections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', pending.kind,
        'submissionId', pending.submission_id,
        'courseId', pending.course_id,
        'exerciseId', pending.exercise_id,
        'submittedAt', pending.submitted_at
      ) ORDER BY pending.submitted_at DESC, pending.submission_id DESC)
      FROM (
        SELECT
          'exercise'::text AS kind,
          latest.id AS submission_id,
          latest.course_id,
          latest.exercise_id,
          latest.saved_at AS submitted_at
        FROM (
          SELECT DISTINCT ON (response.user_id, response.course_id, response.exercise_id)
            response.id,
            response.course_id,
            response.exercise_id,
            response.saved_at
          FROM public.course_exercise_responses AS response
          WHERE response.user_id = p_user_id
            AND response.status = 'submitted'
          ORDER BY response.user_id, response.course_id, response.exercise_id,
            response.saved_at DESC, response.id DESC
        ) AS latest
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.course_exercise_reviews AS review
          WHERE review.response_id = latest.id
        )

        UNION ALL

        SELECT
          'final_project'::text AS kind,
          latest.id AS submission_id,
          latest.course_id,
          NULL::text AS exercise_id,
          latest.saved_at AS submitted_at
        FROM (
          SELECT DISTINCT ON (submission.user_id, submission.course_id)
            submission.id,
            submission.course_id,
            submission.saved_at
          FROM public.course_final_project_submissions AS submission
          WHERE submission.user_id = p_user_id
            AND submission.status = 'submitted'
          ORDER BY submission.user_id, submission.course_id,
            submission.saved_at DESC, submission.id DESC
        ) AS latest
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.course_final_project_reviews AS review
          WHERE review.submission_id = latest.id
        )
      ) AS pending
    ), '[]'::jsonb),
    'bookingRequests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', booking.id,
        'courseId', booking.course_id,
        'deliveryMode', booking.delivery_mode,
        'scheduleFormat', booking.schedule_format,
        'status', booking.status,
        'needsTrainerResponse', booking.status = 'pending_distance',
        'createdAt', booking.created_at,
        'updatedAt', booking.updated_at
      ) ORDER BY booking.created_at DESC, booking.id DESC)
      FROM public.course_booking_requests AS booking
      WHERE booking.user_id = p_user_id
    ), '[]'::jsonb),
    'commercialRequests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', request.id,
        'courseId', request.course_id,
        'subject', request.subject,
        'status', request.status,
        'createdAt', request.created_at,
        'updatedAt', request.updated_at
      ) ORDER BY request.created_at DESC, request.id DESC)
      FROM public.contact_requests AS request
      WHERE EXISTS (
        SELECT 1
        FROM public.training_enrollments AS e
        WHERE e.user_id = p_user_id
          AND (e.commercial_request_id = request.id OR request.converted_enrollment_id = e.id)
      )
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', survey.id,
        'courseId', survey.course_id,
        'courseName', survey.course_name,
        'ratingOverall', survey.rating_overall,
        'publicTestimonial', survey.public_testimonial,
        'privateFeedback', survey.private_feedback,
        'trainingDate', survey.training_date,
        'consentMarketing', survey.consent_marketing,
        'isPublished', survey.is_published,
        'createdAt', survey.created_at
      ) ORDER BY survey.created_at DESC, survey.id DESC)
      FROM public.satisfaction_surveys AS survey
      WHERE survey.user_id = p_user_id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', document.id,
        'enrollmentId', document.enrollment_id,
        'courseId', document.course_id,
        'documentType', document.document_type,
        'status', document.status,
        'visibleToLearner', document.visible_to_learner,
        'generatedAt', document.generated_at
      ) ORDER BY document.generated_at DESC NULLS LAST, document.id DESC)
      FROM public.training_documents AS document
      WHERE document.user_id = p_user_id
    ), '[]'::jsonb),
    'attestations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', attestation.id,
        'reference', attestation.reference,
        'courseId', attestation.course_id,
        'documentType', attestation.document_type,
        'issuedAt', attestation.issued_at
      ) ORDER BY attestation.issued_at DESC, attestation.id DESC)
      FROM public.course_attestation_issuances AS attestation
      WHERE attestation.user_id = p_user_id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'enrollmentId', e.id,
        'courseId', e.course_id,
        'note', e.administrative_notes,
        'updatedAt', e.updated_at
      ) ORDER BY e.updated_at DESC, e.id DESC)
      FROM public.training_enrollments AS e
      WHERE e.user_id = p_user_id
        AND NULLIF(btrim(e.administrative_notes), '') IS NOT NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.normalize_admin_learner_search(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lower(regexp_replace(
    translate(
      coalesce(p_value, ''),
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝŸýÿŒœ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYYyyOo'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

REVOKE ALL ON FUNCTION private.normalize_admin_learner_search(text)
  FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON FUNCTION public.admin_list_learners(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_learners(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.admin_list_learners(text, integer, integer) IS
  'Annuaire pagine des comptes, avec identite beneficiaire exacte issue des inscriptions, reserve a l administrateur strict.';

COMMIT;
