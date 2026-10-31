import { handleIagPrivateAction } from '../_shared/iagPrivateDelivery.js';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { courseCatalog } from '../_shared/paidCourseCatalog.js';
import { IAG_COURSE_ID, normalizeIagAnswers, requireIagPositioning } from '../_shared/iagPositioning.js';
import {
  courseHasIonVideo,
  hasUsableCourseAccess,
  hasTrainerRole,
  PAID_COURSE_BUCKET,
  PAID_RESOURCE_URL_SECONDS,
  PAID_VIDEO_URL_SECONDS,
  paidResourceObjectPath,
  trainerGuideObjectPath,
  validatePaidCourseId,
} from '../_shared/paidCourseAccess.js';
import {
  excelResourceObjectPath,
  excelResourcesForCourse,
  validateExcelCourseId,
} from '../_shared/excelInitiationResources.js';
import {
  officeResourceObjectPath,
  officeResourcesForCourse,
  validateOfficeCourseId,
} from '../_shared/officeResources.js';

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

async function signExcelResources(adminClient: ServerClient, courseId: string, audience: 'learner' | 'trainer') {
  const resources = excelResourcesForCourse(courseId, audience);
  return Promise.all(resources.map(async (resource) => ({
    ...resource,
    href: await signUrl(
      adminClient,
      excelResourceObjectPath(courseId, audience, resource),
      PAID_RESOURCE_URL_SECONDS,
      typeof resource.fileName === 'string' ? resource.fileName : undefined,
    ),
    download: resource.fileName,
  })));
}

async function signOfficeResources(adminClient: ServerClient, courseId: string, audience: 'learner' | 'trainer') {
  const resources = officeResourcesForCourse(courseId, audience);
  return Promise.all(resources.map(async (resource) => ({
    ...resource,
    href: await signUrl(
      adminClient,
      officeResourceObjectPath(courseId, audience, resource),
      PAID_RESOURCE_URL_SECONDS,
      resource.fileName,
    ),
    download: resource.fileName,
  })));
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
    const isExcelLearnerRequest = action === 'excel_resources' || action === 'excel_initiation_resources';
    const isExcelTrainerRequest = action === 'excel_trainer_resources' || action === 'excel_initiation_trainer_resources';
    const isExcelResourceRequest = isExcelLearnerRequest || isExcelTrainerRequest;
    const isOfficeLearnerRequest = action === 'office_resources';
    const isOfficeTrainerRequest = action === 'office_trainer_resources';
    const isOfficeResourceRequest = isOfficeLearnerRequest || isOfficeTrainerRequest;
    const courseId = isExcelResourceRequest
      ? validateExcelCourseId(payload.courseId)
      : isOfficeResourceRequest
        ? validateOfficeCourseId(payload.courseId)
        : validatePaidCourseId(payload.courseId);
    const adminClient = createServerClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const canAccessTrainerContent = hasTrainerRole(profile?.role);

    // Same authoritative profiles role as private.iag_staff(): admin/employee.
    // Staff rubric access never authorizes learner documents or signed resources.
    if (courseId === IAG_COURSE_ID && action === 'iag_rubrics' && canAccessTrainerContent) {
      const response = await handleIagPrivateAction({ action, payload, adminClient });
      const result = jsonResponse(response.body, response.status);
      result.headers.set('Cache-Control', 'private, no-store');
      return result;
    }

    // Le nouveau questionnaire est propre à ce cours ; aucun contrôle global de connexion.
    // L'origine achat/cadeau/promo ne remplace jamais le droit course_access actif.
    if (courseId === IAG_COURSE_ID) {
      const { data: access, error: accessError } = await adminClient.from('course_access')
        .select('status, expires_at').eq('user_id', authData.user.id).eq('course_id', courseId).maybeSingle();
      if (accessError) throw accessError;
      if (!hasUsableCourseAccess(access)) return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
      const operations: Record<string, string> = { positioning: 'status', save_positioning: 'save', submit_positioning: 'submit' };
      if (Object.hasOwn(operations, action)) {
        const revision = action === 'positioning' ? 0 : payload.revision;
        if (!Number.isInteger(revision) || (revision as number) < 0 || (revision as number) > 2147483646) {
          return jsonResponse({ error: 'La version enregistrée du questionnaire est invalide. Rechargez la page.' }, 400);
        }
        let answers = null;
        if (action !== 'positioning') {
          try { answers = normalizeIagAnswers(payload.answers, action === 'submit_positioning'); }
          catch (error) { return jsonResponse({ error: (error as Error).message }, 400); }
        }
        // Le RPC reçoit le JWT vérifié, jamais un user_id fourni par le navigateur.
        const learnerClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: positioning, error: saveError } = await learnerClient.rpc('iag_positioning', {
          p_action: operations[action], p_answers: answers, p_expected_revision: revision,
        });
        if (saveError) {
          if (saveError.code === '40001') return jsonResponse({ error: 'Une autre fenêtre a enregistré ce questionnaire. Rechargez la version enregistrée avant de poursuivre.' }, 409);
          if (saveError.code === '42501') return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
          if (saveError.code === '22023') return jsonResponse({ error: 'Vérifiez les six réponses ; « Je ne sais pas encore » convient aussi.' }, 400);
          throw saveError;
        }
        return jsonResponse({ positioning });
      }
      // Contrôle obligatoire AVANT tout contenu, URL signée ou autorisation vidéo,
      // y compris si un compte personnel appelle directement l'API sans l'interface.
      if (!await requireIagPositioning(adminClient, authData.user.id)) {
        return jsonResponse({ error: 'Complétez votre questionnaire de départ pour poursuivre ce cours.', code: 'IAG_POSITIONING_REQUIRED' }, 412);
      }
    }

    if (courseId === IAG_COURSE_ID && ['iag_document', 'iag_resource', 'iag_resource_renew', 'iag_rubrics'].includes(action)) {
      // Session, droit exact actif et questionnaire viennent d'être relus ci-dessus,
      // y compris pour le personnel. Aucun user_id/chemin provenant du navigateur.
      const response = await handleIagPrivateAction({ action, payload, adminClient });
      const result = jsonResponse(response.body, response.status);
      result.headers.set('Cache-Control', 'private, no-store');
      return result;
    }

    if (isOfficeTrainerRequest) {
      if (!canAccessTrainerContent) return jsonResponse({ error: 'Accès refusé.' }, 403);
      return jsonResponse({ resources: await signOfficeResources(adminClient, courseId, 'trainer') });
    }

    if (isOfficeLearnerRequest) {
      const { data: access, error: accessError } = await adminClient
        .from('course_access')
        .select('status, expires_at')
        .eq('user_id', authData.user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (accessError) throw accessError;
      if (!hasUsableCourseAccess(access)) return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
      return jsonResponse({ resources: await signOfficeResources(adminClient, courseId, 'learner') });
    }

    if (isExcelTrainerRequest) {
      if (!canAccessTrainerContent) return jsonResponse({ error: 'Accès refusé.' }, 403);
      return jsonResponse({ resources: await signExcelResources(adminClient, courseId, 'trainer') });
    }

    if (isExcelLearnerRequest) {
      const { data: access, error: accessError } = await adminClient
        .from('course_access')
        .select('status, expires_at')
        .eq('user_id', authData.user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (accessError) throw accessError;
      if (!hasUsableCourseAccess(access)) return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
      return jsonResponse({ resources: await signExcelResources(adminClient, courseId, 'learner') });
    }

    if (action === 'trainer_guide') {
      if (!canAccessTrainerContent) return jsonResponse({ error: 'Accès refusé.' }, 403);
      const objectPath = trainerGuideObjectPath(courseId);
      const download = objectPath.split('/').at(-1);
      const signedUrl = await signUrl(adminClient, objectPath, PAID_RESOURCE_URL_SECONDS, download);
      return jsonResponse({ signedUrl, expiresIn: PAID_RESOURCE_URL_SECONDS });
    }

    if (action !== 'course') return jsonResponse({ error: 'Action inconnue.' }, 400);

    if (!canAccessTrainerContent) {
      const { data: access, error: accessError } = await adminClient
        .from('course_access')
        .select('status, expires_at')
        .eq('user_id', authData.user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (accessError) throw accessError;
      if (!hasUsableCourseAccess(access)) return jsonResponse({ error: 'Accès à la formation refusé.' }, 403);
    }

    if (courseId === IAG_COURSE_ID && !courseCatalog[IAG_COURSE_ID as keyof typeof courseCatalog]) {
      const result = jsonResponse({ code: 'IAG_PRIVATE_BUNDLE_REQUIRED', error: 'Le contenu privé de cette formation est indisponible.' }, 503);
      result.headers.set('Cache-Control', 'private, no-store');
      return result;
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
