export const PROMOTION_TARGET_OPTIONS = [
  { target_type: 'all', target_key: 'all', label: 'Toutes les offres FormaPrompt' },
  { target_type: 'diagnostic', target_key: 'diagnostic-ia-express', label: 'Diagnostic IA Express' },
  { target_type: 'course', target_key: 'formation-ia', label: 'Formation IA générative' },
  { target_type: 'course', target_key: 'formation-ia-act', label: 'Formation IA Act' },
  { target_type: 'course', target_key: 'formation-prompt-level-1', label: 'Formation Prompt Engineering – Niveau 1' },
];

const GENERIC_ERROR = 'L’opération sur la promotion n’a pas abouti.';
const STABLE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,199}$/;

export function normalizePromotionCode(value) {
  return String(value || '').trim().toUpperCase();
}

export function parseEurosToCents(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [euros, decimals = ''] = normalized.split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatPromotionDiscount(promotion) {
  if (promotion?.discount_type === 'percent') {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(promotion.discount_value))} %`;
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
  }).format(Number(promotion?.discount_value || 0) / 100);
}

export function promotionStatus(promotion, now = new Date()) {
  if (!promotion?.active) return 'Inactive';
  const timestamp = now.getTime();
  if (promotion.starts_at && Date.parse(promotion.starts_at) > timestamp) return 'Planifiée';
  if (promotion.ends_at && Date.parse(promotion.ends_at) <= timestamp) return 'Expirée';
  if (promotion.remaining_uses === 0) return 'Quota atteint';
  return 'Active';
}

export function validatePromotionDraft(draft) {
  const errors = {};
  const code = normalizePromotionCode(draft.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) errors.code = 'Saisissez un code stable (lettres, chiffres, tiret ou underscore).';
  const discountValue = draft.discount_type === 'fixed_amount'
    ? parseEurosToCents(draft.discount_value)
    : Number(String(draft.discount_value).replace(',', '.'));
  if (draft.discount_type === 'percent') {
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) errors.discount_value = 'Le pourcentage doit être supérieur à 0 et inférieur ou égal à 100.';
  } else if (draft.discount_type === 'fixed_amount') {
    if (!Number.isInteger(discountValue) || discountValue <= 0) errors.discount_value = 'Le montant fixe doit être supérieur à 0.';
  } else {
    errors.discount_type = 'Type de remise invalide.';
  }
  if (draft.starts_at && draft.ends_at && Date.parse(draft.ends_at) <= Date.parse(draft.starts_at)) errors.ends_at = 'La fin doit être postérieure au début.';

  const maxUses = draft.max_uses === '' ? null : Number(draft.max_uses);
  const perUser = draft.max_uses_per_user === '' ? null : Number(draft.max_uses_per_user);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) errors.max_uses = 'Le quota global doit être un entier positif.';
  if (perUser !== null && (!Number.isInteger(perUser) || perUser <= 0)) errors.max_uses_per_user = 'Le quota utilisateur doit être un entier positif.';
  if (maxUses !== null && perUser !== null && perUser > maxUses) errors.max_uses_per_user = 'Le quota utilisateur ne peut pas dépasser le quota global.';

  const minimum = draft.minimum_final_amount_cents === '' ? null : parseEurosToCents(draft.minimum_final_amount_cents);
  if (minimum !== null && (!Number.isInteger(minimum) || minimum < 0)) errors.minimum_final_amount_cents = 'Le montant final minimum doit être positif ou nul.';
  const email = String(draft.restricted_email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.restricted_email = 'Adresse e-mail invalide.';

  const targets = Array.isArray(draft.targets) ? draft.targets : [];
  if (!targets.length) errors.targets = 'Sélectionnez au moins une cible.';
  const fingerprints = new Set();
  for (const target of targets) {
    const fingerprint = `${target.target_type}:${target.target_key}`;
    if (!['all', 'diagnostic', 'course', 'product'].includes(target.target_type)
      || !STABLE_KEY_PATTERN.test(target.target_key || '')
      || (target.target_type === 'all' && target.target_key !== 'all')) errors.targets = 'Une cible est invalide.';
    if (fingerprints.has(fingerprint)) errors.targets = 'Une cible ne peut pas être ajoutée deux fois.';
    fingerprints.add(fingerprint);
  }
  if (targets.some((target) => target.target_type === 'all') && targets.length > 1) errors.targets = 'La cible globale ne peut pas être combinée avec une autre cible.';
  return errors;
}

export function promotionDraftToRpc(draft) {
  const errors = validatePromotionDraft(draft);
  if (Object.keys(errors).length) return { errors, parameters: null };
  return {
    errors,
    parameters: {
      p_code: normalizePromotionCode(draft.code),
      p_description: String(draft.description || '').trim() || null,
      p_discount_type: draft.discount_type,
      p_discount_value: draft.discount_type === 'fixed_amount'
        ? parseEurosToCents(draft.discount_value)
        : Number(String(draft.discount_value).replace(',', '.')),
      p_active: Boolean(draft.active),
      p_starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      p_ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      p_max_uses: draft.max_uses === '' ? null : Number(draft.max_uses),
      p_max_uses_per_user: draft.max_uses_per_user === '' ? null : Number(draft.max_uses_per_user),
      p_restricted_email: String(draft.restricted_email || '').trim().toLowerCase() || null,
      p_minimum_final_amount_cents: draft.minimum_final_amount_cents === ''
        ? null : parseEurosToCents(draft.minimum_final_amount_cents),
      p_targets: draft.targets.map(({ target_type, target_key }) => ({ target_type, target_key })),
    },
  };
}

function rpcError(error) {
  return new Error(error?.message || GENERIC_ERROR);
}

export async function listPromotions(client) {
  const { data, error } = await client.rpc('admin_list_promotions');
  if (error) throw rpcError(error);
  return Array.isArray(data) ? data : [];
}

export async function createPromotion(client, draft) {
  const result = promotionDraftToRpc(draft);
  if (!result.parameters) return result;
  const { data, error } = await client.rpc('admin_create_promotion', result.parameters);
  if (error) throw rpcError(error);
  return { errors: {}, data };
}

export async function updatePromotion(client, promotionId, draft) {
  const result = promotionDraftToRpc(draft);
  if (!result.parameters) return result;
  const parameters = { ...result.parameters };
  delete parameters.p_code;
  delete parameters.p_active;
  const { data, error } = await client.rpc('admin_update_promotion', {
    p_promo_code_id: promotionId,
    ...parameters,
  });
  if (error) throw rpcError(error);
  return { errors: {}, data };
}

export async function setPromotionActive(client, promotionId, active) {
  const { data, error } = await client.rpc('admin_set_promotion_active', {
    p_promo_code_id: promotionId,
    p_active: Boolean(active),
  });
  if (error) throw rpcError(error);
  return data;
}
