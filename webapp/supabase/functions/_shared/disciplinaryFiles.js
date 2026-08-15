export const DISCIPLINARY_BUCKET = 'disciplinary-evidence';
export const DISCIPLINARY_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DISCIPLINARY_SIGNED_URL_MAX_SECONDS = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['text/plain', 'txt'],
]);

function singleLine(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(`${label} est requis.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength || /[\r\n\0]/.test(cleaned)) {
    throw new Error(`${label} est invalide.`);
  }
  return cleaned;
}

export function validateDisciplinaryUuid(value, label = 'Identifiant') {
  const cleaned = singleLine(value, label, 36);
  if (!UUID_PATTERN.test(cleaned)) throw new Error(`${label} est invalide.`);
  return cleaned;
}

export function validateDisciplinaryReason(value) {
  const cleaned = singleLine(value, 'Le motif administratif', 2000);
  if (cleaned.length < 10) throw new Error('Le motif administratif doit contenir au moins 10 caractères.');
  return cleaned;
}

export function validateDisciplinaryFile(file) {
  if (!(file instanceof File)) throw new Error('La pièce jointe est requise.');
  if (file.size < 1 || file.size > DISCIPLINARY_MAX_FILE_SIZE) {
    throw new Error('La pièce jointe doit peser entre 1 octet et 10 Mo.');
  }
  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) throw new Error('Le format de la pièce jointe est interdit.');
  const originalName = singleLine(file.name, 'Le nom du fichier', 180);
  // Intentional: reject ASCII control characters in stored filenames.
  // eslint-disable-next-line no-control-regex
  if (/[\\/\x00-\x1F\x7F]/.test(originalName)) throw new Error('Le nom du fichier est invalide.');
  return { extension, mimeType: file.type, originalName, sizeBytes: file.size };
}

export function disciplinaryObjectPath(incidentId, fileId, extension) {
  return `${validateDisciplinaryUuid(incidentId, 'Incident')}/${validateDisciplinaryUuid(fileId, 'Pièce')}.${extension}`;
}

export function signedUrlLifetime(value) {
  const requested = Number(value);
  if (!Number.isInteger(requested) || requested < 30) return 60;
  return Math.min(requested, DISCIPLINARY_SIGNED_URL_MAX_SECONDS);
}

export function bytesToSha256Hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
