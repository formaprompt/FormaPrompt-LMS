import { BOOKING_COURSES } from '../data/bookingCatalog.js';

export const LEARNER_RECORD_COURSE_LABELS = {
  ...Object.fromEntries(Object.values(BOOKING_COURSES).map((course) => [course.id, course.shortTitle || course.title])),
  'formation-agents-ia': 'Agents IA & Workflows',
};

export function learnerDirectoryPath(search = '', page = 0) {
  const normalizedSearch = String(search || '').trim();
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  return `/admin/pedagogique?onglet=users${normalizedSearch ? `&recherche=${encodeURIComponent(normalizedSearch)}` : ''}${safePage ? `&page=${safePage + 1}` : ''}`;
}

export function learnerRecordPath(userId, returnSearch = '', returnPage = 0) {
  if (!userId) return null;
  const normalizedSearch = String(returnSearch || '').trim();
  const safePage = Number.isInteger(returnPage) && returnPage > 0 ? returnPage : 0;
  const parameters = new URLSearchParams();
  if (normalizedSearch) parameters.set('retourRecherche', normalizedSearch);
  if (safePage) parameters.set('retourPage', String(safePage + 1));
  const query = parameters.toString();
  return `/admin/apprenants/${encodeURIComponent(userId)}${query ? `?${query}` : ''}`;
}

export function adminCorrectionPath({ kind, submissionId }) {
  const correction = kind === 'final_project' ? 'project' : 'exercise';
  const id = encodeURIComponent(String(submissionId));
  return `/admin/pedagogique?onglet=corrections&correction=${correction}&submissionId=${id}#${adminCorrectionAnchor(correction, id)}`;
}

export function adminBookingResponsePath(bookingId) {
  const id = encodeURIComponent(String(bookingId));
  return `/admin/pedagogique?onglet=bookings&bookingId=${id}#${adminBookingAnchor(id)}`;
}

export function adminCorrectionAnchor(correction, submissionId) {
  return `${correction === 'project' ? 'final-project-submission' : 'exercise-submission'}-${submissionId}`;
}

export function adminBookingAnchor(bookingId) {
  return `booking-request-${bookingId}`;
}

export function adminWorkTarget(searchParams) {
  return {
    correction: searchParams.get('correction') === 'project' ? 'project' : 'exercise',
    submissionId: searchParams.get('submissionId'),
    bookingId: searchParams.get('bookingId'),
  };
}

export function exactTargetRows(rows, targetId) {
  return targetId ? rows.filter((row) => String(row.id) === String(targetId)) : rows;
}

export function groupProgressByCourse(progress = []) {
  const grouped = new Map();
  progress.forEach((item) => {
    const current = grouped.get(item.courseId) || { completed: 0, visited: 0, lastViewedAt: null };
    current.visited += 1;
    current.completed += item.status === 'completed' ? 1 : 0;
    if (!current.lastViewedAt || new Date(item.lastViewedAt) > new Date(current.lastViewedAt)) current.lastViewedAt = item.lastViewedAt;
    grouped.set(item.courseId, current);
  });
  return [...grouped.entries()].map(([courseId, value]) => ({
    courseId,
    completed: value.completed,
    visited: value.visited,
    lastViewedAt: value.lastViewedAt,
  }));
}
