import { ADMINISTRATIVE_COURSES } from './trainingAdministration.js';
import { FORMAPROMPT_TAX } from './legalBusiness.js';

export const REQUEST_STATUSES = new Set([
  'new', 'processing', 'awaiting_client', 'quote_sent', 'follow_up', 'won', 'lost',
]);
export const REQUEST_TYPES = new Set(['individual', 'professional', 'beneficiary', 'funding']);
export const QUOTE_STATUSES = new Set(['draft', 'sent', 'accepted', 'refused', 'expired']);

function text(value, label, max = 4000, required = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && !normalized) throw new Error(`${label} requis.`);
  if (normalized.length > max) throw new Error(`${label} trop long.`);
  return normalized || null;
}

function email(value, label, required = false) {
  const normalized = text(value, label, 320, required)?.toLowerCase() || null;
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error(`${label} invalide.`);
  return normalized;
}

export function validateRequestUpdate(input = {}) {
  const status = text(input.status, 'Statut', 30, true);
  const requestType = text(input.requestType, 'Type de demande', 30, true);
  if (!REQUEST_STATUSES.has(status)) throw new Error('Statut invalide.');
  if (!REQUEST_TYPES.has(requestType)) throw new Error('Type de demande invalide.');
  const courseId = text(input.courseId, 'Formation', 100);
  if (courseId && !ADMINISTRATIVE_COURSES[courseId]) throw new Error('Formation invalide.');
  return {
    status,
    request_type: requestType,
    course_id: courseId,
    organization_name: text(input.organizationName, 'Organisation', 200),
    beneficiary_name: text(input.beneficiaryName, 'Bénéficiaire', 200),
    beneficiary_email: email(input.beneficiaryEmail, 'E-mail bénéficiaire'),
    funding_requested: Boolean(input.fundingRequested),
    administrative_notes: text(input.administrativeNotes, 'Notes administratives', 4000),
  };
}

export function validateQuoteInput(input = {}, request) {
  const courseId = text(input.courseId || request.course_id, 'Formation', 100, true);
  const course = ADMINISTRATIVE_COURSES[courseId];
  if (!course) throw new Error('Formation invalide.');
  const quantity = Number(input.quantity ?? 1);
  const unitPriceCents = Number(input.unitPriceCents ?? course.priceAmountCents);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Quantité invalide.');
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > 100000000) throw new Error('Prix invalide.');
  const validUntil = text(input.validUntil, 'Date de validité', 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || new Date(`${validUntil}T23:59:59Z`) < new Date()) {
    throw new Error('Date de validité invalide.');
  }
  return {
    client_name: text(input.clientName || request.name, 'Identité client', 200, true),
    client_email: email(input.clientEmail || request.email, 'E-mail client', true),
    organization_name: text(input.organizationName || request.organization_name, 'Organisation', 200),
    beneficiary_name: text(input.beneficiaryName || request.beneficiary_name, 'Bénéficiaire', 200),
    beneficiary_email: email(input.beneficiaryEmail || request.beneficiary_email, 'E-mail bénéficiaire'),
    course_id: courseId,
    course_title: course.title,
    quantity,
    unit_price_cents: unitPriceCents,
    valid_until: validUntil,
    draft_notes: text(input.draftNotes, 'Notes du devis', 2000),
    tax_statement: FORMAPROMPT_TAX.statement,
  };
}

export function buildQuoteSnapshot(quote, sentAt) {
  return {
    version: quote.version,
    quoteNumber: quote.quote_number,
    createdAt: quote.created_at,
    sentAt,
    validUntil: quote.valid_until,
    provider: {
      legalName: 'Thierry FREZARD EI', tradeName: 'FormaPrompt',
      address: '6 rue Webster, 62100 Calais, France', siret: '511 151 615 00016',
      activityDeclaration: '32620346362', email: 'thierry@formaprompt.com',
    },
    client: {
      name: quote.client_name, email: quote.client_email,
      organizationName: quote.organization_name,
    },
    beneficiary: { name: quote.beneficiary_name, email: quote.beneficiary_email },
    course: { id: quote.course_id, title: quote.course_title },
    pricing: {
      quantity: quote.quantity, unitPriceCents: quote.unit_price_cents,
      totalPriceCents: quote.quantity * quote.unit_price_cents,
      currency: quote.currency, taxStatement: quote.tax_statement,
    },
  };
}

export function buildQuoteEmail(snapshot) {
  const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(snapshot.pricing.totalPriceCents / 100);
  return {
    subject: `Devis FormaPrompt ${snapshot.quoteNumber}`,
    body: [
      `Bonjour ${snapshot.client.name},`, '',
      `Veuillez trouver les éléments du devis ${snapshot.quoteNumber}.`,
      `Formation : ${snapshot.course.title}`,
      `Quantité : ${snapshot.pricing.quantity}`,
      `Montant total : ${amount}`,
      snapshot.pricing.taxStatement,
      `Validité : ${new Date(snapshot.validUntil).toLocaleDateString('fr-FR')}`,
      '', 'Le devis complet reste disponible auprès de FormaPrompt.',
      'Cordialement,', 'Thierry FREZARD — FormaPrompt',
    ].join('\n'),
  };
}

export function communicationKey(kind, targetId, version = 1) {
  const normalized = `${kind}:${targetId}:${version}`.replace(/[^a-zA-Z0-9:._-]/g, '');
  if (normalized.length < 16 || normalized.length > 200) throw new Error('Clé de communication invalide.');
  return normalized;
}
