const ATTENDED_STATUSES = new Set(['present', 'partial']);
const ELIGIBLE_BOOKING_STATUSES = new Set(['confirmed', 'completed']);

function toTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function calculateMinutesBetween(start, end) {
  const startTimestamp = toTimestamp(start);
  const endTimestamp = toTimestamp(end);
  if (startTimestamp === null || endTimestamp === null || endTimestamp <= startTimestamp) return 0;
  return Math.round((endTimestamp - startTimestamp) / 60_000);
}

function findAttendance(attendanceRecords, bookingId, session) {
  const sessionStart = toTimestamp(session.starts_at);
  const sessionEnd = toTimestamp(session.ends_at);

  return attendanceRecords.find((attendance) => (
    attendance.booking_request_id === bookingId
    && toTimestamp(attendance.session_starts_at) === sessionStart
    && toTimestamp(attendance.session_ends_at) === sessionEnd
  )) || null;
}

function calculateAttendedMinutes(session, attendance) {
  if (!attendance || !ATTENDED_STATUSES.has(attendance.trainer_status)) return 0;

  const plannedMinutes = calculateMinutesBetween(session.starts_at, session.ends_at);
  const actualEnd = attendance.trainer_status === 'partial'
    ? attendance.actual_ends_at
    : attendance.actual_ends_at || session.ends_at;
  const attendedMinutes = calculateMinutesBetween(session.starts_at, actualEnd);

  return Math.min(plannedMinutes, attendedMinutes);
}

function hasUsableLearnerName(name, email) {
  const normalizedName = name?.trim() || '';
  if (normalizedName.length < 3) return false;
  return normalizedName.toLocaleLowerCase('fr-FR') !== (email?.trim() || '').toLocaleLowerCase('fr-FR');
}

export function formatAttestationDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 h';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes}`;
}

export function buildAttestationDossier({
  learnerName,
  learnerEmail,
  booking,
  sessions = [],
  attendanceRecords = [],
  finalReview,
}) {
  const sessionProofs = sessions.map((session) => {
    const attendance = booking ? findAttendance(attendanceRecords, booking.id, session) : null;
    const learnerSigned = Boolean(attendance?.learner_signature_sha256 && attendance?.learner_confirmed_at);
    const trainerSigned = Boolean(attendance?.trainer_signature_sha256 && attendance?.trainer_validated_at);
    const presenceValidated = ATTENDED_STATUSES.has(attendance?.trainer_status);
    const proofComplete = learnerSigned && trainerSigned && presenceValidated && Boolean(attendance?.locked_at);

    return {
      attendanceId: attendance?.id || null,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      trainerStatus: attendance?.trainer_status || 'pending',
      learnerSigned,
      trainerSigned,
      proofComplete,
      trainerValidatedAt: attendance?.trainer_validated_at || null,
      plannedMinutes: calculateMinutesBetween(session.starts_at, session.ends_at),
      attendedMinutes: calculateAttendedMinutes(session, attendance),
    };
  });

  const identityComplete = hasUsableLearnerName(learnerName, learnerEmail) && Boolean(learnerEmail?.trim());
  const bookingEligible = Boolean(booking && ELIGIBLE_BOOKING_STATUSES.has(booking.status));
  const attendanceComplete = sessionProofs.length > 0 && sessionProofs.every((proof) => proof.proofComplete);
  const finalEvaluationValidated = finalReview?.review_status === 'validated';
  const plannedMinutes = sessionProofs.reduce((total, proof) => total + proof.plannedMinutes, 0);
  const attendedMinutes = sessionProofs.reduce((total, proof) => total + proof.attendedMinutes, 0);
  const realizationReady = identityComplete && bookingEligible && attendanceComplete;
  const competencyReady = realizationReady && finalEvaluationValidated;

  const realizationMissingRequirements = [];
  if (!identityComplete) realizationMissingRequirements.push("nom complet de l’apprenant");
  if (!booking) realizationMissingRequirements.push('réservation des séances');
  else if (!bookingEligible) realizationMissingRequirements.push('réservation confirmée ou terminée');
  if (sessionProofs.length === 0) realizationMissingRequirements.push('séances planifiées');
  else if (!attendanceComplete) realizationMissingRequirements.push('émargements apprenant et formateur finalisés');

  const competencyMissingRequirements = [...realizationMissingRequirements];
  if (!finalReview) competencyMissingRequirements.push('évaluation finale du formateur');
  else if (!finalEvaluationValidated) competencyMissingRequirements.push('évaluation finale validée');

  return {
    identityComplete,
    bookingEligible,
    attendanceComplete,
    finalEvaluationValidated,
    realizationReady,
    competencyReady,
    plannedMinutes,
    attendedMinutes,
    completedSessionCount: sessionProofs.filter((proof) => proof.proofComplete).length,
    sessionCount: sessionProofs.length,
    sessionProofs,
    realizationMissingRequirements,
    competencyMissingRequirements,
    missingRequirements: competencyMissingRequirements,
  };
}
