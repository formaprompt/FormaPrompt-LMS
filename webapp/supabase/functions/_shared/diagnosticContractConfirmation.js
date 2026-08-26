import { sendCommercialEmail, smtpFailureCode } from './smtpReceipt.js';

export function buildDiagnosticContractConfirmationMessage({ order, cgv, withdrawalForm }) {
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
    'Prix total payé : 149 €',
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
