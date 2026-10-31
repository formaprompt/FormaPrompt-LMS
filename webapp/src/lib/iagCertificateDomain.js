// Server-side projection contract, NOT an HTTP endpoint or an issuer.
// Inputs must be loaded by the server under the locks described in the SQL draft.
export const COURSE = 'formation-ia-generative-elearning';
export const CONTENT = 'iag-v7-2026-10-21-with-explicit-v8-media';
export const RUBRIC = 'v7-2026-10-21';
export const RUBRIC_SHA = '94efa99040b792ea903075801265b31b390ff84950b926cda98c658e0877b353';
export const LESSONS = Object.freeze(['l11','l12','l13','l21','l22','l23','l24','l25','l26','l27','l31','l32','l33','l41','l42','l43','l51','l52','l61','l62','l71','l72']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => text(value) && Number.isFinite(Date.parse(value));
export function certificateKey(userId, type) {
  if (!text(userId) || !['iag_completion','iag_success'].includes(type)) throw Error('Invalid certificate key');
  return JSON.stringify([userId, COURSE, CONTENT, type]);
}
export function completionProjection(userId, rows) {
  const relevant = rows.filter(row => row.user_id === userId && row.course_id === COURSE && row.content_version === CONTENT);
  // Exact canonical set; duplicate rows never count as another lesson.
  if (relevant.length !== LESSONS.length || new Set(relevant.map(row => row.lesson_id)).size !== LESSONS.length
    || relevant.some(row => !LESSONS.includes(row.lesson_id) || row.status !== 'completed'
      || row.progress_percent !== 100 || !validDate(row.completed_at))) return null;
  return relevant.map(row => row.completed_at).sort((a,b) => Date.parse(a)-Date.parse(b)).at(-1);
}
// A staff decision on canonical E1 of work 3 explicitly attests TWO actual assistants.
// Assistant labels or nonempty strings alone never grant eligibility.
export function successProjection({ userId, completedAt, submissions, reviews, rubric }) {
  if (!validDate(completedAt) || rubric.version !== RUBRIC || rubric.sha256 !== RUBRIC_SHA) return null;
  const result = [];
  for (const work of ['1','2','3']) {
    const rows = submissions.filter(row => row.user_id === userId && row.work_id === work);
    if (!rows.length || rows.length > 2 || rows.some(row => ![1,2].includes(row.ordinal))
      || new Set(rows.map(row => row.ordinal)).size !== rows.length) return null;
    const latest = rows.toSorted((a,b) => b.ordinal-a.ordinal)[0];
    if (latest.ordinal !== rows.length) return null;
    // Pick latest submission BEFORE looking for a review: no old-version inheritance.
    if (latest.course_id !== COURSE || latest.status !== 'submitted' || latest.rubric_version !== RUBRIC
      || !validDate(latest.received_at)) return null;
    const candidates = reviews.filter(row => row.response_id === latest.response_id);
    if (candidates.length !== 1) return null;
    const review = candidates[0];
    if (review.rubric_version !== RUBRIC || review.review_status !== 'validated'
      || !text(review.reviewer_id) || review.event_actor_id !== review.reviewer_id
      || review.event_type !== (latest.ordinal === 1 ? 'initial_review_sent' : 'targeted_review_sent')
      || !validDate(review.created_at) || Date.parse(review.created_at) < Date.parse(latest.received_at)
      || !text(review.real_trials_evidence)) return null;
    const ids = rubric.essentialIds[work];
    if (!review.essentials || Object.keys(review.essentials).length !== ids.length
      || ids.some(id => review.essentials[id]?.state !== 'attained' || !text(review.essentials[id].evidence))) return null;
    if (!Number.isInteger(review.points) || review.points < 0 || review.points > 20
      || !Number.isInteger(review.observed) || review.observed < 0 || review.observed > 20
      || review.points > review.observed) return null;
    if (work === '3' && new Set((latest.assistants || []).filter(text).map(value => value.trim().toLowerCase())).size < 2) return null;
    result.push({ workId:work, responseId:latest.response_id, reviewId:review.review_id,
      reviewerId:review.reviewer_id, returnedAt:review.created_at, points:review.points,
      denominator:20, observed:review.observed, complete:review.observed === 20 });
  }
  return result;
}
export function publicDocumentProjection(issuance) {
  // Print projection deliberately omits conversations, evidence texts, email and reviewer IDs.
  const snapshot = issuance.content_snapshot;
  if (!['iag_completion','iag_success'].includes(issuance.document_type) || issuance.course_id !== COURSE
    || snapshot.version !== 'iag-1' || snapshot.contentVersion !== CONTENT || !text(snapshot.learnerName)
    || !validDate(snapshot.completedAt) || !validDate(issuance.issued_at) || !text(issuance.reference)
    || !Array.isArray(snapshot.objectives) || !snapshot.objectives.length || !snapshot.objectives.every(text)
    || !text(snapshot.organization?.brandName) || !text(snapshot.organization?.legalName)
    || snapshot.traceability?.identitySource !== 'self_declared'
    || snapshot.traceability.userId !== issuance.user_id || snapshot.traceability.courseId !== COURSE) throw Error('Unsupported document');
  return { reference:issuance.reference, issuedAt:issuance.issued_at,
    learnerName:snapshot.learnerName, courseTitle:snapshot.courseTitle,
    title:issuance.document_type === 'iag_success' ? 'Certificat de fin de formation — mention Réussite' : 'Certificat de fin de formation',
    completedAt:snapshot.completedAt, objectives:snapshot.objectives, organization:snapshot.organization,
    initialReference:snapshot.initialReference || null,
    identitySource:'self_declared',
    identityNotice:'Identité déclarée par l’apprenant connecté ; aucune vérification officielle d’identité.',
    notice:'Document de fin de parcours FormaPrompt. Il ne constitue pas une certification professionnelle reconnue.' };
}
