export const STRIPE_TRANSACTION_STATUS_LABELS = Object.freeze({
  created: 'Créée',
  processing: 'En traitement',
  paid: 'Payée',
  failed: 'Échouée',
  expired: 'Checkout expiré',
  partially_refunded: 'Partiellement remboursée',
  refunded: 'Remboursée',
  disputed: 'En litige',
  dispute_won: 'Litige gagné — revue requise',
  dispute_lost: 'Litige perdu',
});

export const STRIPE_CASE_STATUS_LABELS = Object.freeze({
  pending: 'À examiner',
  reviewed: 'Examiné',
  resolved: 'Résolu',
  dismissed: 'Classé sans suite',
});

export const STRIPE_CASE_TYPE_LABELS = Object.freeze({
  duplicate_payment: 'Doublon de paiement',
  orphan_transaction: 'Transaction orpheline',
  orphan_refund: 'Remboursement orphelin',
  orphan_dispute: 'Litige orphelin',
  partial_refund: 'Remboursement partiel',
  refund_failed: 'Remboursement échoué',
  refund_access_mismatch: 'Remboursement sans droit concordant',
  dispute_won_review: 'Litige gagné à vérifier',
  amount_mismatch: 'Montant ou devise incohérent',
  purchase_without_transaction: 'Achat sans transaction',
  missing_course_access: 'Droit pédagogique manquant',
  active_after_total_refund: 'Droit actif après remboursement',
  status_mismatch: 'Statuts incohérents',
  stripe_remote_payment_missing_local: 'Paiement Stripe absent localement',
  stripe_remote_mismatch: 'Écart Stripe/local',
  local_payment_missing_stripe: 'Transaction locale absente de Stripe',
  unvalidated_payment: 'Paiement à preuve commerciale incomplète',
  travel_fee_payment_mismatch: 'Frais de déplacement incohérents',
});

export function formatStripeMoney(amount, currency = 'eur') {
  if (!Number.isInteger(amount)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: typeof currency === 'string' ? currency.toUpperCase() : 'EUR',
  }).format(amount / 100);
}

export function filterStripeRows(rows, search) {
  const needle = search.trim().toLocaleLowerCase('fr-FR');
  if (!needle) return rows;
  return rows.filter((row) => JSON.stringify(row).toLocaleLowerCase('fr-FR').includes(needle));
}
