import { sendCommercialEmail, smtpFailureCode } from './smtpReceipt.js';
import { buildDiagnosticPromoEvidence, diagnosticEvidenceEuros } from './diagnosticContractEvidence.js';

// Une reprise avant 15 minutes risquerait de doubler un envoi SMTP encore en
// cours. Cinq tentatives automatiques au maximum bornent les rejouages Stripe.
export const DIAGNOSTIC_CONTRACT_DELIVERY_STALE_AFTER_MS = 15 * 60 * 1000;
export const DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS = 5;
export const DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING = 'diagnostic_contract_confirmation_retry_pending';

export function diagnosticContractDeliveryClaimFilter(now = new Date()) {
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('diagnostic_delivery_claim_time_invalid');
  const staleBefore = new Date(
    current.getTime() - DIAGNOSTIC_CONTRACT_DELIVERY_STALE_AFTER_MS,
  ).toISOString();
  return `contract_confirmation_delivery_status.eq.pending,and(contract_confirmation_delivery_status.in.(failed,sending),contract_confirmation_delivery_attempted_at.lt.${staleBefore})`;
}

export function isDiagnosticContractDeliveryRetryable(order) {
  return ['failed', 'sending'].includes(order?.contract_confirmation_delivery_status)
    && Number.isInteger(order?.contract_confirmation_delivery_attempts)
    && order.contract_confirmation_delivery_attempts < DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS;
}

export function buildDiagnosticContractConfirmationMessage({ order, cgv, withdrawalForm, acceptance }) {
  if (!Number.isInteger(order.amount_total) || order.amount_total <= 0 || order.amount_total > 14_900) {
    throw new Error('diagnostic_paid_amount_invalid');
  }
  const paidAmount = order.amount_total === 14_900 ? '149 €'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(order.amount_total / 100);
  let promoLines = [];
  if (order.promo_redemption_id) {
    const expected = buildDiagnosticPromoEvidence(order);
    if (order.amount_total !== order.final_amount_cents
      || acceptance?.legal_document_version_id !== order.cgv_acceptance_statement_version_id
      || acceptance?.legal_document_versions?.version !== expected.version
      || acceptance?.acceptance_text !== expected.text) {
      throw new Error('diagnostic_contract_evidence_invalid');
    }
    promoLines = [
      `Prix catalogue : ${diagnosticEvidenceEuros(order.original_amount_cents)}`,
      `Remise promotionnelle : ${diagnosticEvidenceEuros(order.discount_amount_cents)}`,
      `Modèle de preuve transactionnelle : ${expected.version}`,
      acceptance.acceptance_text,
    ];
  } else if (order.amount_total !== 14900) {
    throw new Error('diagnostic_paid_amount_invalid');
  }
  const paidAt = new Date(order.paid_at);
  if (Number.isNaN(paidAt.getTime())) throw new Error('diagnostic_paid_at_invalid');
  const paidLabel = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(paidAt);
  const body = [
    'FormaPrompt — Confirmation contractuelle du Diagnostic IA Express',
    '',
    'Votre paiement a été confirmé côté serveur.',
    `Référence de commande : ${order.id}`,
    `Date de conclusion du contrat : ${paidLabel}`,
    'Prestation : Diagnostic IA Express — rendez-vous de 90 minutes en visioconférence et remise d’un Plan d’action IA FormaPrompt personnalisé.',
    `Prix total payé : ${paidAmount}`,
    ...promoLines,
    'TVA non applicable - article 293 B du CGI',
    'Prochaine étape : choisissez votre créneau parmi les disponibilités proposées par FormaPrompt.',
    '',
    `Conditions contractuelles acceptées : ${cgv.version}`,
    '',
    cgv.content_text,
  ];
  if (order.sales_context === 'personal' && withdrawalForm) {
    body.push('', withdrawalForm.content_text, '', 'Formulaire électronique : https://formaprompt.com/retractation');
  }
  return {
    recipientEmail: order.customer_email,
    subject: `Confirmation de votre Diagnostic IA Express — ${order.id}`,
    body: body.join('\n'),
    messageId: `diagnostic-contract-${order.id}`,
  };
}

export async function attemptDiagnosticContractConfirmationDelivery(input, {
  send = sendCommercialEmail,
  now = () => new Date().toISOString(),
} = {}) {
  const attemptedAt = now();
  try {
    await send(buildDiagnosticContractConfirmationMessage(input));
    return {
      contract_confirmation_delivery_status: 'sent',
      contract_confirmation_delivered_at: now(),
      contract_confirmation_delivery_attempted_at: attemptedAt,
      contract_confirmation_delivery_attempts: (input.order.contract_confirmation_delivery_attempts || 0) + 1,
      contract_confirmation_delivery_error_code: null,
    };
  } catch (error) {
    return {
      contract_confirmation_delivery_status: 'failed',
      contract_confirmation_delivered_at: null,
      contract_confirmation_delivery_attempted_at: attemptedAt,
      contract_confirmation_delivery_attempts: (input.order.contract_confirmation_delivery_attempts || 0) + 1,
      contract_confirmation_delivery_error_code: smtpFailureCode(error),
    };
  }
}
