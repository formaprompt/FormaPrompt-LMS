import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  accessSourceForEnrollment,
  buildAdministrativeDocument,
  documentRowsForValidatedEnrollment,
  shouldCreateEnrollmentCourseAccess,
  validateAdministrativeEnrollment,
  validateAmendment,
  validateEnrollmentException,
  validateFundingUpdate,
} from '../_shared/trainingAdministration.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'La demande administrative est invalide.';
}

function relatedProfileEmail(relation: unknown) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  const value = row && typeof row === 'object' ? (row as { email?: unknown }).email : null;
  if (typeof value !== 'string' || !value) throw new Error('Adresse e-mail du profil introuvable.');
  return value;
}

function enrollmentState(enrollment: Record<string, unknown>) {
  return {
    userId: enrollment.user_id,
    courseId: enrollment.course_id,
    status: enrollment.status,
    startsAt: enrollment.starts_at,
    endsAt: enrollment.ends_at,
    fundingStatus: enrollment.funding_status,
    fundingRequestedCents: enrollment.funding_requested_cents,
    fundingGrantedCents: enrollment.funding_granted_cents,
    fundingBalanceCents: enrollment.funding_balance_cents,
    funderName: enrollment.funder_name,
    fundingReference: enrollment.funding_reference,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion administrative requise.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const siteUrl = requiredEnv('SITE_URL').replace(/\/$/, '');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor || !['admin', 'employee'].includes(actor.role)) {
      return jsonResponse({ error: 'Cette action est réservée au personnel autorisé.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : 'create_enrollment';

    if (action === 'create_enrollment') {
      const input = validateAdministrativeEnrollment(body.enrollment);
      const commercialRequestId = typeof body.commercialRequestId === 'string'
        ? body.commercialRequestId.trim()
        : '';
      const commercialQuoteId = typeof body.commercialQuoteId === 'string'
        ? body.commercialQuoteId.trim()
        : '';
      let commercialRequest = null;
      let commercialQuote = null;

      if (commercialQuoteId && !commercialRequestId) {
        return jsonResponse({ error: 'La demande commerciale liée au devis est requise.' }, 400);
      }
      if (commercialRequestId) {
        const { data, error } = await supabaseAdmin.from('contact_requests')
          .select('*').eq('id', commercialRequestId).maybeSingle();
        if (error) throw error;
        if (!data || ['won', 'lost'].includes(data.status)) {
          return jsonResponse({ error: 'La demande commerciale est introuvable ou déjà clôturée.' }, 409);
        }
        const expectedLearnerEmail = (data.beneficiary_email || data.email).toLowerCase();
        if (expectedLearnerEmail !== input.learnerEmail || (data.course_id && data.course_id !== input.courseId)) {
          return jsonResponse({ error: 'La demande commerciale ne correspond pas au bénéficiaire ou à la formation.' }, 400);
        }
        commercialRequest = data;
      }
      if (commercialQuoteId) {
        const { data, error } = await supabaseAdmin.from('commercial_quotes')
          .select('*').eq('id', commercialQuoteId).eq('contact_request_id', commercialRequestId).maybeSingle();
        if (error) throw error;
        if (!data || data.status !== 'accepted' || !data.sent_snapshot) {
          return jsonResponse({ error: 'Un devis accepté et figé est requis pour cette conversion.' }, 409);
        }
        if (data.course_id !== input.courseId || data.total_price_cents !== input.priceAmountCents) {
          return jsonResponse({ error: 'Le dossier ne correspond pas à la formation ou au montant du devis accepté.' }, 400);
        }
        commercialQuote = data;
      }
      let learnerId = input.targetUserId;
      let invited = false;

      if (learnerId) {
        const { data: selectedProfile, error: selectedProfileError } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('id', learnerId)
          .maybeSingle();
        if (selectedProfileError) throw selectedProfileError;
        if (!selectedProfile) return jsonResponse({ error: 'Le compte apprenant est introuvable.' }, 404);
        if (selectedProfile.email.toLowerCase() !== input.learnerEmail) {
          return jsonResponse({ error: "L'adresse e-mail ne correspond pas au compte sélectionné." }, 400);
        }
      } else {
        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .ilike('email', input.learnerEmail)
          .maybeSingle();
        if (existingProfileError) throw existingProfileError;

        if (existingProfile) {
          learnerId = existingProfile.id;
        } else {
          if (actor.role !== 'admin') {
            return jsonResponse({ error: "Seul l'administrateur peut inviter un nouvel apprenant." }, 403);
          }
          const { data: invitedUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            input.learnerEmail,
            { redirectTo: `${siteUrl}/reset-password` },
          );
          if (inviteError || !invitedUser.user?.id) {
            return jsonResponse({ error: "L'invitation du nouvel apprenant a échoué." }, 400);
          }
          learnerId = invitedUser.user.id;
          invited = true;
          const { error: profileUpsertError } = await supabaseAdmin.from('profiles').upsert({
            id: learnerId,
            email: input.learnerEmail,
            role: 'user',
          }, { onConflict: 'id' });
          if (profileUpsertError) throw profileUpsertError;
        }
      }

      const { data: existingEnrollment, error: existingEnrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .select('id')
        .eq('user_id', learnerId)
        .eq('course_id', input.courseId)
        .in('status', ['draft', 'pending', 'validated', 'in_progress', 'completed'])
        .maybeSingle();
      if (existingEnrollmentError) throw existingEnrollmentError;
      if (existingEnrollment) {
        return jsonResponse({ error: 'Un dossier non archivé existe déjà pour cet apprenant et cette formation.' }, 409);
      }

      const { data: existingAccess, error: existingAccessError } = await supabaseAdmin
        .from('course_access')
        .select('id, status, access_source, purchase_id, expires_at')
        .eq('user_id', learnerId)
        .eq('course_id', input.courseId)
        .maybeSingle();
      if (existingAccessError) throw existingAccessError;

      const now = new Date().toISOString();
      let courseAccess = existingAccess;

      // Un dossier administratif ne réactive jamais silencieusement un droit
      // suspendu, révoqué, remboursé ou expiré.
      if (shouldCreateEnrollmentCourseAccess(existingAccess)) {
        const { data: grantedAccess, error: grantError } = await supabaseAdmin
          .from('course_access')
          .insert({
            user_id: learnerId,
            course_id: input.courseId,
            status: 'active',
            access_source: accessSourceForEnrollment(input.enrollmentSource),
            purchase_id: null,
            granted_at: now,
            expires_at: null,
            updated_at: now,
          })
          .select('id, status, access_source, purchase_id, granted_at, expires_at')
          .single();
        if (grantError) throw grantError;
        courseAccess = grantedAccess;
      }

      const { data: matchingBooking, error: matchingBookingError } = await supabaseAdmin
        .from('course_booking_requests')
        .select('id')
        .eq('user_id', learnerId)
        .eq('course_id', input.courseId)
        .maybeSingle();
      if (matchingBookingError) throw matchingBookingError;

      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .insert({
          user_id: learnerId,
          course_id: input.courseId,
          status: 'validated',
          enrollment_source: input.enrollmentSource,
          organization_name: input.organizationName,
          learner_first_name: input.learnerFirstName,
          learner_last_name: input.learnerLastName,
          learner_job_title: input.learnerJobTitle,
          learner_phone: input.learnerPhone,
          learner_address_line1: input.learnerAddressLine1,
          learner_postal_code: input.learnerPostalCode,
          learner_city: input.learnerCity,
          funding_mode: input.fundingMode,
          funder_name: input.funderName,
          funding_reference: input.fundingReference,
          payer_name: input.payerName,
          payer_email: input.payerEmail,
          client_name: input.clientName,
          client_email: input.clientEmail,
          delivery_mode: input.deliveryMode,
          training_location: input.trainingLocation,
          remote_access_details: input.remoteAccessDetails,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          duration_minutes: input.durationMinutes,
          price_amount_cents: input.priceAmountCents,
          course_access_id: courseAccess?.id,
          booking_request_id: matchingBooking?.id ?? null,
          administrative_notes: input.administrativeNotes,
          commercial_request_id: commercialRequest?.id ?? null,
          commercial_quote_id: commercialQuote?.id ?? null,
          created_by: actor.id,
        })
        .select('*')
        .single();
      if (enrollmentError) throw enrollmentError;

      const documentRows = documentRowsForValidatedEnrollment(enrollment, input.learnerEmail, actor.id, now);
      const { data: documents, error: documentsError } = await supabaseAdmin
        .from('training_documents')
        .insert(documentRows)
        .select('id, enrollment_id, document_type, status, visible_to_learner, generated_at');
      if (documentsError) throw documentsError;

      const { error: initialEventError } = await supabaseAdmin.from('training_enrollment_events').insert({
        enrollment_id: enrollment.id,
        event_type: 'initial_snapshot',
        reason: 'Création du dossier administratif',
        previous_state: {},
        new_state: enrollmentState(enrollment),
        rights_impact: courseAccess?.id ? 'managed_separately' : 'review_required',
        actor_user_id: actor.id,
      });
      if (initialEventError) throw initialEventError;

      if (commercialRequest) {
        const convertedAt = new Date().toISOString();
        const { error: conversionError } = await supabaseAdmin.from('contact_requests').update({
          status: 'won',
          converted_at: convertedAt,
          conversion_kind: 'administrative',
          converted_enrollment_id: enrollment.id,
          updated_at: convertedAt,
        }).eq('id', commercialRequest.id).neq('status', 'won');
        if (conversionError) throw conversionError;
        const { error: historyError } = await supabaseAdmin.from('commercial_request_history').insert({
          contact_request_id: commercialRequest.id,
          actor_user_id: actor.id,
          event_type: 'converted',
          previous_status: commercialRequest.status,
          new_status: 'won',
          details: {
            kind: 'administrative', enrollmentId: enrollment.id,
            quoteId: commercialQuote?.id ?? null, courseAccessId: courseAccess?.id ?? null,
          },
        });
        if (historyError) throw historyError;
      }

      console.info('Dossier de formation créé', {
        actorId: actor.id,
        learnerId,
        enrollmentId: enrollment.id,
        courseId: enrollment.course_id,
        source: enrollment.enrollment_source,
      });
      return jsonResponse({ enrollment, documents, courseAccess, invited, commercialConverted: Boolean(commercialRequest) }, 201);
    }

    if (['update_funding', 'cancel_enrollment', 'postpone_enrollment', 'transfer_beneficiary', 'abandon_enrollment', 'create_amendment'].includes(action)) {
      const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId.trim() : '';
      if (!enrollmentId) return jsonResponse({ error: 'Dossier invalide.' }, 400);
      const { data: current, error: currentError } = await supabaseAdmin
        .from('training_enrollments')
        .select('*, profiles!training_enrollments_user_id_fkey(email), training_documents(id, document_type, status, version, content_snapshot, visible_to_learner, generated_at)')
        .eq('id', enrollmentId)
        .single();
      if (currentError) throw currentError;
      const before = enrollmentState(current);
      const now = new Date().toISOString();

      if (action === 'update_funding') {
        const input = validateFundingUpdate(body.funding);
        const { data: enrollment, error } = await supabaseAdmin.from('training_enrollments').update({
          funding_status: input.status,
          funding_requested_cents: input.requestedCents,
          funding_granted_cents: input.grantedCents,
          funding_requested_at: input.status === 'not_requested' ? null : (current.funding_requested_at || now),
          funding_decided_at: ['partially_granted', 'granted', 'refused', 'withdrawn'].includes(input.status) ? now : null,
          funder_name: input.funderName,
          funding_reference: input.fundingReference,
          updated_at: now,
        }).eq('id', enrollmentId).select('*').single();
        if (error) throw error;
        const { error: eventError } = await supabaseAdmin.from('training_enrollment_events').insert({
          enrollment_id: enrollmentId, event_type: 'funding_updated', reason: input.reason,
          previous_state: before, new_state: enrollmentState(enrollment), rights_impact: 'none', actor_user_id: actor.id,
        });
        if (eventError) throw eventError;
        return jsonResponse({ enrollment, rightsChanged: false });
      }

      if (action === 'create_amendment') {
        const input = validateAmendment(body.amendment);
        if (input.sourceDocumentId && !(current.training_documents || []).some((document: { id: string }) => document.id === input.sourceDocumentId)) {
          return jsonResponse({ error: 'Le document source ne correspond pas au dossier.' }, 400);
        }
        if (input.sourceQuoteId && input.sourceQuoteId !== current.commercial_quote_id) {
          return jsonResponse({ error: 'Le devis source ne correspond pas au dossier.' }, 400);
        }
        const { data: previousAmendment, error: previousAmendmentError } = await supabaseAdmin
          .from('training_amendments').select('version').eq('enrollment_id', enrollmentId)
          .order('version', { ascending: false }).limit(1).maybeSingle();
        if (previousAmendmentError) throw previousAmendmentError;
        const version = (previousAmendment?.version || 0) + 1;
        const frozenSnapshot = {
          version, createdAt: now, enrollment: before,
          learner: { id: current.user_id, email: relatedProfileEmail(current.profiles), firstName: current.learner_first_name, lastName: current.learner_last_name },
          reason: input.reason, changeSummary: input.changeSummary,
          previousValues: input.previousValues, newValues: input.newValues,
        };
        const { data: amendment, error } = await supabaseAdmin.from('training_amendments').insert({
          enrollment_id: enrollmentId, source_document_id: input.sourceDocumentId,
          source_quote_id: input.sourceQuoteId, effective_date: input.effectiveDate,
          version,
          reason: input.reason, change_summary: input.changeSummary,
          previous_values: input.previousValues, new_values: input.newValues,
          frozen_snapshot: frozenSnapshot, created_by: actor.id,
        }).select('*').single();
        if (error) throw error;
        const { error: eventError } = await supabaseAdmin.from('training_enrollment_events').insert({
          enrollment_id: enrollmentId, event_type: 'amendment_created', reason: input.reason,
          previous_state: before, new_state: { ...before, amendmentId: amendment.id, amendmentNumber: amendment.amendment_number },
          rights_impact: 'none', actor_user_id: actor.id,
        });
        if (eventError) throw eventError;
        return jsonResponse({ amendment, rightsChanged: false }, 201);
      }

      if (['completed', 'archived', 'cancelled', 'abandoned'].includes(current.status)) {
        return jsonResponse({ error: 'Le statut actuel du dossier interdit cette action.' }, 409);
      }
      const input = validateEnrollmentException(action, body.exception);
      let changes: Record<string, unknown> = { updated_at: now };
      let eventType = '';
      let rightsImpact = 'none';

      if (action === 'cancel_enrollment') {
        changes = { ...changes, status: 'cancelled', cancelled_at: now, cancelled_by_actor: input.actorLabel, cancellation_reason: input.reason };
        eventType = 'cancelled'; rightsImpact = 'review_required';
      } else if (action === 'abandon_enrollment') {
        changes = { ...changes, status: 'abandoned', abandoned_at: now, abandonment_origin: input.origin, abandonment_reason: input.reason };
        eventType = 'abandoned'; rightsImpact = 'review_required';
      } else if (action === 'postpone_enrollment') {
        changes = { ...changes, starts_at: input.startsAt, ends_at: input.endsAt };
        eventType = 'postponed'; rightsImpact = 'none';
      } else {
        const { data: targetProfile, error: targetError } = await supabaseAdmin.from('profiles')
          .select('id, email').eq('id', input.targetUserId).maybeSingle();
        if (targetError) throw targetError;
        if (!targetProfile || targetProfile.email.toLowerCase() !== input.learnerEmail) {
          return jsonResponse({ error: 'Le compte cible et son adresse e-mail ne correspondent pas.' }, 400);
        }
        const { data: duplicate, error: duplicateError } = await supabaseAdmin.from('training_enrollments')
          .select('id').eq('user_id', input.targetUserId).eq('course_id', current.course_id)
          .in('status', ['draft', 'pending', 'validated', 'in_progress', 'completed']).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) return jsonResponse({ error: 'Le nouveau bénéficiaire possède déjà un dossier ouvert pour cette formation.' }, 409);
        changes = {
          ...changes,
          user_id: input.targetUserId,
          learner_first_name: input.learnerFirstName,
          learner_last_name: input.learnerLastName,
          course_access_id: null,
        };
        eventType = 'beneficiary_transferred'; rightsImpact = 'review_required';
      }

      const { data: enrollment, error } = await supabaseAdmin.from('training_enrollments')
        .update(changes).eq('id', enrollmentId).select('*').single();
      if (error) throw error;

      if (['postpone_enrollment', 'transfer_beneficiary'].includes(action)) {
        const learnerEmail = action === 'transfer_beneficiary'
          ? input.learnerEmail
          : relatedProfileEmail(current.profiles);
        for (const document of current.training_documents || []) {
          const generatable = ['training_agreement', 'convocation'].includes(document.document_type)
            && document.status !== 'missing';
          if (!generatable && action !== 'transfer_beneficiary') continue;
          const documentChanges: Record<string, unknown> = {
            version: Number(document.version || 1) + 1,
            updated_at: now,
          };
          if (action === 'transfer_beneficiary') documentChanges.user_id = enrollment.user_id;
          if (generatable) {
            documentChanges.content_snapshot = buildAdministrativeDocument(document.document_type, enrollment, learnerEmail, now);
            documentChanges.generated_by = actor.id;
            documentChanges.generated_at = now;
          }
          const { error: documentError } = await supabaseAdmin.from('training_documents')
            .update(documentChanges).eq('id', document.id);
          if (documentError) throw documentError;
        }
      }
      const after = enrollmentState(enrollment);
      const { error: eventError } = await supabaseAdmin.from('training_enrollment_events').insert({
        enrollment_id: enrollmentId, event_type: eventType, reason: input.reason,
        previous_state: before, new_state: after, rights_impact: rightsImpact, actor_user_id: actor.id,
      });
      if (eventError) throw eventError;
      return jsonResponse({ enrollment, rightsChanged: false, rightsReviewRequired: rightsImpact === 'review_required' });
    }

    if (action === 'regenerate_document') {
      const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId : '';
      const documentType = typeof body.documentType === 'string' ? body.documentType : '';
      if (!enrollmentId || !['training_agreement', 'convocation', 'completion_certificate'].includes(documentType)) {
        return jsonResponse({ error: 'Document invalide.' }, 400);
      }
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .select('*, profiles!training_enrollments_user_id_fkey(email)')
        .eq('id', enrollmentId)
        .single();
      if (enrollmentError) throw enrollmentError;
      if (documentType === 'completion_certificate' && enrollment.status !== 'completed') {
        return jsonResponse({ error: "L'attestation est réservée à une formation terminée." }, 409);
      }
      const generatedAt = new Date().toISOString();
      const snapshot = buildAdministrativeDocument(documentType, enrollment, relatedProfileEmail(enrollment.profiles), generatedAt);
      const { data: document, error: documentError } = await supabaseAdmin
        .from('training_documents')
        .upsert({
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          course_id: enrollment.course_id,
          document_type: documentType,
          status: 'ready',
          content_snapshot: snapshot,
          visible_to_learner: true,
          generated_by: actor.id,
          generated_at: generatedAt,
          updated_at: generatedAt,
        }, { onConflict: 'enrollment_id,document_type' })
        .select('id, enrollment_id, document_type, status, generated_at')
        .single();
      if (documentError) throw documentError;
      return jsonResponse({ document });
    }

    if (action === 'update_enrollment') {
      const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId : '';
      if (!enrollmentId) return jsonResponse({ error: 'Dossier invalide.' }, 400);
      const input = validateAdministrativeEnrollment(body.enrollment);
      const updateReason = typeof body.enrollment?.updateReason === 'string' ? body.enrollment.updateReason.trim() : '';
      if (updateReason.length < 5 || updateReason.length > 2000) {
        return jsonResponse({ error: 'Un motif de modification de 5 à 2000 caractères est requis.' }, 400);
      }

      const { data: existingEnrollment, error: existingEnrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .select('*, profiles!training_enrollments_user_id_fkey(email)')
        .eq('id', enrollmentId)
        .single();
      if (existingEnrollmentError) throw existingEnrollmentError;
      if (['archived', 'cancelled', 'abandoned'].includes(existingEnrollment.status)) {
        return jsonResponse({ error: 'Un dossier archivé, annulé ou abandonné ne peut plus être modifié.' }, 409);
      }
      if (input.targetUserId !== existingEnrollment.user_id || input.courseId !== existingEnrollment.course_id) {
        return jsonResponse({ error: "L'apprenant et la formation d'un dossier existant ne peuvent pas être remplacés." }, 400);
      }
      if (relatedProfileEmail(existingEnrollment.profiles).toLowerCase() !== input.learnerEmail) {
        return jsonResponse({ error: "L'adresse e-mail ne correspond pas au compte du dossier." }, 400);
      }

      const updatedAt = new Date().toISOString();
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .update({
          enrollment_source: input.enrollmentSource,
          organization_name: input.organizationName,
          learner_first_name: input.learnerFirstName,
          learner_last_name: input.learnerLastName,
          learner_job_title: input.learnerJobTitle,
          learner_phone: input.learnerPhone,
          learner_address_line1: input.learnerAddressLine1,
          learner_postal_code: input.learnerPostalCode,
          learner_city: input.learnerCity,
          funding_mode: input.fundingMode,
          funder_name: input.funderName,
          funding_reference: input.fundingReference,
          payer_name: input.payerName,
          payer_email: input.payerEmail,
          client_name: input.clientName,
          client_email: input.clientEmail,
          delivery_mode: input.deliveryMode,
          training_location: input.trainingLocation,
          remote_access_details: input.remoteAccessDetails,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          duration_minutes: input.durationMinutes,
          price_amount_cents: input.priceAmountCents,
          administrative_notes: input.administrativeNotes,
          updated_at: updatedAt,
        })
        .eq('id', enrollmentId)
        .select('*, profiles!training_enrollments_user_id_fkey(email)')
        .single();
      if (enrollmentError) throw enrollmentError;

      const documentTypesToRefresh = ['training_agreement', 'convocation'];
      if (enrollment.status === 'completed') documentTypesToRefresh.push('completion_certificate');
      const refreshedDocuments = documentTypesToRefresh.map((documentType) => ({
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        document_type: documentType,
        status: 'ready',
        content_snapshot: buildAdministrativeDocument(documentType, enrollment, relatedProfileEmail(enrollment.profiles), updatedAt),
        visible_to_learner: true,
        generated_by: actor.id,
        generated_at: updatedAt,
        updated_at: updatedAt,
      }));
      const { error: documentsError } = await supabaseAdmin
        .from('training_documents')
        .upsert(refreshedDocuments, { onConflict: 'enrollment_id,document_type' });
      if (documentsError) throw documentsError;

      const { error: eventError } = await supabaseAdmin.from('training_enrollment_events').insert({
        enrollment_id: enrollmentId,
        event_type: 'dossier_updated',
        reason: updateReason,
        previous_state: enrollmentState(existingEnrollment),
        new_state: enrollmentState(enrollment),
        rights_impact: 'none',
        actor_user_id: actor.id,
      });
      if (eventError) throw eventError;

      return jsonResponse({ enrollment, documentsRegenerated: true });
    }

    if (action === 'complete_enrollment') {
      const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId : '';
      if (!enrollmentId) return jsonResponse({ error: 'Dossier invalide.' }, 400);
      const completedAt = new Date().toISOString();
      const { data: dossierToComplete, error: dossierError } = await supabaseAdmin
        .from('training_enrollments')
        .select('ends_at, status')
        .eq('id', enrollmentId)
        .single();
      if (dossierError) throw dossierError;
      if (['archived', 'cancelled', 'abandoned'].includes(dossierToComplete.status)) {
        return jsonResponse({ error: 'Un dossier archivé, annulé ou abandonné ne peut pas être terminé.' }, 409);
      }
      if (new Date(dossierToComplete.ends_at) > new Date(completedAt)) {
        return jsonResponse({ error: 'La formation ne peut pas être terminée avant sa date de fin prévue.' }, 409);
      }
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('training_enrollments')
        .update({ status: 'completed', completed_at: completedAt, updated_at: completedAt })
        .eq('id', enrollmentId)
        .select('*, profiles!training_enrollments_user_id_fkey(email)')
        .single();
      if (enrollmentError) throw enrollmentError;

      const certificateSnapshot = buildAdministrativeDocument(
        'completion_certificate',
        enrollment,
        relatedProfileEmail(enrollment.profiles),
        completedAt,
      );
      const { error: certificateError } = await supabaseAdmin.from('training_documents').upsert({
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        document_type: 'completion_certificate',
        status: 'ready',
        content_snapshot: certificateSnapshot,
        visible_to_learner: true,
        generated_by: actor.id,
        generated_at: completedAt,
        updated_at: completedAt,
      }, { onConflict: 'enrollment_id,document_type' });
      if (certificateError) throw certificateError;

      if (enrollment.booking_request_id) {
        const { error: satisfactionError } = await supabaseAdmin.from('training_documents').upsert({
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          course_id: enrollment.course_id,
          document_type: 'satisfaction_questionnaire',
          status: 'ready',
          content_snapshot: {
            version: 1,
            documentType: 'satisfaction_questionnaire',
            bookingRequestId: enrollment.booking_request_id,
            courseId: enrollment.course_id,
          },
          visible_to_learner: true,
          generated_by: actor.id,
          generated_at: completedAt,
          updated_at: completedAt,
        }, { onConflict: 'enrollment_id,document_type' });
        if (satisfactionError) throw satisfactionError;
      }

      return jsonResponse({ enrollment, certificateGenerated: true });
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('admin-manage-enrollment:', error);
    const message = safeErrorMessage(error);
    const status = /requis|invalide|trop long|doit suivre|introuvable/i.test(message) ? 400 : 500;
    return jsonResponse({ error: status === 400 ? message : 'Le dossier ne peut pas être traité pour le moment.' }, status);
  }
});
