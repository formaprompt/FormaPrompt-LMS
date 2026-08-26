import { isUuid } from './purchaseConfig.js';

export function validateWithdrawalRequestPayload(payload) {
  const purchaseId = payload?.purchase_id;
  const diagnosticOrderId = payload?.diagnostic_order_id;
  if ((Boolean(purchaseId) === Boolean(diagnosticOrderId))
    || (purchaseId && !isUuid(purchaseId))
    || (diagnosticOrderId && !isUuid(diagnosticOrderId))) {
    return 'Commande invalide.';
  }
  if (!String(payload?.first_name || '').trim() || String(payload.first_name).trim().length > 100 || /[\r\n]/.test(String(payload.first_name))) {
    return 'Prénom invalide.';
  }
  if (!String(payload?.last_name || '').trim() || String(payload.last_name).trim().length > 100 || /[\r\n]/.test(String(payload.last_name))) {
    return 'Nom invalide.';
  }
  const email = String(payload?.acknowledgement_email || '').trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Adresse électronique invalide.';
  }
  const declaration = String(payload?.declaration || '').trim();
  if (declaration.length < 20 || declaration.length > 2000) {
    return 'La déclaration doit exprimer clairement la volonté de se rétracter.';
  }
  return null;
}
