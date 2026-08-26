import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { checkPwnedPassword } from '../_shared/pwnedPassword.js';

const GENERIC_AUTH_ERROR = 'La demande d’authentification ne peut pas être traitée.';
const HIBP_WARNING = 'Le contrôle des mots de passe compromis est momentanément indisponible. Votre demande a néanmoins été traitée avec la politique de sécurité locale.';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function validEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

function validRedirectPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value.length <= 500 ? value : '/dashboard';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let action = '';
  try {
    const body = await request.json().catch(() => null);
    action = typeof body?.action === 'string' ? body.action : '';
    if (!['signup', 'update_password'].includes(action)) {
      return jsonResponse({ error: 'Action inconnue.' }, 400);
    }
    if (typeof body?.password !== 'string') return jsonResponse({ error: 'Le mot de passe est requis.' }, 400);
    const password = body.password;
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const email = action === 'signup' ? validEmail(body?.email) : null;
    if (action === 'signup' && !email) {
      return jsonResponse({ error: 'Adresse électronique invalide.' }, 400);
    }

    let authenticatedUserId: string | null = null;
    if (action === 'update_password') {
      const authorization = request.headers.get('Authorization');
      const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!accessToken) return jsonResponse({ error: 'Session de réinitialisation requise.' }, 401);
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
      if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);
      authenticatedUserId = authData.user.id;
    }

    const passwordCheck = await checkPwnedPassword(password);
    if (passwordCheck.status === 'invalid') return jsonResponse({ error: passwordCheck.message }, 400);
    if (passwordCheck.status === 'compromised') {
      return jsonResponse({
        error: 'Ce mot de passe figure dans des fuites de données connues. Choisissez un mot de passe unique.',
        code: 'password_compromised',
      }, 422);
    }
    const warning = passwordCheck.status === 'unavailable' ? HIBP_WARNING : null;

    if (action === 'signup') {
      if (!email) return jsonResponse({ error: 'Adresse électronique invalide.' }, 400);
      const siteUrl = requiredEnv('SITE_URL').replace(/\/$/, '');
      const redirectPath = validRedirectPath(body?.redirect_path);
      const signupClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await signupClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${siteUrl}${redirectPath}` },
      });
      if (error) return jsonResponse({ error: GENERIC_AUTH_ERROR }, 400);
      return jsonResponse({ success: true, warning });
    }

    if (action === 'update_password') {
      if (!authenticatedUserId) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);
      const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await adminClient.auth.admin.updateUserById(authenticatedUserId, { password });
      if (error) throw error;
      return jsonResponse({ success: true, warning });
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch {
    console.error('Contrôle de mot de passe impossible', {
      action: action || null,
      code: 'password_security_processing_failed',
    });
    return jsonResponse({ error: GENERIC_AUTH_ERROR }, 500);
  }
});
