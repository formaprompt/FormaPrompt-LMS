import { FORMATION_ORGANIZATION } from '../data/attestationConfig.js';
import { ATTESTATION_TYPES, formatAttestationPeriod } from './attestationDocument.js';

const BOOKING_FORMAT_LABELS = {
  two_5h: '2 séances de 5 h',
  four_2h30: '4 séances de 2 h 30',
  three_4h_4h_2h: '3 séances : 4 h + 4 h + 2 h',
  one_4h: '1 séance de 4 h',
  two_2h: '2 séances de 2 h',
  four_1h: '4 séances de 1 h',
};

const REVIEW_STATUS_LABELS = {
  needs_revision: 'Acquis à consolider – nouvelle remise attendue',
  validated: 'Compétences évaluées et validées',
};

export function formatAttestationDeliveryMode(booking) {
  if (!booking) return 'Modalité non disponible';
  const mode = booking.delivery_mode === 'remote' ? 'Distanciel synchrone' : 'Présentiel';
  const format = BOOKING_FORMAT_LABELS[booking.schedule_format] || booking.schedule_format;
  return `${mode} · ${format}`;
}

export function createAttestationSnapshot({ documentType, record, documentData }) {
  const typeConfig = ATTESTATION_TYPES[documentType];
  if (!typeConfig || !record || !documentData) return null;

  const review = record.review || null;
  const traceability = {
    bookingId: documentData.booking?.id || '',
    submissionId: String(record.submission.id),
    reviewId: documentType === 'competences' && review?.id ? String(review.id) : '',
    attendanceIds: documentData.dossier.sessionProofs
      .map((proof) => proof.attendanceId)
      .filter(Boolean),
  };

  return {
    version: 1,
    title: typeConfig.title,
    learnerName: record.learnerName,
    courseTitle: documentData.course?.title || record.submission.course_id,
    nature: documentData.attestationConfig?.nature || 'Action de formation',
    period: formatAttestationPeriod(documentData.dossier.sessionProofs),
    deliveryMode: formatAttestationDeliveryMode(documentData.booking),
    attendedMinutes: documentData.dossier.attendedMinutes,
    plannedMinutes: documentData.dossier.plannedMinutes,
    objectives: [...(documentData.attestationConfig?.objectives || [])],
    sessionCount: documentData.dossier.sessionCount,
    organization: { ...FORMATION_ORGANIZATION },
    evaluation: documentType === 'competences' ? {
      statusLabel: REVIEW_STATUS_LABELS[review?.review_status] || 'Évaluation en attente',
      criteria: documentData.criteria.map((criterion) => ({ ...criterion })),
      appreciation: review?.appreciation || '',
      improvementAreas: review?.improvement_areas || '',
    } : null,
    traceability,
  };
}
