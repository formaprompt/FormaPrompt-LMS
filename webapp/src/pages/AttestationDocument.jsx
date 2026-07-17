import { useEffect, useMemo, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AttestationPaper from '../components/AttestationPaper';
import { useAuth } from '../contexts/useAuth';
import { COURSE_ATTESTATION_CONFIG } from '../data/attestationConfig';
import { courseCatalog } from '../data/courseCatalog';
import { buildAttestationDossier } from '../lib/attestationDossier';
import { ATTESTATION_TYPES, createAttestationReference } from '../lib/attestationDocument';
import { createAttestationSnapshot } from '../lib/attestationSnapshot';
import { groupBookedSessions } from '../lib/courseBookingSlots';
import { FINAL_PROJECT_REVIEW_FIELDS } from '../lib/finalProjectEvaluation';
import { supabase } from '../lib/supabaseClient';
import './AttestationDocument.css';

export default function AttestationDocument() {
  const { submissionId, documentType } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const typeConfig = ATTESTATION_TYPES[documentType];

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'employee')) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (!typeConfig) return;

    async function loadAttestationData() {
      setLoading(true);
      setError('');

      const { data: submission, error: submissionError } = await supabase
        .from('course_final_project_latest_submissions')
        .select(`
          id, user_id, course_id, prompt_and_iterations, final_output,
          verification_grid_reference, action_plan, learner_note, saved_at
        `)
        .eq('id', submissionId)
        .maybeSingle();

      if (submissionError || !submission) {
        console.error('Chargement de la remise pour attestation impossible :', submissionError);
        setError("La remise finale demandée n’a pas pu être chargée.");
        setLoading(false);
        return;
      }

      const [reviewResult, bookingResult, positioningResult, profileResult] = await Promise.all([
        supabase
          .from('course_final_project_review_history')
          .select(`
            id, submission_id, user_id, course_id, submission_saved_at,
            need_and_audience_level, prompt_and_success_criteria_level,
            checks_and_risks_level, choices_and_limits_level,
            appreciation, improvement_areas, review_status, created_at
          `)
          .eq('submission_id', submission.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('course_booking_requests')
          .select(`
            id, user_id, course_id, delivery_mode, schedule_format, status, created_at,
            course_session_bookings(id, starts_at, ends_at, duration_minutes, status),
            course_session_attendance(
              id, booking_request_id, session_starts_at, session_ends_at,
              learner_confirmed_at, learner_signature_sha256,
              trainer_status, actual_ends_at, trainer_validated_at,
              trainer_signature_sha256, locked_at
            )
          `)
          .eq('user_id', submission.user_id)
          .eq('course_id', submission.course_id)
          .maybeSingle(),
        supabase
          .from('course_positioning_assessments')
          .select('learner_name')
          .eq('user_id', submission.user_id)
          .eq('course_id', submission.course_id)
          .eq('is_initial', true)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('email')
          .eq('id', submission.user_id)
          .maybeSingle(),
      ]);

      const loadError = reviewResult.error
        || bookingResult.error
        || positioningResult.error
        || profileResult.error;
      if (loadError) {
        console.error("Chargement du dossier d’attestation impossible :", loadError);
        setError("Les preuves nécessaires à l’attestation n’ont pas pu être rassemblées.");
        setLoading(false);
        return;
      }

      setRecord({
        submission,
        review: reviewResult.data || null,
        booking: bookingResult.data || null,
        learnerName: positioningResult.data?.learner_name || profileResult.data?.email || '',
        learnerEmail: profileResult.data?.email || '',
      });
      setLoading(false);
    }

    loadAttestationData();
  }, [documentType, navigate, role, submissionId, typeConfig, user]);

  const documentData = useMemo(() => {
    if (!record || !typeConfig) return null;
    const course = courseCatalog[record.submission.course_id];
    const booking = record.booking;
    const sessions = booking
      ? groupBookedSessions(booking.course_session_bookings || [], booking.schedule_format)
      : [];
    const dossier = buildAttestationDossier({
      learnerName: record.learnerName,
      learnerEmail: record.learnerEmail,
      booking,
      sessions,
      attendanceRecords: booking?.course_session_attendance || [],
      finalReview: record.review,
    });
    const isReady = documentType === 'realisation' ? dossier.realizationReady : dossier.competencyReady;
    const rubric = course?.finalProject?.rubric || [];
    const levels = course?.finalProject?.rubricLevels || [];
    const criteria = rubric.map((criterion) => {
      const field = FINAL_PROJECT_REVIEW_FIELDS.find((candidate) => candidate.rubricId === criterion.id);
      const levelId = field ? record.review?.[field.column] : null;
      return {
        id: criterion.id,
        label: criterion.criterion,
        level: levels.find((level) => level.id === levelId)?.label || 'Non évalué',
      };
    });

    return {
      course,
      booking,
      dossier,
      criteria,
      isReady,
      missingRequirements: documentType === 'realisation'
        ? dossier.realizationMissingRequirements
        : dossier.competencyMissingRequirements,
      attestationConfig: COURSE_ATTESTATION_CONFIG[record.submission.course_id],
    };
  }, [documentType, record, typeConfig]);

  const snapshot = useMemo(() => createAttestationSnapshot({
    documentType,
    record,
    documentData,
  }), [documentData, documentType, record]);

  async function issueAttestation() {
    if (!documentData?.isReady || !snapshot || !record || !user) return;
    setIssuing(true);
    setError('');

    const existingResult = await supabase
      .from('course_attestation_issuances')
      .select('id')
      .eq('submission_id', record.submission.id)
      .eq('document_type', documentType)
      .maybeSingle();

    if (existingResult.data?.id) {
      navigate(`/attestations/${existingResult.data.id}`);
      return;
    }
    if (existingResult.error) {
      console.error('Vérification du registre des attestations impossible :', existingResult.error);
      setError("Le registre des attestations n’a pas pu être vérifié.");
      setIssuing(false);
      return;
    }

    const issuedAt = new Date().toISOString();
    const reference = createAttestationReference({
      documentType,
      bookingId: documentData.booking?.id,
      reviewId: record.review?.id,
      issuedAt,
    });
    const { data: issuance, error: issuanceError } = await supabase
      .from('course_attestation_issuances')
      .insert({
        reference,
        user_id: record.submission.user_id,
        course_id: record.submission.course_id,
        document_type: documentType,
        submission_id: record.submission.id,
        review_id: documentType === 'competences' ? record.review?.id : null,
        booking_request_id: documentData.booking?.id,
        issued_by: user.id,
        content_snapshot: snapshot,
      })
      .select('id')
      .single();

    if (issuanceError) {
      if (issuanceError.code === '23505') {
        const { data: existingIssuance } = await supabase
          .from('course_attestation_issuances')
          .select('id')
          .eq('submission_id', record.submission.id)
          .eq('document_type', documentType)
          .maybeSingle();
        if (existingIssuance?.id) {
          navigate(`/attestations/${existingIssuance.id}`);
          return;
        }
      }
      console.error("Délivrance de l’attestation impossible :", issuanceError);
      setError("L’attestation n’a pas pu être inscrite dans le registre. Aucune attestation n’a été délivrée.");
      setIssuing(false);
      return;
    }

    navigate(`/attestations/${issuance.id}`);
  }

  if (!user || (role !== 'admin' && role !== 'employee')) return null;
  if (!typeConfig) {
    return (
      <main className="attestation-page">
        <p role="alert" className="attestation-error">Le type d’attestation demandé n’existe pas.</p>
      </main>
    );
  }

  return (
    <main className="attestation-page">
      <div className="attestation-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!documentData?.isReady || issuing}
          onClick={issueAttestation}
        >
          <FileCheck2 size={18} aria-hidden="true" />
          {issuing ? 'Délivrance en cours…' : 'Délivrer et ouvrir l’attestation'}
        </button>
        <button
          type="button"
          className="btn attestation-back-button"
          onClick={() => navigate('/admin?onglet=corrections')}
        >
          Retour aux évaluations
        </button>
      </div>

      {loading ? <p>Préparation du modèle d’attestation…</p> : error ? (
        <p role="alert" className="attestation-error">{error}</p>
      ) : documentData && (
        <>
          {!documentData.isReady && (
            <div className="attestation-warning" role="status">
              <strong>Aperçu uniquement : document non délivrable.</strong>
              <span>
                Éléments à compléter : {documentData.missingRequirements.join(' · ')}.
                La délivrance restera bloquée jusqu’à la finalisation des preuves requises.
              </span>
            </div>
          )}

          <AttestationPaper
            documentType={documentType}
            reference={null}
            issuedAt={null}
            snapshot={snapshot}
            isDraft={!documentData.isReady}
          />
        </>
      )}
    </main>
  );
}
