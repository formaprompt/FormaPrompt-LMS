// Pure domain rules. The authoritative write checks are repeated in the draft SQL.
export const IAG_COURSE_ID = 'formation-ia-generative-elearning';
export const IAG_RUBRIC_VERSION = 'v7-2026-10-21';
export const WORK_IDS = Object.freeze(['1', '2', '3']);
export function rubricFor(source, workId) {
  const id = String(workId);
  if (!WORK_IDS.includes(id) || !source?.grilles?.[id]) throw new Error('Travail inconnu.');
  const observations = source.grilles[id].flatMap(([title, weight, labels], group) => {
    if (weight !== labels.length) throw new Error('Grille incohérente.');
    return labels.map((label, item) => ({ id: `${id}.${group + 1}.${item + 1}`, group: title, label }));
  });
  if (observations.length !== 20) throw new Error('La grille doit comporter 20 observables.');
  return { workId: id, version: IAG_RUBRIC_VERSION, observations,
    essentials: source.criteres_essentiels[id].map(([key, label]) => ({ id: key, label })) };
}
const hasText = value => typeof value === 'string' && value.trim().length > 0;
function assertKeys(values, expected) {
  if (!values || Array.isArray(values) || Object.keys(values).length !== expected.length
    || expected.some(({ id }) => !Object.hasOwn(values, id))) throw new Error('Grille incomplète ou clés inconnues.');
}
export function assess(rubric, { observations, essentials, decision, feedback, realTrialsEvidence = '' }) {
  assertKeys(observations, rubric.observations);
  assertKeys(essentials, rubric.essentials);
  let points = 0; let observed = 0;
  for (const { id } of rubric.observations) {
    const entry = observations[id];
    if (!entry || ![null, 0, 1].includes(entry.value)) throw new Error('Observable : 0, 1 ou non observé.');
    if (entry.value !== null) {
      if (!hasText(entry.evidence)) throw new Error('Preuve requise pour chaque point observé.');
      points += entry.value; observed += 1;
    }
  }
  for (const { id } of rubric.essentials) {
    const entry = essentials[id];
    if (!entry || !['attained', 'not_attained', 'not_observed'].includes(entry.state)) throw new Error('État du critère essentiel invalide.');
    if (entry.state !== 'not_observed' && !hasText(entry.evidence)) throw new Error('Preuve du critère essentiel requise.');
  }
  if (!['needs_revision', 'validated'].includes(decision) || !hasText(feedback)) throw new Error('Décision humaine et retour requis.');
  if (decision === 'validated' && (rubric.essentials.some(({ id }) => essentials[id].state !== 'attained')
    || !hasText(realTrialsEvidence))) throw new Error('Validation impossible sans critères essentiels atteints et preuves des essais réels.');
  return { points, denominator: 20, observed, complete: observed === 20, decision,
    rubricVersion: rubric.version }; // No score threshold selects a decision.
}
export function canSubmit(history) {
  if (history.length === 0) return true;
  return history.length === 1 && Boolean(history[0].review_id || history[0].review);
}
export function successMention({ courseCompleted, latestReviews }) {
  return courseCompleted === true && WORK_IDS.every(id => {
    const review = latestReviews?.[id];
    return review?.decision === 'validated' && hasText(review.realTrialsEvidence);
  }); // Informational eligibility only; never emits a certificate.
}
export function activeOwnerAccess(access, userId, now) {
  return access?.user_id === userId && access.course_id === IAG_COURSE_ID && access.status === 'active'
    && (access.expires_at === null || Date.parse(access.expires_at) > new Date(now).getTime());
}
// Display/test helper matching the draft SQL's Paris wall-clock + two days.
// The server computes and persists due_at; clients never supply a deadline.
export function calendarDueAt(receivedAt) {
  const received = new Date(receivedAt);
  if (!Number.isFinite(received.getTime())) throw new Error('Réception invalide.');
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const wall = instant => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  };
  const start = received.getTime(); const target = wall(start) + 2 * 86400000;
  const offsets = [...new Set([-86400000, 0, 86400000].map(delta => wall(target + delta) - (target + delta)))];
  const candidates = offsets.map(offset => target - offset);
  const exact = candidates.filter(candidate => wall(candidate) === target);
  // PostgreSQL prefers standard-time interpretation in gaps and repeated hours.
  return new Date(Math.max(...(exact.length ? exact : candidates)) + received.getUTCMilliseconds()).toISOString();
}
