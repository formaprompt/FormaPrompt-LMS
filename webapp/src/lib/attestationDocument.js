export const ATTESTATION_TYPES = {
  realisation: {
    title: 'Attestation de réalisation',
    shortCode: 'REA',
  },
  competences: {
    title: 'Attestation de compétences',
    shortCode: 'COMP',
  },
};

function normalizeReferencePart(value, minimumLength = 8) {
  const normalized = String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!normalized) return 'INCONNU';
  return normalized.length >= minimumLength
    ? normalized.slice(-minimumLength)
    : normalized.padStart(minimumLength, '0');
}

export function resolveAttestationIssuedAt(documentType, dossier, finalReview) {
  if (documentType === 'competences') return finalReview?.created_at || null;
  if (documentType !== 'realisation') return null;

  const validationDates = (dossier?.sessionProofs || [])
    .map((proof) => proof.trainerValidatedAt)
    .filter(Boolean)
    .sort((first, second) => new Date(first) - new Date(second));
  return validationDates.at(-1) || null;
}

export function createAttestationReference({ documentType, bookingId, reviewId, issuedAt }) {
  const type = ATTESTATION_TYPES[documentType];
  if (!type || !issuedAt) return null;

  const year = new Date(issuedAt).getUTCFullYear();
  if (!Number.isInteger(year)) return null;
  const sourceId = documentType === 'competences' ? reviewId : bookingId;

  return `FP-${type.shortCode}-${year}-${normalizeReferencePart(sourceId)}`;
}

export function formatAttestationPeriod(sessionProofs = []) {
  if (sessionProofs.length === 0) return 'Dates non disponibles';
  const sorted = [...sessionProofs].sort((first, second) => new Date(first.startsAt) - new Date(second.startsAt));
  const firstDate = new Date(sorted[0].startsAt);
  const lastDate = new Date(sorted.at(-1).endsAt);
  const dateOptions = { day: '2-digit', month: 'long', year: 'numeric' };

  if (firstDate.toLocaleDateString('fr-CA') === lastDate.toLocaleDateString('fr-CA')) {
    return `Le ${firstDate.toLocaleDateString('fr-FR', dateOptions)}`;
  }
  return `Du ${firstDate.toLocaleDateString('fr-FR', dateOptions)} au ${lastDate.toLocaleDateString('fr-FR', dateOptions)}`;
}
