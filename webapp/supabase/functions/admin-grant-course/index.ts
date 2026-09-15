import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { ADMIN_GIFT_COURSES } from '../_shared/purchaseConfig.js';

const ALLOWED_COURSE_IDS = new Set(Object.keys(ADMIN_GIFT_COURSES));

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return jsonResponse({ error: 'Connexion administrateur requise.' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';

    if (!targetUserId || !ALLOWED_COURSE_IDS.has(courseId)) {
      return jsonResponse({ error: 'Apprenant ou formation invalide.' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !authData.user?.id) {
      return jsonResponse({ error: 'Session administrateur invalide ou expirée.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: administrator, error: administratorError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (administratorError) throw administratorError;
    if (administrator?.role !== 'admin') {
      return jsonResponse({ error: 'Cette action est réservée aux administrateurs.' }, 403);
    }

    const { data: learner, error: learnerError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (learnerError) throw learnerError;
    if (!learner) {
      return jsonResponse({ error: 'Le compte apprenant est introuvable.' }, 404);
    }

    const { data: existingAccess, error: existingAccessError } = await supabaseAdmin
      .from('course_access')
      .select('id, status, access_source, purchase_id, expires_at')
      .eq('user_id', targetUserId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existingAccessError) throw existingAccessError;
    const alreadyGranted = existingAccess?.status === 'active'
      && (!existingAccess.expires_at || new Date(existingAccess.expires_at) > new Date());

    const { data: grantedAccess, error: grantError } = await supabaseAuth
      .rpc('admin_grant_course_access', {
        p_target_user_id: targetUserId,
        p_course_id: courseId,
        p_reason: 'Attribution administrative depuis FormaPrompt',
      });

    if (grantError) {
      if (grantError.message?.includes('Un droit existe déjà')) {
        return jsonResponse({ error: grantError.message }, 409);
      }
      throw grantError;
    }

    console.info('Accès formation offert', {
      administratorId: administrator.id,
      targetUserId,
      courseId,
    });

    return jsonResponse({ granted: !alreadyGranted, alreadyGranted, access: grantedAccess }, alreadyGranted ? 200 : 201);
  } catch (error) {
    console.error('admin-grant-course:', error);
    return jsonResponse({ error: "L'accès ne peut pas être attribué pour le moment." }, 500);
  }
});
