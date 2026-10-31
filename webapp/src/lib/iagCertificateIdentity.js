export const DECLARATION_VERSION = 'iag-identity-declaration-v1';
export function identityError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
function hasControlCharacter(value) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}
export function normalizeDeclaredIdentity({ firstName, lastName }) {
  if (typeof firstName !== 'string' || typeof lastName !== 'string') throw identityError('IAG_IDENTITY_INVALID');
  if ([firstName,lastName].some(value => hasControlCharacter(value))) throw identityError('IAG_IDENTITY_INVALID');
  const names = [firstName, lastName].map(value => value.trim().replace(/\s+/gu, ' '));
  if (names.some(value => value.length < 1 || value.length > 100 || (value.includes('@') || hasControlCharacter(value))
    || value.includes('://') || ['apprenant','inconnu'].includes(value.toLowerCase()))
    || names.join(' ').length > 200) throw identityError('IAG_IDENTITY_INVALID');
  return { firstName:names[0], lastName:names[1] };
}
// Pure protocol model used by the in-memory integration fixture, not a DB lock.
export function identityRevisionDecision(current, input, expectedIdentityId, hasIssuance) {
  const normalized = normalizeDeclaredIdentity(input);
  if (current && current.firstName === normalized.firstName && current.lastName === normalized.lastName) return 'replay';
  if (hasIssuance) throw identityError('IAG_IDENTITY_FROZEN');
  if ((current?.id || null) !== (expectedIdentityId || null)) throw identityError('IAG_IDENTITY_CONFLICT');
  return 'append';
}
