export const BOOKING_COURSES = {
  'formation-ia': {
    id: 'formation-ia',
    title: 'IA générative : comprendre, pratiquer et sécuriser ses usages',
    shortTitle: 'Formation IA générative',
    guidedHoursLabel: '10 heures',
    landingPath: '/formation-ia-generative#inscription',
    coursePath: '/course/formation-ia',
    defaultFormat: 'four_2h30',
    formats: {
      two_5h: {
        label: '2 séances de 5 h',
        sessionCount: 2,
        durationMinutes: 300,
        inPersonOnly: true,
        travelFeeInPerson: true,
      },
      four_2h30: {
        label: '4 séances de 2 h 30',
        sessionCount: 4,
        durationMinutes: 150,
        remoteOnly: true,
      },
      three_4h_4h_2h: {
        label: '3 séances : 4 h + 4 h + 2 h',
        sessionCount: 3,
        type: 'variable_sessions',
        sessionDurations: [240, 240, 120],
        remoteOnly: true,
        selectionHint: 'Choisissez deux séances de 4 h puis une séance de 2 h, dans cet ordre chronologique.',
      },
    },
  },
  'formation-ia-act': {
    id: 'formation-ia-act',
    title: 'IA : acculturation et préparation à la conformité AI Act',
    shortTitle: 'Formation IA Act',
    guidedHoursLabel: '4 heures',
    landingPath: '/formation-ia-act-conformite#inscription',
    coursePath: '/course/formation-ia-act',
    defaultFormat: 'two_2h',
    formats: {
      one_4h: {
        label: '1 séance de 4 h',
        sessionCount: 1,
        durationMinutes: 240,
      },
      two_2h: {
        label: '2 séances de 2 h',
        sessionCount: 2,
        durationMinutes: 120,
        travelFeeInPerson: true,
      },
      four_1h: {
        label: '4 séances de 1 h',
        sessionCount: 4,
        durationMinutes: 60,
        remoteOnly: true,
      },
    },
  },
  'formation-prompt-level-1': {
    id: 'formation-prompt-level-1',
    title: 'Formation Prompt Engineering – Niveau 1',
    shortTitle: 'Prompt Engineering – Niveau 1',
    guidedHoursLabel: '7 heures',
    landingPath: '/formation-prompt-engineering#inscription',
    coursePath: '/course/formation-prompt-level-1',
    defaultFormat: 'two_3h30',
    formats: {
      one_day_7h: {
        label: '1 journée : 4 h le matin et 3 h l’après-midi',
        sessionCount: 1,
        type: 'split_day',
        segmentDurations: [240, 180],
        lunchMinutes: 60,
        inPersonOnly: true,
      },
      two_3h30: {
        label: '2 demi-journées de 3 h 30',
        sessionCount: 2,
        durationMinutes: 210,
        travelFeeInPerson: true,
      },
    },
  },
}

export const DEFAULT_BOOKING_COURSE_ID = 'formation-ia-act'

export function getBookingCourse(courseId) {
  return BOOKING_COURSES[courseId] || BOOKING_COURSES[DEFAULT_BOOKING_COURSE_ID]
}

export function getBookingUrl(courseId) {
  return `/reservation-formation?course=${encodeURIComponent(courseId)}`
}
