export const IAG_VIDEO_ENDPOINT = 'https://formaprompt.com/iag-video.php';
const COURSE = 'formation-ia-generative-elearning';
const VERSION = 'iag-v7-2026-10-21-with-explicit-v8-media';

export function validateIagVideoGrant(grant, lessonId, resourceId, now = Date.now()) {
  if (grant?.endpoint !== IAG_VIDEO_ENDPOINT || grant.courseId !== COURSE || grant.contentVersion !== VERSION
    || grant.lessonId !== lessonId || grant.resourceId !== resourceId
    || !/^l[1-7][1-9]$/.test(lessonId) || !/^res-[a-f0-9]{24}$/.test(resourceId)
    || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt * 1000 <= now || grant.expiresAt * 1000 > now + 120000
    || typeof grant.signature !== 'string' || !/^[a-f0-9]{64}$/.test(grant.signature)) throw new Error('L’autorisation vidéo reçue ne peut pas être vérifiée.');
  return grant;
}

export async function activateIagVideoGrant(resource, { lessonId, resourceId, signal, isCurrent = () => true, fetcher = fetch, origin = globalThis.location?.origin } = {}) {
  if (!isCurrent() || signal?.aborted) throw new Error('La lecture a changé.');
  if (origin !== 'https://formaprompt.com') throw new Error('La vidéo privée doit être ouverte depuis FormaPrompt.');
  const grant = validateIagVideoGrant(resource.videoGrant, lessonId, resourceId);
  const { courseId, contentVersion, expiresAt, signature } = grant;
  const response = await fetcher(IAG_VIDEO_ENDPOINT, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal,
    body: JSON.stringify({ courseId, contentVersion, lessonId, resourceId, expiresAt, signature }) });
  if (!isCurrent() || signal?.aborted) throw new Error('La lecture a changé.');
  if (response.status !== 204) throw new Error('L’accès vidéo n’a pas pu être activé. Réessayez.');
  return IAG_VIDEO_ENDPOINT + '?lesson=' + encodeURIComponent(lessonId) + '&resource=' + encodeURIComponent(resourceId);
}
