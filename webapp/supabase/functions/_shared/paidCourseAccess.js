export const PAID_COURSE_BUCKET = 'paid-course-content';
export const PAID_COURSE_IDS = Object.freeze([
  'formation-ia',
  'formation-ia-act',
  'formation-prompt-level-1',
]);

export const PAID_RESOURCE_URL_SECONDS = 120;
export const PAID_VIDEO_URL_SECONDS = 300;

export function validatePaidCourseId(value) {
  const courseId = typeof value === 'string' ? value.trim() : '';
  if (!PAID_COURSE_IDS.includes(courseId)) throw new Error('Formation invalide.');
  return courseId;
}

export function hasUsableCourseAccess(access, now = new Date()) {
  if (!access || access.status !== 'active') return false;
  if (access.expires_at === null || access.expires_at === undefined) return true;
  const expiresAt = new Date(access.expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function paidResourceObjectPath(courseId, href) {
  const validatedCourseId = validatePaidCourseId(courseId);
  if (typeof href !== 'string' || !href.startsWith('/assets/')) {
    throw new Error('Ressource invalide.');
  }
  const fileName = href.slice('/assets/'.length);
  if (!/^[A-Za-z0-9À-ÿ_.-]{1,180}[.]pdf$/u.test(fileName) || fileName.includes('..')) {
    throw new Error('Ressource invalide.');
  }
  return `${validatedCourseId}/resources/${fileName}`;
}

export function trainerGuideObjectPath(courseId) {
  const validatedCourseId = validatePaidCourseId(courseId);
  const fileNames = {
    'formation-ia': 'guide-formateur-ia-generative-formaprompt.pdf',
    'formation-ia-act': 'guide-formateur-ia-act-formaprompt.pdf',
    'formation-prompt-level-1': 'guide-formateur-prompt-engineering-niveau-1-formaprompt.pdf',
  };
  return `${validatedCourseId}/trainer/${fileNames[validatedCourseId]}`;
}

export function courseVideoObjectPath(courseId) {
  if (validatePaidCourseId(courseId) !== 'formation-prompt-level-1') return null;
  return 'formation-prompt-level-1/videos/FP_-_Capsule_001_-_Rediger_un_bon_prompt_finale_with_captions.mp4';
}
