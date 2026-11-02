const REPLACEMENTS = {
  '.': ' [point] ', ':': ' [deux-points] ', '/': ' [barre] ',
  '\\': ' [antislash] ', '@': ' [arobase] ',
};

// Transform every field, rather than trying to recognise all URL spellings.
// Visible tokens survive copying and do not depend on invisible zero-width
// characters or client-specific CSS. The database original is never changed.
export function inertContactText(value, limit = 12000) {
  const input = typeof value === 'string' ? value : '';
  // Do not cut a valid surrogate pair at the raw input bound.
  const bounded = input.slice(0, 20000).replace(/[\ud800-\udbff]$/u, '');
  const normalized = bounded.normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) => char === '\n' ? '\n' : ' ')
    .replace(/[\u3002\uff61\u2024\u2027\u2219]/g, '.').trim();
  let text = '', truncated = input.length > 20000;
  for (const char of normalized) {
    const token = REPLACEMENTS[char] || char;
    if (text.length + token.length > limit) { truncated = true; break; }
    text += token;
  }
  if (!text) text = '(non renseigné)';
  if (truncated) text += '\n[Extrait tronqué ; original complet dans l’administration.]';
  return text;
}

export function escapeNotificationHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function contactNotificationFields(contact) {
  const types = {
    individual: 'Particulier', professional: 'Professionnel / entreprise',
    beneficiary: 'Bénéficiaire', funding: 'Demande de financement',
  };
  return [
    ['Nature', Object.hasOwn(types, contact.request_type) ? types[contact.request_type] : 'Non précisée'],
    ['Objet saisi', inertContactText(contact.subject, 800)],
    ['Nom déclaré', inertContactText(contact.name, 400)],
    ['Adresse déclarée', inertContactText(contact.email, 600)],
    ['Message reçu', inertContactText(contact.message)],
  ];
}
