export const REQUEST_STATUS_LABELS = {
  new: 'Nouvelle',
  processing: 'En traitement',
  awaiting_client: 'Attente client',
  quote_sent: 'Devis envoyé',
  follow_up: 'Relance',
  won: 'Gagnée',
  lost: 'Perdue',
};

export const REQUEST_TYPE_LABELS = {
  individual: 'Particulier',
  professional: 'Professionnel',
  beneficiary: 'Bénéficiaire',
  funding: 'Demande de financement',
};

export const QUOTE_STATUS_LABELS = {
  draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', expired: 'Expiré',
};

export const COMMERCIAL_COURSES = {
  'formation-ia': { title: 'IA générative', durationMinutes: 600, priceAmountCents: 49700 },
  'formation-ia-act': { title: 'IA Act', durationMinutes: 240, priceAmountCents: 18700 },
  'formation-prompt-level-1': { title: 'Prompt Engineering – Niveau 1', durationMinutes: 420, priceAmountCents: 34300 },
};

export function filterCommercialRequests(requests, search, status) {
  const normalized = String(search || '').trim().toLocaleLowerCase('fr-FR');
  return requests.filter((request) => {
    if (status && request.status !== status) return false;
    if (!normalized) return true;
    return [request.name, request.email, request.organization_name, request.subject, request.message]
      .filter(Boolean).join(' ').toLocaleLowerCase('fr-FR').includes(normalized);
  });
}

export function defaultValidUntil(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDateTime(hoursFromNow = 24) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formatMoney(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(cents || 0) / 100);
}
