import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { COURSE_ATTESTATION_CONFIG, FORMATION_ORGANIZATION } from '../data/attestationConfig';
import { courseCatalog } from '../data/courseCatalog';
import { buildAttestationDossier, formatAttestationDuration } from '../lib/attestationDossier';
import {
  ATTESTATION_TYPES,
  createAttestationReference,
  formatAttestationPeriod,
  resolveAttestationIssuedAt,
} from '../lib/attestationDocument';
import { groupBookedSessions } from '../lib/courseBookingSlots';
import { FINAL_PROJECT_REVIEW_FIELDS } from '../lib/finalProjectEvaluation';
import { supabase } from '../lib/supabaseClient';
import './AttestationDocument.css';

const BOOKING_FORMAT_LABELS = {
  two_5h: '2 séances de 5 h',
  four_2h30: '4 séances de 2 h 30',
  three_4h_4h_2h: '3 séances : 4 h + 4 h + 2 h',
};

const REVIEW_STATUS_LABELS = {
  needs_revision: 'Acquis à consolider – nouvelle remise attendue',
  validated: 'Compétences évaluées et validées',
};

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'En attente de finalisation';
}

function formatDeliveryMode(booking) {
  if (!booking) return 'Modalité non disponible';
  const mode = booking.delivery_mode === 'remote' ? 'Distanciel synchrone' : 'Présentiel';
  const format = BOOKING_FORMAT_LABELS[booking.schedule_format] || booking.schedule_format;
  return `${mode} · ${format}`;
}

export default function AttestationDocument() {
  const { submissionId, documentType } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    const issuedAt = isReady ? resolveAttestationIssuedAt(documentType, dossier, record.review) : null;
    const reference = isReady ? createAttestationReference({
      documentType,
      bookingId: booking?.id,
      reviewId: record.review?.id,
      issuedAt,
    }) : null;
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
      issuedAt,
      reference,
      criteria,
      isReady,
      missingRequirements: documentType === 'realisation'
        ? dossier.realizationMissingRequirements
        : dossier.competencyMissingRequirements,
      attestationConfig: COURSE_ATTESTATION_CONFIG[record.submission.course_id],
    };
  }, [documentType, record, typeConfig]);

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
          disabled={!documentData?.isReady}
          onClick={() => window.print()}
        >
          <Printer size={18} aria-hidden="true" /> Imprimer ou enregistrer en PDF
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
                Le bouton d’impression restera bloqué jusqu’à la finalisation des preuves requises.
              </span>
            </div>
          )}

          <article className={`attestation-paper ${documentData.isReady ? '' : 'is-draft'}`}>
            {!documentData.isReady && <div className="attestation-watermark" aria-hidden="true">BROUILLON</div>}

            <header className="attestation-paper__header">
              <img src="/assets/logo-new.png" alt="FormaPrompt" />
              <div>
                <p>{FORMATION_ORGANIZATION.legalName}</p>
                <span>{FORMATION_ORGANIZATION.address}</span>
                <span>SIRET : {FORMATION_ORGANIZATION.siret}</span>
              </div>
              <dl>
                <div><dt>Référence</dt><dd>{documentData.reference || 'En attente'}</dd></div>
                <div><dt>Délivrée le</dt><dd>{formatDate(documentData.issuedAt)}</dd></div>
              </dl>
            </header>

            <section className="attestation-paper__title">
              <p>Action de formation professionnelle</p>
              <h1>{typeConfig.title}</h1>
              {documentType === 'competences' && (
                <span>Évaluation des acquis – formation non certifiante</span>
              )}
            </section>

            <p className="attestation-paper__statement">
              Je soussigné <strong>{FORMATION_ORGANIZATION.trainerName}</strong>, formateur et responsable de
              l’organisme {FORMATION_ORGANIZATION.brandName}, atteste que :
            </p>

            <section className="attestation-paper__identity" aria-label="Identité et formation">
              <div><strong>Apprenant</strong><span>{record.learnerName}</span></div>
              <div><strong>Formation</strong><span>{documentData.course?.title || record.submission.course_id}</span></div>
              <div><strong>Nature de l’action</strong><span>{documentData.attestationConfig?.nature || 'Action de formation'}</span></div>
              <div><strong>Période</strong><span>{formatAttestationPeriod(documentData.dossier.sessionProofs)}</span></div>
              <div><strong>Modalité</strong><span>{formatDeliveryMode(documentData.booking)}</span></div>
              <div>
                <strong>Durée</strong>
                <span>
                  {formatAttestationDuration(documentData.dossier.attendedMinutes)} réellement suivie
                  {documentData.dossier.plannedMinutes > 0
                    ? ` sur ${formatAttestationDuration(documentData.dossier.plannedMinutes)} planifiées`
                    : ''}
                </span>
              </div>
            </section>

            <section className="attestation-paper__section">
              <h2>Objectifs pédagogiques</h2>
              <ul>
                {(documentData.attestationConfig?.objectives || []).map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </section>

            {documentType === 'realisation' ? (
              <section className="attestation-paper__result">
                <h2>Réalisation de la formation</h2>
                <p>
                  Les {documentData.dossier.sessionCount} séances planifiées disposent d’un émargement apprenant
                  et d’une validation du formateur. La durée indiquée correspond au temps réellement suivi et
                  constaté dans les feuilles d’émargement.
                </p>
              </section>
            ) : (
              <section className="attestation-paper__section attestation-paper__evaluation">
                <div className="attestation-paper__evaluation-heading">
                  <h2>Résultats de l’évaluation des acquis</h2>
                  <strong>{REVIEW_STATUS_LABELS[record.review?.review_status] || 'Évaluation en attente'}</strong>
                </div>
                <table>
                  <thead><tr><th>Critère évalué</th><th>Niveau observé</th></tr></thead>
                  <tbody>
                    {documentData.criteria.map((criterion) => (
                      <tr key={criterion.id}><td>{criterion.label}</td><td>{criterion.level}</td></tr>
                    ))}
                  </tbody>
                </table>
                {record.review && (
                  <div className="attestation-paper__feedback">
                    <p><strong>Appréciation :</strong> {record.review.appreciation}</p>
                    <p><strong>Axes de progrès :</strong> {record.review.improvement_areas}</p>
                  </div>
                )}
                <p className="attestation-paper__non-certifying">
                  Cette attestation décrit le résultat d’une évaluation interne. Elle ne constitue ni un diplôme,
                  ni un titre professionnel, ni une certification enregistrée au RNCP ou au Répertoire spécifique.
                </p>
              </section>
            )}

            <section className="attestation-paper__signature">
              <div>
                <span>Fait à Calais, le {formatDate(documentData.issuedAt)}</span>
                <strong>{FORMATION_ORGANIZATION.trainerName}</strong>
                <small>Formateur et responsable pédagogique</small>
              </div>
              <div className="attestation-paper__signature-box">
                <span>Signature</span>
              </div>
            </section>

            <footer className="attestation-paper__footer">
              <p>
                Enregistrée sous le numéro {FORMATION_ORGANIZATION.activityDeclarationNumber}.
                Cet enregistrement ne vaut pas agrément de l’État.
              </p>
              <p>{FORMATION_ORGANIZATION.email} · {FORMATION_ORGANIZATION.website}</p>
              <details>
                <summary>Références internes de traçabilité</summary>
                <span>Réservation : {documentData.booking?.id || '—'}</span>
                <span>Remise finale : {record.submission.id}</span>
                <span>Évaluation : {record.review?.id || '—'}</span>
                <span>
                  Émargements : {documentData.dossier.sessionProofs.map((proof) => proof.attendanceId).filter(Boolean).join(', ') || '—'}
                </span>
              </details>
            </footer>
          </article>
        </>
      )}
    </main>
  );
}
