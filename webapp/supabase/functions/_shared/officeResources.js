const OFFICE_COURSE_BY_ID = Object.freeze({
  'word-initiation': Object.freeze({
    label: 'Word Initiation',
    learnerFile: 'Pack_apprenant_Word_Initiation.zip',
    trainerFile: 'Pack_formateur_Word_Initiation.zip',
  }),
  'word-perfectionnement': Object.freeze({
    label: 'Word Perfectionnement',
    learnerFile: 'Pack_apprenant_Word_Perfectionnement.zip',
    trainerFile: 'Pack_formateur_Word_Perfectionnement.zip',
  }),
  'powerpoint-initiation': Object.freeze({
    label: 'PowerPoint Initiation',
    learnerFile: 'PowerPoint_Initiation_14h_Pack_apprenant.zip',
    trainerFile: 'PowerPoint_Initiation_14h_Pack_formateur.zip',
  }),
});

const OFFICE_CANONICAL_ID_BY_ACCESS_ID = Object.freeze({
  'word-initiation': 'word-initiation',
  'word-initiation-inter': 'word-initiation',
  'word-initiation-individuel': 'word-initiation',
  'word-perfectionnement': 'word-perfectionnement',
  'word-perfectionnement-inter': 'word-perfectionnement',
  'word-perfectionnement-individuel': 'word-perfectionnement',
  'powerpoint-initiation': 'powerpoint-initiation',
  'powerpoint-initiation-inter': 'powerpoint-initiation',
  'powerpoint-initiation-individuel': 'powerpoint-initiation',
});

export const OFFICE_COURSE_IDS = Object.freeze(Object.keys(OFFICE_CANONICAL_ID_BY_ACCESS_ID));

export function validateOfficeCourseId(value) {
  const courseId = typeof value === 'string' ? value.trim() : '';
  if (!Object.hasOwn(OFFICE_CANONICAL_ID_BY_ACCESS_ID, courseId)) throw new Error('Formation bureautique invalide.');
  return courseId;
}

export function canonicalOfficeCourseId(value) {
  return OFFICE_CANONICAL_ID_BY_ACCESS_ID[validateOfficeCourseId(value)];
}

export function officeResourcesForCourse(courseId, audience) {
  const validatedCourseId = validateOfficeCourseId(courseId);
  if (audience !== 'learner' && audience !== 'trainer') throw new Error('Audience bureautique invalide.');
  const course = OFFICE_COURSE_BY_ID[canonicalOfficeCourseId(validatedCourseId)];
  const learner = audience === 'learner';
  const fileName = learner ? course.learnerFile : course.trainerFile;
  return Object.freeze([
    Object.freeze({
      title: learner ? `Pack apprenant ${course.label}` : `Pack formateur ${course.label}`,
      description: learner
        ? 'Exercices, fichiers de départ et cas pratique final réservés aux participants inscrits.'
        : 'Corrigés, guide pédagogique et grille d’évaluation réservés au formateur.',
      fileName,
    }),
  ]);
}

export function officeResourceObjectPath(courseId, audience, resourceItem) {
  const validatedCourseId = validateOfficeCourseId(courseId);
  if (audience !== 'learner' && audience !== 'trainer') throw new Error('Audience bureautique invalide.');
  const fileName = typeof resourceItem?.fileName === 'string' ? resourceItem.fileName : '';
  if (!/^[A-Za-z0-9À-ÿ_.-]{1,180}[.]zip$/u.test(fileName) || fileName.includes('..')) {
    throw new Error('Ressource bureautique invalide.');
  }
  const directory = audience === 'learner' ? 'apprenants' : 'formateur';
  return `${canonicalOfficeCourseId(validatedCourseId)}/${directory}/${fileName}`;
}
