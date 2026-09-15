const EXCEL_LEVEL_BY_COURSE_ID = Object.freeze({
  'excel-initiation-inter': 'initiation',
  'excel-initiation-individuel': 'initiation',
  'excel-perfectionnement-inter': 'perfectionnement',
  'excel-perfectionnement-individuel': 'perfectionnement',
  'excel-avance-inter': 'avance',
  'excel-avance-individuel': 'avance',
});

const resource = (title, description, fileName) => Object.freeze({ title, description, fileName });

export const EXCEL_RESOURCES_BY_LEVEL = Object.freeze({
  initiation: Object.freeze({
    learner: Object.freeze([
      resource('Exercices Excel Initiation', 'Fichier d’exercices à réaliser pendant la formation.', 'Exercices_Excel_Initiation_Apprenant.xlsx'),
      resource('Cas pratique final', 'Cas de synthèse à réaliser en fin de parcours.', 'Cas_final_Excel_Initiation_Apprenant.xlsx'),
      resource('Visuel colis fictif', 'Image fictive à insérer dans le cas pratique final.', 'Visuel_colis_fictif.png'),
    ]),
    trainer: Object.freeze([
      resource('Corrigé des exercices Excel Initiation', 'Version Excel réservée au formateur.', 'Exercices_Excel_Initiation_Corrige.xlsx'),
      resource('Corrigé des exercices Excel Initiation – PDF', 'Aperçu PDF réservé au formateur.', 'Exercices_Excel_Initiation_Corrige.pdf'),
      resource('Corrigé du cas pratique final', 'Version Excel réservée au formateur.', 'Cas_final_Excel_Initiation_Corrige.xlsx'),
      resource('Corrigé du cas pratique final – PDF', 'Aperçu PDF réservé au formateur.', 'Cas_final_Excel_Initiation_Corrige.pdf'),
      resource('Guide formateur Excel Initiation', 'Déroulé pédagogique réservé au formateur.', 'Guide_Excel_Initiation_14h.pdf'),
    ]),
  }),
  perfectionnement: Object.freeze({
    learner: Object.freeze([
      resource('Exercice Excel Perfectionnement', 'Classeur d’exercice à compléter pendant la formation.', 'Exercice_apprenant_Excel_Perfectionnement.xlsx'),
    ]),
    trainer: Object.freeze([
      resource('Corrigé Excel Perfectionnement', 'Classeur corrigé réservé au formateur.', 'Corrige_formateur_Excel_Perfectionnement.xlsx'),
      resource('Corrigé Excel Perfectionnement – PDF', 'Version PDF du corrigé réservée au formateur.', 'Corrige_formateur_Excel_Perfectionnement.pdf'),
      resource('Guide formateur Excel Perfectionnement', 'Déroulé pédagogique réservé au formateur.', 'Guide_Excel_Perfectionnement.pdf'),
    ]),
  }),
  avance: Object.freeze({
    learner: Object.freeze([
      resource('Recherches et calculs', 'Classeur apprenant sur les recherches et les calculs avancés.', '01_Recherches_calculs_apprenant.xlsx'),
      resource('Tableaux et fonctions dynamiques', 'Classeur apprenant sur les tableaux et fonctions dynamiques.', '02_Tableaux_dynamiques_apprenant.xlsx'),
      resource('LET et LAMBDA', 'Classeur apprenant sur LET et la découverte de LAMBDA.', '03_LET_LAMBDA_apprenant.xlsx'),
      resource('Cas final Excel Avancé', 'Cas de synthèse à réaliser en fin de parcours.', '04_Cas_final_apprenant.xlsx'),
    ]),
    trainer: Object.freeze([
      resource('Corrigé – Recherches et calculs', 'Classeur corrigé réservé au formateur.', '01_Recherches_calculs_corrige.xlsx'),
      resource('Corrigé – Tableaux et fonctions dynamiques', 'Classeur corrigé réservé au formateur.', '02_Tableaux_dynamiques_corrige.xlsx'),
      resource('Corrigé – LET et LAMBDA', 'Classeur corrigé réservé au formateur.', '03_LET_LAMBDA_corrige.xlsx'),
      resource('Corrigé – Cas final Excel Avancé', 'Classeur corrigé réservé au formateur.', '04_Cas_final_corrige.xlsx'),
      resource('Guide formateur Excel Avancé', 'Déroulé pédagogique réservé au formateur.', 'Guide_formateur_Excel_Avance.pdf'),
      resource('Grille d’évaluation du cas final', 'Grille d’évaluation réservée au formateur.', 'Grille_evaluation_cas_final.md'),
    ]),
  }),
});

export function validateExcelCourseId(value) {
  const courseId = typeof value === 'string' ? value.trim() : '';
  if (!Object.hasOwn(EXCEL_LEVEL_BY_COURSE_ID, courseId)) throw new Error('Formation Excel invalide.');
  return courseId;
}

export function excelResourcesForCourse(courseId, audience) {
  const validatedCourseId = validateExcelCourseId(courseId);
  if (audience !== 'learner' && audience !== 'trainer') throw new Error('Audience Excel invalide.');
  return EXCEL_RESOURCES_BY_LEVEL[EXCEL_LEVEL_BY_COURSE_ID[validatedCourseId]][audience];
}

export function excelResourceObjectPath(courseId, audience, resourceItem) {
  const validatedCourseId = validateExcelCourseId(courseId);
  if (audience !== 'learner' && audience !== 'trainer') throw new Error('Audience Excel invalide.');
  const fileName = typeof resourceItem?.fileName === 'string' ? resourceItem.fileName : '';
  if (!/^[A-Za-z0-9À-ÿ_.-]{1,180}[.](?:xlsx|pdf|png|md)$/u.test(fileName) || fileName.includes('..')) {
    throw new Error('Ressource Excel invalide.');
  }
  const level = EXCEL_LEVEL_BY_COURSE_ID[validatedCourseId];
  const directory = audience === 'learner' ? 'apprenants' : 'formateur';
  return `excel-${level}/${directory}/${fileName}`;
}
