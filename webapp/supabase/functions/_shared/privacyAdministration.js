const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanSingleLine(value, field, maxLength) {
  if (typeof value !== 'string') throw new Error(`${field} est requis.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength || /[\r\n\0]/.test(cleaned)) {
    throw new Error(`${field} est invalide.`);
  }
  return cleaned;
}

export function validatePrivacyExecutionInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La demande est invalide.');
  }

  const requestId = cleanSingleLine(value.requestId, 'La demande RGPD', 36);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new Error('La demande RGPD est invalide.');

  const confirmation = cleanSingleLine(value.confirmation, 'La confirmation', 180);
  if (!confirmation.startsWith('EFFACER ')) {
    throw new Error('La confirmation irréversible est invalide.');
  }

  const reason = cleanSingleLine(value.reason, 'Le motif administratif', 2000);
  if (reason.length < 10) throw new Error('Le motif administratif doit contenir au moins 10 caractères.');

  return { requestId, confirmation, reason };
}

export function privacyExecutionErrorCode(error) {
  const message = error instanceof Error ? error.message : '';
  if (/invalide|requis|au moins|confirmation/i.test(message)) return 'invalid_request';
  return 'processing_failed';
}
