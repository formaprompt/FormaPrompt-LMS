export const BUREAUTIQUE_SCHEDULE_FORMATS = Object.freeze({
  four_half_days_3h30: Object.freeze({
    label: '4 demi-journées de 3 h 30',
    sessionCount: 4,
    durationMinutes: 210,
    sessionMinutes: 210,
    totalMinutes: 840,
  }),
  two_days_2x3h30: Object.freeze({
    label: '2 journées de 2 × 3 h 30 avec pause',
    sessionCount: 2,
    type: 'flexible_split_day',
    segmentDuration: 210,
    storedSessionCount: 4,
    sessionMinutes: 210,
    totalMinutes: 840,
  }),
});

const LEVELS = Object.freeze([
  ['excel-initiation', 'Excel Initiation', '/formation-excel#initiation', '/course/excel-supports'],
  ['excel-perfectionnement', 'Excel Perfectionnement', '/formation-excel#perfectionnement', '/course/excel-supports'],
  ['excel-avance', 'Excel Avancé', '/formation-excel#avance', '/course/excel-supports'],
  ['word-initiation', 'Word Initiation', '/formation-word#initiation', '/course/office-supports'],
  ['word-perfectionnement', 'Word Perfectionnement', '/formation-word#perfectionnement', '/course/office-supports'],
  ['powerpoint-initiation', 'PowerPoint Initiation', '/formation-powerpoint#initiation', '/course/office-supports'],
]);

export const BUREAUTIQUE_BOOKING_COURSES = Object.freeze(Object.fromEntries(LEVELS.flatMap(([
  baseId, title, landingPath, resourceBase,
]) => ['inter', 'individuel'].map((modality) => {
  const id = `${baseId}-${modality}`;
  return [id, Object.freeze({
    id,
    title,
    shortTitle: title,
    guidedHoursLabel: '14 heures',
    landingPath,
    coursePath: `${resourceBase}/${id}`,
    modality,
    bookingKind: modality === 'inter' ? 'cohort' : 'individual',
    defaultFormat: 'four_half_days_3h30',
    formats: BUREAUTIQUE_SCHEDULE_FORMATS,
  })];
}))));

export const BUREAUTIQUE_INTER_COURSE_IDS = Object.freeze(
  Object.values(BUREAUTIQUE_BOOKING_COURSES).filter(({ modality }) => modality === 'inter').map(({ id }) => id),
);

export const BUREAUTIQUE_INDIVIDUAL_COURSE_IDS = Object.freeze(
  Object.values(BUREAUTIQUE_BOOKING_COURSES).filter(({ modality }) => modality === 'individuel').map(({ id }) => id),
);

export function getBureautiqueBookingCourse(courseId) {
  return typeof courseId === 'string' && Object.hasOwn(BUREAUTIQUE_BOOKING_COURSES, courseId)
    ? BUREAUTIQUE_BOOKING_COURSES[courseId]
    : null;
}

export function validateBureautiqueScheduleFormat(format) {
  if (typeof format !== 'string' || !Object.hasOwn(BUREAUTIQUE_SCHEDULE_FORMATS, format)) {
    throw new Error('Format bureautique invalide.');
  }
  return format;
}
