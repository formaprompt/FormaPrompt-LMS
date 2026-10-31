import { IAG_CONTENT_VERSION } from './iagPrivateResourceAllowlist.js';

export const IAG_ION_VIDEO_TTL_SECONDS = 120;
const COURSE_ID = 'formation-ia-generative-elearning';
const envValue = (readEnv, name) => {
  const value = readEnv(name);
  if (typeof value !== 'string' || !value.trim()) throw new Error('Configuration vidéo IAG indisponible.');
  return value.trim();
};

// Only called after exact private allowlist lookup, entitlement and questionnaire.
// No filename, Storage key or browser-provided path enters the signed payload.
export async function createIagIonVideoGrant({courseId,contentVersion,lessonId,resourceId}, {
  readEnv = name => globalThis.Deno?.env?.get(name), now = new Date(),
} = {}) {
  if (courseId !== COURSE_ID || contentVersion !== IAG_CONTENT_VERSION
      || typeof lessonId !== 'string' || !/^l[1-7][1-9]$/.test(lessonId)
      || typeof resourceId !== 'string' || !/^res-[a-f0-9]{24}$/.test(resourceId)) {
    throw new Error('Référence vidéo IAG invalide.');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getTime() < 0) {
    throw new Error('Horloge vidéo IAG invalide.');
  }
  const endpoint = new URL(envValue(readEnv, 'PAID_VIDEO_GATEWAY_URL'));
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'formaprompt.com'
      || endpoint.port || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Configuration vidéo IAG invalide.');
  }
  endpoint.pathname = '/iag-video.php';
  const secret = envValue(readEnv, 'PAID_VIDEO_SIGNING_SECRET');
  if (new TextEncoder().encode(secret).byteLength < 32) throw new Error('Configuration vidéo IAG indisponible.');
  const expiresAt = Math.floor(now.getTime() / 1000) + IAG_ION_VIDEO_TTL_SECONDS;
  const payload = ['iag-video-v1',courseId,contentVersion,lessonId,resourceId,String(expiresAt)].join('\n');
  const key = await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed = await globalThis.crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(signed),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {endpoint:endpoint.toString(),courseId,contentVersion,lessonId,resourceId,expiresAt,signature};
}
