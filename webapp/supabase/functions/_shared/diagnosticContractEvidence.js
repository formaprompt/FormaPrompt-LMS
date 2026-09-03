// Version du modele de preuve transactionnelle, pas une nouvelle version des CGV.
export const DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION = 'DIAGNOSTIC-CGV-ACCEPTANCE-PROMO-2026-09-03';

export function diagnosticEvidenceEuros(cents) {
  if (!Number.isInteger(cents) || cents < 0 || cents > 14900) {
    throw new Error('diagnostic_evidence_amount_invalid');
  }
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`;
}

export function buildDiagnosticPromoEvidence({ original_amount_cents, discount_amount_cents, final_amount_cents, currency = 'eur' }) {
  if (original_amount_cents !== 14900 || currency !== 'eur'
    || !Number.isInteger(discount_amount_cents) || discount_amount_cents <= 0
    || !Number.isInteger(final_amount_cents) || final_amount_cents <= 0
    || discount_amount_cents + final_amount_cents !== original_amount_cents) {
    throw new Error('diagnostic_evidence_amount_invalid');
  }
  const final = diagnosticEvidenceEuros(final_amount_cents);
  return {
    version: DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION,
    text: "J'accepte les Conditions générales de vente applicables au Diagnostic IA Express. "
      + `Prix catalogue : ${diagnosticEvidenceEuros(original_amount_cents)}. `
      + `Remise promotionnelle : ${diagnosticEvidenceEuros(discount_amount_cents)}. `
      + `Montant total de ma commande : ${final}. Je reconnais que ma commande m'oblige au paiement de ${final}.`,
  };
}
