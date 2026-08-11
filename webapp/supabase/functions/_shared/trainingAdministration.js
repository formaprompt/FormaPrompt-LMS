export const ADMINISTRATIVE_COURSES = {
  'formation-ia': {
    title: 'IA générative : comprendre, pratiquer et sécuriser ses usages',
    durationMinutes: 600,
    priceAmountCents: 49700,
    objectives: [
      "Comprendre les possibilités et les limites d'une IA générative.",
      'Structurer une demande et vérifier les résultats obtenus.',
      'Utiliser les outils de façon responsable dans un contexte professionnel.',
    ],
  },
  'formation-ia-act': {
    title: 'IA : acculturation et préparation à la conformité AI Act',
    durationMinutes: 240,
    priceAmountCents: 18700,
    objectives: [
      "Identifier les principaux repères de l'AI Act.",
      "Repérer les usages et les responsabilités au sein d'une organisation.",
      "Préparer un plan d'acculturation et de vigilance proportionné.",
    ],
  },
  'formation-prompt-level-1': {
    title: 'Formation Prompt Engineering – Niveau 1',
    durationMinutes: 420,
    priceAmountCents: 34300,
    objectives: [
      'Définir un besoin, un contexte et des critères de réussite.',
      'Construire puis améliorer un prompt de façon méthodique.',
      'Vérifier les résultats et transformer un prompt en modèle réutilisable.',
    ],
  },
};

export const ENROLLMENT_SOURCES = new Set(['manual', 'company', 'opco', 'free']);
export const FUNDING_MODES = new Set(['self_funded', 'company', 'opco', 'free', 'other']);
export const DELIVERY_MODES = new Set(['remote', 'in_person', 'hybrid']);

const PROVIDER = {
  legalName: 'Thierry FREZARD EI',
  tradeName: 'FormaPrompt',
  representative: 'Thierry FREZARD',
  address: '6 rue Webster, 62100 Calais, France',
  siret: '511 151 615 00016',
  activityDeclaration: '32620346362',
  email: 'thierry@formaprompt.com',
  phone: '+33 (0)6 12 19 53 81',
};

function requiredText(value, label, maximum = 200) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${label} requis.`);
  if (normalized.length > maximum) throw new Error(`${label} trop long.`);
  return normalized;
}

function optionalText(value, maximum = 500) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized.length > maximum) throw new Error('Une information administrative est trop longue.');
  return normalized;
}

function normalizedDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} invalide.`);
  return date.toISOString();
}

export function accessSourceForEnrollment(source) {
  return source === 'opco' ? 'opco' : 'manual';
}

export function shouldCreateEnrollmentCourseAccess(existingAccess) {
  return !existingAccess;
}

export function validateAdministrativeEnrollment(input = {}) {
  const course = ADMINISTRATIVE_COURSES[input.courseId];
  if (!course) throw new Error('Formation invalide.');
  if (!ENROLLMENT_SOURCES.has(input.enrollmentSource)) throw new Error("Origine d'inscription invalide.");
  if (!FUNDING_MODES.has(input.fundingMode)) throw new Error('Mode de financement invalide.');
  if (!DELIVERY_MODES.has(input.deliveryMode)) throw new Error('Modalité invalide.');

  const startsAt = normalizedDate(input.startsAt, 'Date de début');
  const endsAt = normalizedDate(input.endsAt, 'Date de fin');
  if (new Date(endsAt) <= new Date(startsAt)) throw new Error('La date de fin doit suivre la date de début.');

  const durationMinutes = Number(input.durationMinutes || course.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 60000) {
    throw new Error('Durée de formation invalide.');
  }

  const priceAmountCents = input.priceAmountCents === '' || input.priceAmountCents == null
    ? course.priceAmountCents
    : Number(input.priceAmountCents);
  if (!Number.isInteger(priceAmountCents) || priceAmountCents < 0) throw new Error('Tarif invalide.');

  const learnerEmail = requiredText(input.learnerEmail, "Adresse e-mail de l'apprenant", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(learnerEmail)) throw new Error('Adresse e-mail invalide.');

  return {
    targetUserId: optionalText(input.targetUserId, 80),
    learnerEmail,
    courseId: input.courseId,
    enrollmentSource: input.enrollmentSource,
    fundingMode: input.fundingMode,
    organizationName: optionalText(input.organizationName, 200),
    learnerFirstName: requiredText(input.learnerFirstName, 'Prénom', 100),
    learnerLastName: requiredText(input.learnerLastName, 'Nom', 120),
    learnerJobTitle: optionalText(input.learnerJobTitle, 150),
    learnerPhone: optionalText(input.learnerPhone, 30),
    learnerAddressLine1: optionalText(input.learnerAddressLine1, 250),
    learnerPostalCode: optionalText(input.learnerPostalCode, 20),
    learnerCity: optionalText(input.learnerCity, 120),
    funderName: optionalText(input.funderName, 200),
    fundingReference: optionalText(input.fundingReference, 120),
    deliveryMode: input.deliveryMode,
    trainingLocation: optionalText(input.trainingLocation, 500),
    remoteAccessDetails: optionalText(input.remoteAccessDetails, 1000),
    startsAt,
    endsAt,
    durationMinutes,
    priceAmountCents,
    administrativeNotes: optionalText(input.administrativeNotes, 4000),
  };
}

function sharedSnapshot(enrollment, learnerEmail, generatedAt) {
  const course = ADMINISTRATIVE_COURSES[enrollment.course_id];
  return {
    version: 1,
    generatedAt,
    provider: PROVIDER,
    learner: {
      firstName: enrollment.learner_first_name,
      lastName: enrollment.learner_last_name,
      fullName: `${enrollment.learner_first_name} ${enrollment.learner_last_name}`.trim(),
      email: learnerEmail,
      jobTitle: enrollment.learner_job_title,
      phone: enrollment.learner_phone,
      addressLine1: enrollment.learner_address_line1,
      postalCode: enrollment.learner_postal_code,
      city: enrollment.learner_city,
    },
    client: {
      organizationName: enrollment.organization_name,
      funderName: enrollment.funder_name,
      fundingReference: enrollment.funding_reference,
      fundingMode: enrollment.funding_mode,
    },
    course: {
      id: enrollment.course_id,
      title: course.title,
      objectives: course.objectives,
      durationMinutes: enrollment.duration_minutes,
      priceAmountCents: enrollment.price_amount_cents,
      deliveryMode: enrollment.delivery_mode,
      startsAt: enrollment.starts_at,
      endsAt: enrollment.ends_at,
      location: enrollment.training_location,
      remoteAccessDetails: enrollment.remote_access_details,
    },
    enrollment: {
      id: enrollment.id,
      source: enrollment.enrollment_source,
      status: enrollment.status,
      enrolledAt: enrollment.enrolled_at,
    },
  };
}

export function buildAdministrativeDocument(documentType, enrollment, learnerEmail, generatedAt = new Date().toISOString()) {
  const base = sharedSnapshot(enrollment, learnerEmail, generatedAt);

  if (documentType === 'training_agreement') {
    return {
      ...base,
      documentType,
      title: enrollment.organization_name ? 'Convention de formation professionnelle' : 'Contrat de formation professionnelle',
      clauses: [
        'Le présent document précise la nature, les objectifs, la durée et les modalités de la formation.',
        "L'accès à l'espace apprenant est personnel et réservé au participant inscrit.",
        "Les conditions d'annulation, de règlement et de propriété intellectuelle relèvent des CGV FormaPrompt applicables.",
      ],
    };
  }

  if (documentType === 'convocation') {
    return {
      ...base,
      documentType,
      title: 'Convocation à une action de formation',
      instructions: enrollment.delivery_mode === 'remote'
        ? 'Connectez-vous quelques minutes avant le début de la séance avec un ordinateur, un microphone et une connexion stable.'
        : 'Présentez-vous quelques minutes avant le début de la séance avec le matériel indiqué par le formateur.',
    };
  }

  if (documentType === 'completion_certificate') {
    return {
      ...base,
      documentType,
      title: 'Attestation de fin de formation',
      completion: {
        completedAt: enrollment.completed_at || generatedAt,
        statement: `La personne désignée a suivi la formation « ${base.course.title} » pour une durée prévue de ${base.course.durationMinutes} minutes.`,
      },
    };
  }

  throw new Error('Type de document non générable.');
}

export function documentRowsForValidatedEnrollment(enrollment, learnerEmail, actorId, generatedAt = new Date().toISOString()) {
  const readyTypes = ['training_agreement', 'convocation'];
  const missingTypes = [
    ...(!enrollment.booking_request_id ? ['attendance_sheet'] : []),
    'completion_certificate',
    'satisfaction_questionnaire',
  ];
  const attendanceRows = enrollment.booking_request_id ? [{
    enrollment_id: enrollment.id,
    user_id: enrollment.user_id,
    course_id: enrollment.course_id,
    document_type: 'attendance_sheet',
    status: 'ready',
    version: 1,
    content_snapshot: {
      version: 1,
      documentType: 'attendance_sheet',
      bookingRequestId: enrollment.booking_request_id,
    },
    visible_to_learner: false,
    generated_by: actorId,
    generated_at: generatedAt,
    updated_at: generatedAt,
  }] : [];
  return [
    ...readyTypes.map((documentType) => ({
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
      course_id: enrollment.course_id,
      document_type: documentType,
      status: 'ready',
      version: 1,
      content_snapshot: buildAdministrativeDocument(documentType, enrollment, learnerEmail, generatedAt),
      visible_to_learner: true,
      generated_by: actorId,
      generated_at: generatedAt,
      updated_at: generatedAt,
    })),
    ...attendanceRows,
    ...missingTypes.map((documentType) => ({
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
      course_id: enrollment.course_id,
      document_type: documentType,
      status: 'missing',
      version: 1,
      content_snapshot: { version: 1, documentType },
      visible_to_learner: false,
      generated_by: null,
      generated_at: null,
      updated_at: generatedAt,
    })),
  ];
}
