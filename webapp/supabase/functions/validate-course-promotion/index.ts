import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getPurchaseConfig } from '../_shared/purchaseConfig.js';
import {
  COURSE_PROMOTION,
  hasCoursePromotionInput,
  normalizeCoursePromotionCode,
} from '../_shared/coursePromotion.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function invalidPromotionResponse(catalogAmountCents: number) {
  return jsonResponse({
    valid: false,
    code: null,
    catalog_amount_cents: catalogAmountCents,
    discount_amount_cents: 0,
    final_amount_cents: catalogAmountCents,
    message: COURSE_PROMOTION.genericInvalidMessage,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise pour vérifier ce code.' }, 401);

    const body = await request.json().catch(() => ({}));
    const purchase = getPurchaseConfig(body?.course_id);
    if (!purchase) return jsonResponse({ error: 'Formation non disponible au paiement.' }, 400);
    const normalizedCode = normalizeCoursePromotionCode(body?.promo_code);
    if (!hasCoursePromotionInput(body?.promo_code) || !normalizedCode) {
      return invalidPromotionResponse(purchase.amountTotal);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user?.id || !user.email) {
      return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabaseAdmin.rpc('validate_promo_code_for_checkout', {
      p_code: normalizedCode,
      p_user_id: user.id,
      p_email: user.email,
      p_target_type: COURSE_PROMOTION.targetType,
      p_target_key: purchase.courseId,
      p_original_amount_cents: purchase.amountTotal,
    }).single();

    if (error?.code === 'P0001') {
      return invalidPromotionResponse(purchase.amountTotal);
    }
    if (error) throw error;
    if (!data?.valid || data.final_amount_cents <= 0) {
      return invalidPromotionResponse(purchase.amountTotal);
    }

    return jsonResponse({
      valid: true,
      code: data.normalized_code,
      catalog_amount_cents: purchase.amountTotal,
      discount_amount_cents: data.discount_amount_cents,
      final_amount_cents: data.final_amount_cents,
      message: 'Code promotionnel appliqué.',
    });
  } catch (error) {
    console.error('Validation promotionnelle formation impossible :', error instanceof Error ? error.name : 'Erreur inconnue');
    return jsonResponse({ error: 'La vérification du code est temporairement indisponible.' }, 500);
  }
});
