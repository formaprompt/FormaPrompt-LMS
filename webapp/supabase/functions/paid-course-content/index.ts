import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { courseCatalog } from '../_shared/paidCourseCatalog.js';
import {
  courseHasIonVideo,
  hasUsableCourseAccess,
  PAID_COURSE_BUCKET,
  PAID_RESOURCE_URL_SECONDS,
  PAID_VIDEO_URL_SECONDS,
  paidResourceObjectPath,
  trainerGuideObjectPath,
  validatePaidCourseId,
} from '../_shared/paidCourseAccess.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Configuration serveur manquante : ${name}`);
  return value;
}

function bearerToken(request: Request) {
  return request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

function createServerClient(supabaseUrl: string, key: string) {
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createIonVideoGrant(courseId: string) {
  const gatewayUrl = new URL(requiredEnv('PAID_VIDEO_GATEWAY_URL'));
  if (
    gatewayUrl.protocol !== 'https:'
    || gatewayUrl.hostname !== 'formaprompt.com'
    || gatewayUrl.username
    || gatewayUrl.password
    || gatewayUrl.search
    || gatewayUrl.hash
  ) {
    throw new Error('Configuration serveur vidéo invalide.');
  }
  const expiresAt = Math.floor(Date.now() / 1000) + PAID_VIDEO_URL_SECONDS;
  const payload = `${courseId}\n${expiresAt}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('PAID_VIDEO_SIGNING_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return {
    endpoint: gatewayUrl.toString(),
    courseId,
    expiresAt,
    signature,
  };
}

type ServerClient = ReturnType<typeof createServerClient>;

async function signUrl(adminClient: ServerClient, objectPath: string, expiresIn: number, download?: string) {
  const { data, error } = await adminClient.storage
    .from(PAID_COURSE_BUCKET)
    .createSignedUrl(objectPath, expiresIn, download ? { download } : undefined);
  if (error || !data?.signedUrl) throw error || new Error('Ressource indisponible.');
  return data.signedUrl;
}

async function signCourseResources(adminClient: ServerClient, courseId: string, value: unknown): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => signCourseResources(adminClient, courseId, item)));
  }
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(source)) {
    result[key] = await signCourseResources(adminClient, courseId, nestedValue);
  }

  if (typeof source.href === 'string' && source.href.startsWith('/assets/')) {
    const objectPath = paidResourceObjectPath(courseId, source.href);
    const download = typeof source.download === 'string' ? source.download : objectPath.split('/').at(-1);
    result.href = await signUrl(adminClient, objectPath, PAID_RESOURCE_URL_SECONDS, download);
  }
  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let action = '';
  try {
    const token = bearerToken(request);
    if (!token) return jsonResponse({ error: 'Connexion requise.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authClient = createServerClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    action = typeof payload.action === 'string' ? payload.action.trim() : '';
    const courseId = validatePaidCourseId(payload.courseId);
    const adminClient = createServerClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const isAdmin = profile?.role === 'admin';

    if (action === 'trainer_guide') {
      if (!isAdmin) return jsonResponse({ error: 'Accès refusé.' }, 403);
      const objectPath = trainerGuideObjectPath(courseId);
      const download = objectPath.split('/').at(-1);
      const signedUrl = await signUrl(adminClient, objectPath, PAID_RESOURCE_URL_SECONDS, download);
      return jsonResponse({ signedUrl, expiresIn: PAID_RESOURCE_URL_SECONDS });
    }

    if (action !== 'course') return jsonResponse({ error: 'Action inconnue.' }, 400);

    if (!isAdmin) {
      const { data: access, error: accessError } = await adminClient
        .from('course_access')
        .select('status, expires_at')
        .eq('user_id', authData.user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (accessError) throw accessError;
      if (!hasUsableCourseAccess(access)) return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
    }

    const sourceCourse = courseCatalog[courseId as keyof typeof courseCatalog];
    if (!sourceCourse) return jsonResponse({ error: 'Formation indisponible.' }, 404);
    const course = await signCourseResources(adminClient, courseId, sourceCourse) as Record<string, unknown>;
    if (courseHasIonVideo(courseId)) {
      course.videoGrant = await createIonVideoGrant(courseId);
    }
    return jsonResponse({ course });
  } catch (error) {
    const invalidRequest = error instanceof Error && /invalide|inconnue/i.test(error.message);
    console.error('Accès au contenu pédagogique refusé', {
      action: action || null,
      code: invalidRequest ? 'invalid_request' : 'content_unavailable',
    });
    return jsonResponse({
      error: invalidRequest
        ? 'La demande de contenu est invalide.'
        : 'Le contenu pédagogique est momentanément indisponible.',
    }, invalidRequest ? 400 : 409);
  }
});
