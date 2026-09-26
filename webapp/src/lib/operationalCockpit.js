import { BOOKING_COURSES } from '../data/bookingCatalog.js';
import {
  adminBookingResponsePath,
  adminCorrectionPath,
  learnerRecordPath,
  LEARNER_RECORD_COURSE_LABELS,
} from './adminLearnerRecord.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_BOOKING_STATUSES = new Set(['pending_distance', 'awaiting_travel_payment', 'confirmed']);
const ACTIVE_COHORT_STATUSES = new Set(['draft', 'published', 'confirmed']);
const ACTIVE_SESSION_STATUSES = new Set(['pending', 'confirmed']);
const CLOSED_ENROLLMENT_STATUSES = new Set(['archived', 'cancelled', 'abandoned']);
const AVAILABLE_DOCUMENT_STATUSES = new Set(['ready', 'completed', 'archived']);
const FINALIZED_DOCUMENT_STATUSES = new Set(['completed', 'archived']);

const OPERATIONAL_DESTINATIONS = {
  availability: '/admin/pedagogique?onglet=bookings&workspace=availability',
  sessions: '/admin/pedagogique?onglet=bookings&workspace=sessions',
  cohorts: '/admin/pedagogique?onglet=bookings&workspace=cohorts',
  corrections: '/admin/pedagogique?onglet=corrections',
};

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

function fullName(enrollment) {
  const firstName = String(enrollment?.learner_first_name || '').trim();
  const lastName = String(enrollment?.learner_last_name || '').trim();
  if (!firstName && !lastName) return '';
  return `${firstName}${firstName && lastName ? ' ' : ''}${lastName.toLocaleUpperCase('fr-FR')}`;
}

function identityLabel(identity) {
  if (!identity) return 'Identité à compléter';
  if (identity.organizationName && identity.fullName) return `${identity.organizationName} — ${identity.fullName}`;
  return identity.organizationName || identity.fullName || 'Identité à compléter';
}

export function buildOperationalIdentityIndex({ enrollments = [], assessments = [] } = {}) {
  const identities = new Map();
  const orderedEnrollments = [...enrollments].sort((left, right) => (
    (timestamp(right.updated_at) || 0) - (timestamp(left.updated_at) || 0)
  ));
  orderedEnrollments.forEach((enrollment) => {
    const current = identities.get(enrollment.user_id) || {};
    identities.set(enrollment.user_id, {
      ...current,
      fullName: current.fullName || fullName(enrollment),
      organizationName: current.organizationName || String(enrollment.organization_name || '').trim(),
    });
  });

  [...assessments]
    .sort((left, right) => (timestamp(right.submitted_at) || 0) - (timestamp(left.submitted_at) || 0))
    .forEach((assessment) => {
      const current = identities.get(assessment.user_id) || {};
      identities.set(assessment.user_id, {
        ...current,
        fullName: current.fullName || String(assessment.learner_name || '').trim(),
      });
    });

  return identities;
}

function learnerIdentity(userId, identities) {
  return {
    label: identityLabel(identities.get(userId)),
    href: learnerRecordPath(userId),
  };
}

function groupIdentity(cohort) {
  const count = Number(cohort?.enrolled_count || 0);
  return `${count} participant${count === 1 ? '' : 's'} concerné${count === 1 ? '' : 's'}`;
}

function enrollmentDocuments(enrollment) {
  return new Map((enrollment.training_documents || []).map((document) => [document.document_type, document]));
}

function documentIsAvailable(enrollment, documentType) {
  return AVAILABLE_DOCUMENT_STATUSES.has(enrollmentDocuments(enrollment).get(documentType)?.status);
}

function documentIsFinalized(enrollment, documentType) {
  return FINALIZED_DOCUMENT_STATUSES.has(enrollmentDocuments(enrollment).get(documentType)?.status);
}

function administrativeGroupKey(enrollment) {
  const organization = String(enrollment.organization_name || '').trim().toLocaleLowerCase('fr-FR');
  if (!organization) return `enrollment:${enrollment.id}`;
  return [organization, enrollment.course_id, enrollment.starts_at, enrollment.ends_at].join('|');
}

function issueSummary(issues) {
  const visible = issues.slice(0, 3);
  const hiddenCount = issues.length - visible.length;
  return `${visible.join(', ')}${hiddenCount > 0 ? ` et ${hiddenCount} autre${hiddenCount > 1 ? 's' : ''}` : ''}`;
}

function buildAdministrativeItems(rows, identities, actionLabel) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = administrativeGroupKey(row.enrollment);
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  });

  return [...groups.values()].map((entries) => {
    const first = entries[0];
    const enrollment = first.enrollment;
    const organizationName = String(enrollment.organization_name || '').trim();
    const isGroup = Boolean(organizationName && entries.length > 1);
    const issues = [...new Set(entries.flatMap((entry) => entry.issues))];
    const identity = learnerIdentity(enrollment.user_id, identities);
    const period = dateRangeLabel([{
      starts_at: enrollment.starts_at,
      ends_at: enrollment.ends_at,
    }]);
    return {
      id: `${actionLabel.toLocaleLowerCase('fr-FR')}-${entries.map((entry) => entry.enrollment.id).join('-')}`,
      title: isGroup
        ? `${organizationName} — ${entries.length} participants concernés`
        : identity.label,
      detail: `${courseLabel(enrollment.course_id)} · ${period} · ${issueSummary(issues)}`,
      href: isGroup
        ? `/admin/dossiers?recherche=${encodeURIComponent(organizationName)}`
        : identity.href,
      actionLabel,
      sortValue: first.sortValue,
    };
  }).sort((left, right) => left.sortValue - right.sortValue)
    .map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'sortValue')));
}

function buildCockpitSearchIndex(enrollments, cohorts, identities) {
  const groups = new Map();
  enrollments.forEach((enrollment) => {
    const key = administrativeGroupKey(enrollment);
    const current = groups.get(key) || [];
    current.push(enrollment);
    groups.set(key, current);
  });

  const enrollmentEntries = [...groups.values()].map((entries) => {
    const first = entries[0];
    const organizationName = String(first.organization_name || '').trim();
    const isGroup = Boolean(organizationName && entries.length > 1);
    const identity = learnerIdentity(first.user_id, identities);
    const title = isGroup
      ? `${organizationName} — ${entries.length} participants concernés`
      : identity.label;
    const detail = [
      courseLabel(first.course_id),
      timestamp(first.starts_at) && timestamp(first.ends_at)
        ? dateRangeLabel([{ starts_at: first.starts_at, ends_at: first.ends_at }])
        : null,
    ].filter(Boolean).join(' · ');
    const individualNames = entries.map((enrollment) => identityLabel(identities.get(enrollment.user_id)));
    return {
      id: `search-${entries.map((enrollment) => enrollment.id).join('-')}`,
      title,
      detail,
      href: isGroup
        ? `/admin/dossiers?recherche=${encodeURIComponent(organizationName)}`
        : identity.href,
      searchText: [title, detail, organizationName, ...individualNames].join(' '),
    };
  });
  const cohortEntries = cohorts
    .filter((cohort) => ACTIVE_COHORT_STATUSES.has(cohort.status))
    .map((cohort) => {
      const title = `${courseLabel(cohort.course_id)} — groupe de ${Number(cohort.enrolled_count || 0)} participant${Number(cohort.enrolled_count || 0) === 1 ? '' : 's'}`;
      const detail = dateRangeLabel(plannedCohortSessions(cohort));
      return {
        id: `search-cohort-${cohort.id}`,
        title,
        detail,
        href: cohortDestination(cohort.id),
        searchText: `${title} ${detail} ${cohort.course_id}`,
      };
    });
  return [...enrollmentEntries, ...cohortEntries]
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'));
}

function courseLabel(courseId) {
  return LEARNER_RECORD_COURSE_LABELS[courseId] || courseId || 'Formation à identifier';
}

function expectedBookingMinutes(booking) {
  const format = BOOKING_COURSES[booking.course_id]?.formats?.[booking.schedule_format];
  if (!format) return 0;
  if (Array.isArray(format.sessionDurations)) {
    return format.sessionDurations.reduce((sum, duration) => sum + Number(duration || 0), 0);
  }
  if (Array.isArray(format.segmentDurations)) {
    return format.segmentDurations.reduce((sum, duration) => sum + Number(duration || 0), 0);
  }
  return Number(format.sessionCount || 0) * Number(format.durationMinutes || 0);
}

function plannedBookingSessions(booking) {
  return (booking.course_session_bookings || [])
    .filter((session) => session.status !== 'cancelled')
    .sort((left, right) => (timestamp(left.starts_at) || 0) - (timestamp(right.starts_at) || 0));
}

function plannedCohortSessions(cohort) {
  return [...(cohort.sessions || [])]
    .filter((session) => session.starts_at && session.ends_at)
    .sort((left, right) => (timestamp(left.starts_at) || 0) - (timestamp(right.starts_at) || 0));
}

function minutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} h ${remainder}` : `${hours} h`;
}

function dateTimeLabel(value) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function dateRangeLabel(sessions) {
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  if (!first || !last) return 'Dates à planifier';
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium' });
  const firstDate = formatter.format(new Date(first.starts_at));
  const lastDate = formatter.format(new Date(last.ends_at));
  return firstDate === lastDate ? firstDate : `Du ${firstDate} au ${lastDate}`;
}

function bookingDestination(bookingId) {
  return adminBookingResponsePath(bookingId);
}

function cohortDestination(cohortId) {
  const id = encodeURIComponent(String(cohortId));
  return `${OPERATIONAL_DESTINATIONS.cohorts}&cohortId=${id}#course-cohort-${id}`;
}

function attendanceDestination(bookingId) {
  return `/admin/emargements/${encodeURIComponent(String(bookingId))}`;
}

function availabilityItems(slots) {
  const byDate = new Map();
  slots.forEach((slot) => {
    const dateKey = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(slot.starts_at));
    const current = byDate.get(dateKey) || [];
    current.push(slot);
    byDate.set(dateKey, current);
  });
  return [...byDate.entries()].slice(0, 4).map(([dateKey, daySlots]) => ({
    id: `availability-${dateKey}`,
    title: new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(daySlots[0].starts_at)),
    detail: `${daySlots.length} plage${daySlots.length > 1 ? 's' : ''} libre${daySlots.length > 1 ? 's' : ''}`,
    href: OPERATIONAL_DESTINATIONS.availability,
    actionLabel: 'Gérer',
  }));
}

function buildAvailabilitySection(slots, now) {
  const nowTime = now.getTime();
  const horizonTime = nowTime + (15 * DAY_MS);
  const freeSlots = slots
    .filter((slot) => slot.is_active && !slot.is_reserved && (timestamp(slot.starts_at) || 0) > nowTime)
    .sort((left, right) => timestamp(left.starts_at) - timestamp(right.starts_at));
  const hasSlotAfterHorizon = freeSlots.some((slot) => timestamp(slot.starts_at) > horizonTime);
  const slotsAfterHorizon = freeSlots.filter((slot) => timestamp(slot.starts_at) > horizonTime);
  const horizonLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(horizonTime));

  return {
    id: 'availability',
    title: 'Disponibilités libres',
    count: slotsAfterHorizon.length,
    tone: hasSlotAfterHorizon ? 'success' : 'warning',
    summary: hasSlotAfterHorizon
      ? `${slotsAfterHorizon.length} créneau${slotsAfterHorizon.length > 1 ? 'x sont' : ' est'} ouvert${slotsAfterHorizon.length > 1 ? 's' : ''} après le ${horizonLabel}.`
      : `Aucun créneau libre après le ${horizonLabel}. Il faut en ajouter.`,
    items: availabilityItems(freeSlots),
    emptyLabel: 'Aucun créneau libre actuellement.',
    href: OPERATIONAL_DESTINATIONS.availability,
    actionLabel: 'Ouvrir les disponibilités',
  };
}

function readinessIssues(enrollment) {
  const issues = [];
  if (!['validated', 'in_progress', 'completed'].includes(enrollment.status)) issues.push('dossier à valider');
  if (!documentIsAvailable(enrollment, 'training_agreement')) issues.push('convention ou contrat manquant');
  if (!documentIsAvailable(enrollment, 'convocation')) issues.push('convocation manquante');
  if (enrollment.funding_mode === 'opco'
    && !['granted', 'partially_granted'].includes(enrollment.funding_status)) {
    issues.push('financement OPCO à valider');
  }
  if (['remote', 'hybrid'].includes(enrollment.delivery_mode)
    && !String(enrollment.remote_access_details || '').trim()) {
    issues.push('accès à distance à compléter');
  }
  if (['in_person', 'hybrid'].includes(enrollment.delivery_mode)
    && !String(enrollment.training_location || '').trim()) {
    issues.push('lieu à compléter');
  }
  return issues;
}

function buildTrainingReadinessSection(enrollments, identities, now) {
  const nowTime = now.getTime();
  const horizonTime = nowTime + (30 * DAY_MS);
  const rows = enrollments
    .filter((enrollment) => !CLOSED_ENROLLMENT_STATUSES.has(enrollment.status))
    .filter((enrollment) => {
      const startsAt = timestamp(enrollment.starts_at);
      return startsAt && startsAt > nowTime && startsAt <= horizonTime;
    })
    .map((enrollment) => ({
      enrollment,
      issues: readinessIssues(enrollment),
      sortValue: timestamp(enrollment.starts_at),
    }))
    .filter((row) => row.issues.length);
  const items = buildAdministrativeItems(rows, identities, 'Préparer');
  return {
    id: 'training-readiness',
    title: 'Formations pas prêtes',
    count: items.length,
    tone: items.length ? 'warning' : 'success',
    summary: items.length
      ? `${items.length} dossier${items.length > 1 ? 's' : ''} à sécuriser avant le démarrage.`
      : 'Toutes les formations des 30 prochains jours sont prêtes.',
    items,
    emptyLabel: 'Aucun dossier incomplet dans les 30 prochains jours.',
    href: '/admin/dossiers',
    actionLabel: 'Voir les dossiers',
  };
}

function bookingAttendanceIsFinalized(enrollment, bookings, attendance, now) {
  if (!enrollment.booking_request_id) return true;
  const booking = bookings.find((item) => item.id === enrollment.booking_request_id);
  if (!booking) return true;
  const pastSessions = plannedBookingSessions(booking)
    .filter((session) => timestamp(session.ends_at) < now.getTime());
  if (!pastSessions.length) return true;
  return pastSessions.every((session) => {
    const record = attendanceRecord(attendance, booking.id, session);
    return Boolean(record?.learner_confirmed_at && record?.trainer_status !== 'pending');
  });
}

function enrollmentSurveyIsCompleted(enrollment, surveys) {
  if (!enrollment.booking_request_id) return true;
  return surveys.some((survey) => survey.booking_request_id === enrollment.booking_request_id);
}

function closureIssues(enrollment, bookings, attendance, surveys, now) {
  const issues = [];
  if (enrollment.status !== 'completed') issues.push('dossier à clôturer');
  if (!bookingAttendanceIsFinalized(enrollment, bookings, attendance, now)) issues.push('émargement à finaliser');
  if (!enrollmentSurveyIsCompleted(enrollment, surveys)) issues.push('questionnaire à récupérer');
  if (enrollment.status === 'completed'
    && !documentIsAvailable(enrollment, 'completion_certificate')) {
    issues.push('attestation à générer');
  }
  if (documentIsAvailable(enrollment, 'attendance_sheet')
    && !documentIsFinalized(enrollment, 'attendance_sheet')
    && !enrollment.booking_request_id) {
    issues.push('feuille d’émargement à finaliser');
  }
  return issues;
}

function buildTrainingClosingSection(enrollments, bookings, attendance, surveys, identities, now) {
  const nowTime = now.getTime();
  const rows = enrollments
    .filter((enrollment) => !CLOSED_ENROLLMENT_STATUSES.has(enrollment.status))
    .filter((enrollment) => (timestamp(enrollment.ends_at) || Number.POSITIVE_INFINITY) < nowTime)
    .map((enrollment) => ({
      enrollment,
      issues: closureIssues(enrollment, bookings, attendance, surveys, now),
      sortValue: timestamp(enrollment.ends_at),
    }))
    .filter((row) => row.issues.length);
  const items = buildAdministrativeItems(rows, identities, 'Clôturer');
  return {
    id: 'training-closing',
    title: 'Formations à clôturer',
    count: items.length,
    tone: items.length ? 'warning' : 'success',
    summary: items.length
      ? `${items.length} formation${items.length > 1 ? 's' : ''} terminée${items.length > 1 ? 's' : ''} avec une clôture incomplète.`
      : 'Toutes les formations terminées sont administrativement clôturées.',
    items,
    emptyLabel: 'Aucune formation terminée à clôturer.',
    href: '/admin/dossiers',
    actionLabel: 'Voir les dossiers',
  };
}

function buildUnscheduledSection(bookings, cohorts, identities) {
  const bookingItems = bookings
    .filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status))
    .map((booking) => {
      const expectedMinutes = expectedBookingMinutes(booking);
      const plannedMinutes = plannedBookingSessions(booking)
        .reduce((sum, session) => sum + Number(session.duration_minutes || 0), 0);
      if (!expectedMinutes || plannedMinutes >= expectedMinutes) return null;
      const identity = learnerIdentity(booking.user_id, identities);
      return {
        id: `unscheduled-booking-${booking.id}`,
        title: identity.label,
        detail: `${courseLabel(booking.course_id)} · ${minutesLabel(plannedMinutes)} planifiées sur ${minutesLabel(expectedMinutes)}`,
        href: bookingDestination(booking.id),
        actionLabel: plannedMinutes ? 'Compléter' : 'Planifier',
        sortValue: expectedMinutes - plannedMinutes,
      };
    })
    .filter(Boolean);

  const cohortItems = cohorts
    .filter((cohort) => ACTIVE_COHORT_STATUSES.has(cohort.status))
    .map((cohort) => {
      const expectedMinutes = 14 * 60;
      const plannedMinutes = plannedCohortSessions(cohort)
        .reduce((sum, session) => sum + Number(session.duration_minutes || 0), 0);
      if (plannedMinutes >= expectedMinutes) return null;
      return {
        id: `unscheduled-cohort-${cohort.id}`,
        title: groupIdentity(cohort),
        detail: `${courseLabel(cohort.course_id)} · ${minutesLabel(plannedMinutes)} planifiées sur 14 h`,
        href: cohortDestination(cohort.id),
        actionLabel: plannedMinutes ? 'Compléter' : 'Planifier',
        sortValue: expectedMinutes - plannedMinutes,
      };
    })
    .filter(Boolean);

  const items = [...bookingItems, ...cohortItems]
    .sort((left, right) => right.sortValue - left.sortValue)
    .map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'sortValue')));
  return {
    id: 'unscheduled-hours',
    title: 'Heures non planifiées',
    count: items.length,
    tone: items.length ? 'warning' : 'success',
    summary: items.length
      ? `${items.length} formation${items.length > 1 ? 's' : ''} à planifier ou compléter.`
      : 'Toutes les heures attendues sont planifiées.',
    items,
    emptyLabel: 'Aucune heure en attente de planification.',
    href: OPERATIONAL_DESTINATIONS.sessions,
    actionLabel: 'Voir la planification',
  };
}

function combinedSessions(bookings, cohorts, identities, now) {
  const nowTime = now.getTime();
  const individual = bookings.flatMap((booking) => {
    if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) return [];
    const identity = learnerIdentity(booking.user_id, identities);
    return plannedBookingSessions(booking)
      .filter((session) => ACTIVE_SESSION_STATUSES.has(session.status) && timestamp(session.starts_at) > nowTime)
      .map((session) => ({
        id: `session-${session.id}`,
        title: identity.label,
        detail: `${courseLabel(booking.course_id)} · ${dateTimeLabel(session.starts_at)}`,
        href: bookingDestination(booking.id),
        actionLabel: 'Contrôler',
        startsAt: session.starts_at,
      }));
  });
  const grouped = cohorts.flatMap((cohort) => {
    if (!ACTIVE_COHORT_STATUSES.has(cohort.status)) return [];
    return plannedCohortSessions(cohort)
      .filter((session) => timestamp(session.starts_at) > nowTime)
      .map((session) => ({
        id: `cohort-session-${session.id || `${cohort.id}-${session.position}`}`,
        title: groupIdentity(cohort),
        detail: `${courseLabel(cohort.course_id)} · ${dateTimeLabel(session.starts_at)}`,
        href: cohortDestination(cohort.id),
        actionLabel: 'Contrôler',
        startsAt: session.starts_at,
      }));
  });
  return [...individual, ...grouped].sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));
}

function buildUpcomingSessionsSection(bookings, cohorts, identities, now) {
  const items = combinedSessions(bookings, cohorts, identities, now);
  return {
    id: 'upcoming-sessions',
    title: 'Prochaines séances',
    count: items.length,
    tone: 'info',
    summary: items.length ? `${items.length} séance${items.length > 1 ? 's' : ''} à venir.` : 'Aucune séance à venir.',
    items,
    emptyLabel: 'Aucune séance planifiée pour le moment.',
    href: OPERATIONAL_DESTINATIONS.sessions,
    actionLabel: 'Voir le planning',
    wide: true,
  };
}

function trainingEntries(bookings, cohorts, identities) {
  const individual = bookings.flatMap((booking) => {
    const sessions = plannedBookingSessions(booking);
    if (!sessions.length || ['cancelled', 'rejected'].includes(booking.status)) return [];
    const identity = learnerIdentity(booking.user_id, identities);
    return [{
      id: `training-${booking.id}`,
      title: identity.label,
      detail: `${courseLabel(booking.course_id)} · ${dateRangeLabel(sessions)}`,
      href: bookingDestination(booking.id),
      actionLabel: 'Ouvrir',
      startsAt: sessions[0].starts_at,
      endsAt: sessions[sessions.length - 1].ends_at,
      status: booking.status,
    }];
  });
  const grouped = cohorts.flatMap((cohort) => {
    const sessions = plannedCohortSessions(cohort);
    if (!sessions.length || cohort.status === 'cancelled') return [];
    return [{
      id: `cohort-training-${cohort.id}`,
      title: groupIdentity(cohort),
      detail: `${courseLabel(cohort.course_id)} · ${dateRangeLabel(sessions)}`,
      href: cohortDestination(cohort.id),
      actionLabel: 'Ouvrir',
      startsAt: sessions[0].starts_at,
      endsAt: sessions[sessions.length - 1].ends_at,
      status: cohort.status,
    }];
  });
  return [...individual, ...grouped];
}

function buildTrainingSections(bookings, cohorts, identities, now) {
  const nowTime = now.getTime();
  const recentLimit = nowTime - (30 * DAY_MS);
  const entries = trainingEntries(bookings, cohorts, identities);
  const upcoming = entries
    .filter((item) => timestamp(item.startsAt) > nowTime)
    .sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));
  const currentAndRecent = entries
    .filter((item) => {
      const startsAt = timestamp(item.startsAt);
      const endsAt = timestamp(item.endsAt);
      return (startsAt <= nowTime && endsAt >= nowTime) || (endsAt < nowTime && endsAt >= recentLimit);
    })
    .sort((left, right) => timestamp(right.endsAt) - timestamp(left.endsAt))
    .map((item) => ({
      ...item,
      detail: `${item.detail} · ${timestamp(item.endsAt) >= nowTime ? 'En cours' : 'Terminée'}`,
    }));

  return [
    {
      id: 'upcoming-trainings',
      title: 'Prochaines formations',
      count: upcoming.length,
      tone: 'info',
      summary: upcoming.length ? `${upcoming.length} formation${upcoming.length > 1 ? 's' : ''} à venir.` : 'Aucune formation à venir.',
      items: upcoming,
      emptyLabel: 'Aucune formation à venir actuellement.',
      href: OPERATIONAL_DESTINATIONS.sessions,
      actionLabel: 'Voir les formations',
    },
    {
      id: 'current-recent-trainings',
      title: 'Formations en cours et terminées',
      count: currentAndRecent.length,
      tone: 'info',
      summary: 'Formations en cours ou terminées depuis moins de 30 jours.',
      items: currentAndRecent,
      emptyLabel: 'Aucune formation en cours ou récemment terminée.',
      href: OPERATIONAL_DESTINATIONS.sessions,
      actionLabel: 'Voir les formations',
    },
  ];
}

function attendanceRecord(attendance, bookingId, session) {
  return attendance.find((record) => (
    record.booking_request_id === bookingId
    && timestamp(record.session_starts_at) === timestamp(session.starts_at)
    && timestamp(record.session_ends_at) === timestamp(session.ends_at)
  ));
}

function buildAttendanceSection(bookings, attendance, identities, now) {
  const nowTime = now.getTime();
  const pastLimit = nowTime - (30 * DAY_MS);
  const futureLimit = nowTime + (30 * DAY_MS);
  const items = bookings.flatMap((booking) => {
    if (['cancelled', 'rejected'].includes(booking.status)) return [];
    const identity = learnerIdentity(booking.user_id, identities);
    return plannedBookingSessions(booking).flatMap((session) => {
      const startsAt = timestamp(session.starts_at);
      const record = attendanceRecord(attendance, booking.id, session);
      const finalized = record?.learner_confirmed_at && record?.trainer_status !== 'pending';
      if (startsAt < pastLimit || startsAt > futureLimit || (startsAt < nowTime && finalized)) return [];
      return [{
        id: `attendance-${booking.id}-${session.id}`,
        title: identity.label,
        detail: `${courseLabel(booking.course_id)} · ${dateTimeLabel(session.starts_at)} · ${startsAt < nowTime ? 'À compléter' : 'À préparer'}`,
        href: attendanceDestination(booking.id),
        actionLabel: startsAt < nowTime ? 'Compléter' : 'Préparer',
        startsAt: session.starts_at,
      }];
    });
  }).sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));

  return {
    id: 'attendance',
    title: 'Émargements',
    count: items.length,
    tone: items.some((item) => timestamp(item.startsAt) < nowTime) ? 'warning' : 'info',
    summary: 'Séances à préparer ou compléter dans une fenêtre de 30 jours.',
    items,
    emptyLabel: 'Aucun émargement à préparer ou compléter.',
    href: '/admin/emargements',
    actionLabel: 'Voir les émargements',
  };
}

function buildQuestionnaireSection(bookings, surveys, identities, now) {
  const nowTime = now.getTime();
  const completedBookingIds = new Set(surveys.map((survey) => survey.booking_request_id).filter(Boolean));
  const items = bookings.flatMap((booking) => {
    const sessions = plannedBookingSessions(booking);
    const lastSession = sessions[sessions.length - 1];
    if (!lastSession || timestamp(lastSession.ends_at) > nowTime || completedBookingIds.has(booking.id)) return [];
    if (['cancelled', 'rejected'].includes(booking.status)) return [];
    const identity = learnerIdentity(booking.user_id, identities);
    return [{
      id: `questionnaire-${booking.id}`,
      title: identity.label,
      detail: `${courseLabel(booking.course_id)} · questionnaire de satisfaction attendu`,
      href: identity.href,
      actionLabel: 'Contrôler',
      endsAt: lastSession.ends_at,
    }];
  }).sort((left, right) => timestamp(right.endsAt) - timestamp(left.endsAt));
  return {
    id: 'questionnaires',
    title: 'Questionnaires',
    count: items.length,
    tone: items.length ? 'warning' : 'success',
    summary: items.length ? `${items.length} questionnaire${items.length > 1 ? 's' : ''} de satisfaction en attente.` : 'Tous les questionnaires attendus sont reçus.',
    items,
    emptyLabel: 'Aucun questionnaire en attente.',
    href: '/admin/pedagogique?onglet=users',
    actionLabel: 'Voir les apprenants',
  };
}

function groupInterEvaluations(items) {
  const grouped = new Map();
  const individual = [];
  items.forEach((item) => {
    if (!String(item.courseId || '').endsWith('-inter')) {
      individual.push(item);
      return;
    }
    const key = `${item.kind}:${item.courseId}`;
    const current = grouped.get(key) || [];
    current.push(item);
    grouped.set(key, current);
  });
  const groupedItems = [...grouped.entries()].map(([key, entries]) => ({
    id: `group-evaluation-${key}`,
    title: `${entries.length} participant${entries.length === 1 ? '' : 's'} concerné${entries.length === 1 ? '' : 's'}`,
    detail: `${courseLabel(entries[0].courseId)} · ${entries[0].kind === 'final_project' ? 'évaluation finale' : 'exercices'} à traiter`,
    href: `${OPERATIONAL_DESTINATIONS.corrections}&correction=${entries[0].kind === 'final_project' ? 'project' : 'exercise'}`,
    actionLabel: entries[0].kind === 'final_project' ? 'Évaluer' : 'Corriger',
    submittedAt: entries.reduce((latest, entry) => (
      (timestamp(entry.submittedAt) || 0) > (timestamp(latest) || 0) ? entry.submittedAt : latest
    ), null),
  }));
  return [...individual, ...groupedItems].sort((left, right) => timestamp(right.submittedAt) - timestamp(left.submittedAt));
}

function buildEvaluationSection({ exerciseSubmissions, exerciseReviews, finalSubmissions, finalReviews }, identities) {
  const reviewedExercises = new Set(exerciseReviews.map((review) => String(review.response_id)));
  const reviewedFinals = new Set(finalReviews.map((review) => String(review.submission_id)));
  const exercises = exerciseSubmissions
    .filter((submission) => !reviewedExercises.has(String(submission.id)))
    .map((submission) => ({
      id: `exercise-${submission.id}`,
      kind: 'exercise',
      courseId: submission.course_id,
      title: learnerIdentity(submission.user_id, identities).label,
      detail: `${courseLabel(submission.course_id)} · exercice ${submission.exercise_id} à corriger`,
      href: adminCorrectionPath({ kind: 'exercise', submissionId: submission.id }),
      actionLabel: 'Corriger',
      submittedAt: submission.saved_at,
    }));
  const finals = finalSubmissions
    .filter((submission) => !reviewedFinals.has(String(submission.id)))
    .map((submission) => ({
      id: `final-${submission.id}`,
      kind: 'final_project',
      courseId: submission.course_id,
      title: learnerIdentity(submission.user_id, identities).label,
      detail: `${courseLabel(submission.course_id)} · évaluation finale à réaliser`,
      href: adminCorrectionPath({ kind: 'final_project', submissionId: submission.id }),
      actionLabel: 'Évaluer',
      submittedAt: submission.saved_at,
    }));
  const items = groupInterEvaluations([...exercises, ...finals]);
  return {
    id: 'evaluations',
    title: 'Évaluations',
    count: items.length,
    tone: items.length ? 'warning' : 'success',
    summary: items.length ? `${items.length} évaluation${items.length > 1 ? 's' : ''} ou correction${items.length > 1 ? 's' : ''} en attente.` : 'Aucune évaluation en attente.',
    items,
    emptyLabel: 'Aucune évaluation ou correction en attente.',
    href: OPERATIONAL_DESTINATIONS.corrections,
    actionLabel: 'Voir les évaluations',
  };
}

export function buildOperationalCockpit(data = {}, { now = new Date() } = {}) {
  const identities = buildOperationalIdentityIndex(data);
  const bookings = data.bookings || [];
  const cohorts = data.cohorts || [];
  const [upcomingTrainings, currentRecentTrainings] = buildTrainingSections(bookings, cohorts, identities, now);
  return {
    generatedAt: now.toISOString(),
    searchIndex: buildCockpitSearchIndex(data.enrollments || [], cohorts, identities),
    sections: [
      buildAttendanceSection(bookings, data.attendance || [], identities, now),
      buildUnscheduledSection(bookings, cohorts, identities),
      buildTrainingReadinessSection(data.enrollments || [], identities, now),
      buildUpcomingSessionsSection(bookings, cohorts, identities, now),
      buildAvailabilitySection(data.availabilitySlots || [], now),
      upcomingTrainings,
      currentRecentTrainings,
      buildTrainingClosingSection(
        data.enrollments || [], bookings, data.attendance || [], data.surveys || [], identities, now,
      ),
      buildQuestionnaireSection(bookings, data.surveys || [], identities, now),
      buildEvaluationSection({
        exerciseSubmissions: data.exerciseSubmissions || [],
        exerciseReviews: data.exerciseReviews || [],
        finalSubmissions: data.finalSubmissions || [],
        finalReviews: data.finalReviews || [],
      }, identities),
    ],
  };
}

function queryError(result, fallback) {
  if (result?.error) throw new Error(result.error.message || fallback);
  return result?.data || [];
}

function queryRows(result, fallback) {
  const data = queryError(result, fallback);
  return Array.isArray(data) ? data : [];
}

export async function fetchOperationalCockpit(client, { now = new Date() } = {}) {
  const [
    availabilityResult,
    bookingsResult,
    cohortsResult,
    attendanceResult,
    enrollmentsResult,
    assessmentsResult,
    surveysResult,
    exerciseSubmissionsResult,
    exerciseReviewsResult,
    finalSubmissionsResult,
    finalReviewsResult,
  ] = await Promise.all([
    client.from('training_availability_slots').select('id, starts_at, ends_at, is_active, is_reserved'),
    client.from('course_booking_requests').select(`
      id, user_id, course_id, delivery_mode, schedule_format, status, created_at,
      course_session_bookings(id, starts_at, ends_at, duration_minutes, status, meeting_url)
    `),
    client.rpc('admin_list_course_cohorts'),
    client.from('course_session_attendance').select('booking_request_id, session_starts_at, session_ends_at, learner_confirmed_at, trainer_status'),
    client.from('training_enrollments').select(`
      id, user_id, course_id, status, enrollment_source, organization_name,
      learner_first_name, learner_last_name, funding_mode, funding_status,
      delivery_mode, training_location, remote_access_details, starts_at, ends_at,
      booking_request_id, updated_at,
      training_documents(id, document_type, status)
    `),
    client.from('course_positioning_assessments').select('user_id, learner_name, submitted_at'),
    client.from('satisfaction_surveys').select('booking_request_id, user_id, created_at'),
    client.from('course_exercise_latest_submissions').select('id, user_id, course_id, exercise_id, saved_at'),
    client.from('course_exercise_review_history').select('response_id'),
    client.from('course_final_project_latest_submissions').select('id, user_id, course_id, saved_at'),
    client.from('course_final_project_review_history').select('submission_id'),
  ]);

  return buildOperationalCockpit({
    availabilitySlots: queryRows(availabilityResult, 'Les disponibilités du cockpit sont indisponibles.'),
    bookings: queryRows(bookingsResult, 'Les réservations du cockpit sont indisponibles.'),
    cohorts: queryRows(cohortsResult, 'Les groupes du cockpit sont indisponibles.'),
    attendance: queryRows(attendanceResult, 'Les émargements du cockpit sont indisponibles.'),
    enrollments: queryRows(enrollmentsResult, 'Les identités du cockpit sont indisponibles.'),
    assessments: queryRows(assessmentsResult, 'Les identités pédagogiques du cockpit sont indisponibles.'),
    surveys: queryRows(surveysResult, 'Les questionnaires du cockpit sont indisponibles.'),
    exerciseSubmissions: queryRows(exerciseSubmissionsResult, 'Les corrections du cockpit sont indisponibles.'),
    exerciseReviews: queryRows(exerciseReviewsResult, 'Le suivi des corrections est indisponible.'),
    finalSubmissions: queryRows(finalSubmissionsResult, 'Les évaluations du cockpit sont indisponibles.'),
    finalReviews: queryRows(finalReviewsResult, 'Le suivi des évaluations est indisponible.'),
  }, { now });
}

export { OPERATIONAL_DESTINATIONS };
