import { fetchPaidCourseContent } from './paidCourseContent.js';
import { validateIagVideoGrant } from './iagIonVideo.js';

export const IAG_ID = 'formation-ia-generative-elearning';
export const IAG_VERSION = 'iag-v7-2026-10-21-with-explicit-v8-media';
export const IAG_LESSONS = Object.freeze(['l11','l12','l13','l21','l22','l23','l24','l25','l26','l27',
  'l31','l32','l33','l41','l42','l43','l51','l52','l61','l62','l71','l72']);

export function validateIagCourse(course) {
  if (course?.id !== IAG_ID || course.contentVersion !== IAG_VERSION
    || JSON.stringify(course.modules?.map(item => item.id)) !== JSON.stringify(IAG_LESSONS)
    || course.structuredContent?.contract !== 'iag-structured-v1'
    || !course.structuredContent.documents || !Array.isArray(course.resources)) throw new Error('Le parcours reçu ne correspond pas à la version attendue.');
  return course;
}
export function validateIagProgress(progress) {
  if (progress?.courseId !== IAG_ID || progress.contentVersion !== IAG_VERSION || !Array.isArray(progress.lessons)
    || new Set(progress.lessons.map(item => item.lessonId)).size !== progress.lessons.length
    || progress.lessons.some(item => !IAG_LESSONS.includes(item.lessonId) || !['in_progress','completed'].includes(item.status)))
    throw new Error('La reprise du parcours ne peut pas être vérifiée.');
  return progress;
}
async function content(supabase, body) {
  const { data, error } = await supabase.functions.invoke('paid-course-content', { body });
  if (error) {
    let detail = null;
    try { detail = await error.context?.json?.(); } catch { /* Keep the safe message. */ }
    throw Object.assign(new Error(detail?.error || 'Cette ressource ne peut pas être chargée pour le moment.'),
      { status: error.context?.status, code: detail?.code });
  }
  return data;
}
export function createIagLearningApi(supabase) {
  let catalogue = null;
  async function progress(action = 'status', lessonId = null) {
    if (!['status','view','complete'].includes(action) || (action === 'status' ? lessonId !== null : !IAG_LESSONS.includes(lessonId)))
      throw new Error('Leçon ou demande de suivi invalide.');
    const { data, error } = await supabase.rpc('iag_lesson_progress', {
      p_action: action, p_lesson_id: lessonId, p_content_version: IAG_VERSION,
    });
    if (error) throw Object.assign(new Error('Votre suivi ne peut pas être chargé ou enregistré. Réessayez.'), { code: error.code });
    return validateIagProgress(data);
  }
  return {
    async loadCourse() {
      catalogue = null;
      catalogue = validateIagCourse(await fetchPaidCourseContent(supabase, IAG_ID));
      return catalogue;
    },
    progress,
    async document(lessonId, documentId) {
      if (!IAG_LESSONS.includes(lessonId) || typeof documentId !== 'string' || !/^iag-d-[a-f0-9]{20}$/.test(documentId)) throw new Error('Document invalide.');
      const result = await content(supabase, { action: 'iag_document', courseId: IAG_ID, contentVersion: IAG_VERSION, lessonId, documentId });
      if (result?.lessonId !== lessonId || result.contentVersion !== IAG_VERSION || result.document?.id !== documentId || !Array.isArray(result.document.blocks))
        throw new Error('Le document reçu ne correspond pas à votre lecture.');
      return result.document;
    },
    async resource(lessonId, resourceId) {
      if (!IAG_LESSONS.includes(lessonId) || typeof resourceId !== 'string' || !/^res-[a-f0-9]{24}$/.test(resourceId)) throw new Error('Ressource invalide.');
      const descriptor = catalogue?.resources.find(item => item.id === resourceId);
      if (!descriptor || !Array.isArray(descriptor.lessonIds)
        || !(descriptor.lessonIds.includes(lessonId) || descriptor.lessonIds.includes('shared')))
        throw new Error('Cette ressource ne fait pas partie de la leçon chargée.');
      const { resource } = await content(supabase, { action: 'iag_resource', courseId: IAG_ID, contentVersion: IAG_VERSION, lessonId, resourceId });
      let url;
      const video = resource?.mime === 'video/mp4';
      if (video) validateIagVideoGrant(resource.videoGrant, lessonId, resourceId);
      else { try { url = new URL(resource?.url); } catch { throw new Error('Le lien privé reçu est invalide.'); } }
      const issued = Date.parse(resource?.issuedAt), expires = Date.parse(resource?.expiresAt), now = Date.now();
      if (resource?.id !== resourceId || resource.courseId !== IAG_ID || resource.contentVersion !== IAG_VERSION || resource.lessonId !== lessonId
        || (!video && (url.protocol !== 'https:' || url.username || url.password || url.hash))
        || (video && (Object.hasOwn(resource, 'url') || resource.expiresIn !== 120 || resource.videoGrant.expiresAt * 1000 !== expires))
        || !['video/mp4','text/vtt','text/plain','text/csv','image/png','image/jpeg'].includes(resource.mime)
        || resource.mime !== descriptor.mime
        || !Number.isFinite(issued) || !Number.isFinite(expires) || expires <= now || issued > now + 30000
        || !Number.isFinite(resource.expiresIn) || resource.expiresIn <= 0 || resource.expiresIn > 300
        || expires <= issued || expires - issued > (resource.expiresIn + 5) * 1000)
        throw new Error('L’autorisation de cette ressource ne peut pas être vérifiée.');
      return resource;
    },
  };
}
