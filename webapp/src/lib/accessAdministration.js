export function normalizeAdministrativeIdentitySearch(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function joinName(firstName, lastName) {
  return [firstName, lastName].map((value) => value?.trim()).filter(Boolean).join(' ');
}

export function buildAdministrativeIdentityMap(
  profiles = [],
  trainingEnrollments = [],
  positioningAssessments = [],
) {
  const nameByUserId = new Map();

  trainingEnrollments.forEach((enrollment) => {
    if (nameByUserId.has(enrollment.user_id)) return;
    const name = joinName(enrollment.learner_first_name, enrollment.learner_last_name);
    if (name) nameByUserId.set(enrollment.user_id, name);
  });

  positioningAssessments.forEach((assessment) => {
    if (nameByUserId.has(assessment.user_id)) return;
    const name = assessment.learner_name?.trim();
    if (name) nameByUserId.set(assessment.user_id, name);
  });

  return new Map(profiles.map((profile) => [profile.id, {
    userId: profile.id,
    fullName: nameByUserId.get(profile.id) || 'Nom non renseigné',
    email: profile.email || 'Adresse e-mail non renseignée',
    role: profile.role,
  }]));
}

export function filterAdministrativeAccesses(
  accesses,
  identityByUserId,
  search,
  courseLabels,
  statusLabels,
) {
  const term = normalizeAdministrativeIdentitySearch(search);
  if (!term) return accesses;

  return accesses.filter((access) => {
    const identity = identityByUserId.get(access.user_id);
    return normalizeAdministrativeIdentitySearch([
      identity?.fullName,
      identity?.email,
      courseLabels[access.course_id],
      statusLabels[access.status],
      access.user_id,
      access.id,
    ].filter(Boolean).join(' ')).includes(term);
  });
}

export function createAccessActionTarget(type, access) {
  return {
    type,
    accessId: access.id,
    expectedUserId: access.user_id,
    expectedCourseId: access.course_id,
  };
}

export function isAccessActionTargetConsistent(target, access) {
  return Boolean(
    target
    && access
    && target.accessId === access.id
    && target.expectedUserId === access.user_id
    && target.expectedCourseId === access.course_id,
  );
}

export function accessAuditSentence(actionType, courseLabel) {
  const action = {
    access_granted: 'attribué',
    access_suspended: 'suspendu',
    access_reactivated: 'réactivé après suspension',
    access_revoked: 'révoqué',
    access_restored: 'restauré après révocation',
    access_marked_refunded: 'marqué comme remboursé',
    course_access_target_mismatch: 'refusé en raison d’une cible incohérente',
  }[actionType] || 'mis à jour';

  return `Accès à « ${courseLabel} » ${action}`;
}
