export const PRIVACY_CONCLUSION_LABELS = {
  full_erasure_possible: 'Effacement complet potentiellement possible',
  partial_erasure_or_anonymization_required: 'Effacement partiel ou anonymisation à étudier',
  retention_justified: 'Conservation justifiée par décision humaine',
  manual_legal_review_required: 'Revue juridique manuelle requise',
};

export const PRIVACY_STATUS_LABELS = {
  received: 'Demande reçue',
  identity_check: 'Identité à vérifier',
  under_analysis: 'Analyse en cours',
  under_review: 'Revue humaine',
  decision_recorded: 'Décision enregistrée',
  ready_for_execution: 'Prête pour exécution contrôlée',
  processing: 'Traitement en cours',
  external_action_required: 'Action externe requise',
  closed: 'Dossier clôturé',
};

export const PRIVACY_RESOLUTION_LABELS = {
  delete: 'Supprimer les données de cette catégorie',
  anonymize: 'Anonymiser les identifiants directs',
  retain: 'Conserver avec justification légale',
  disable_access: 'Révoquer les accès pédagogiques',
  external_action: 'Traiter via le service serveur ou externe',
};

export const PRIVACY_ACTION_STATUS_LABELS = {
  proposed: 'Décision requise',
  approved: 'Approuvée, en attente d’exécution',
  executed: 'Exécutée',
  deferred: 'Différée',
  rejected: 'Refusée',
  failed: 'Échec à reprendre',
};

export const PRIVACY_ACTION_LABELS = {
  deletion_candidate: 'Suppression envisageable',
  anonymization_to_review: 'Anonymisation à étudier',
  potential_retention_to_review: 'Conservation potentiellement nécessaire – validation juridique requise',
  legal_review_required: 'Revue juridique nécessaire',
  external_verification_required: 'Vérification externe nécessaire',
};

export const PRIVACY_CATEGORY_LABELS = {
  profile: 'Profil',
  auth_identity: 'Compte de connexion',
  course_access: 'Droits de formation',
  purchases: 'Achats',
  commercial_checkout_intents: 'Intentions de paiement',
  commercial_consents: 'Preuves de consentement commercial',
  withdrawal_requests: 'Demandes de rétractation',
  commercial_payment_reviews: 'Revues administratives de paiement',
  booking_requests: 'Demandes de réservation',
  session_bookings: 'Inscriptions aux sessions',
  attendance: 'Émargements',
  attendance_audit: 'Journal des émargements',
  lesson_progress: 'Progression',
  positioning: 'Positionnements',
  exercise_responses: 'Exercices',
  exercise_reviews: 'Corrections',
  final_projects: 'Projets finaux',
  final_project_reviews: 'Évaluations finales',
  attestations: 'Attestations',
  satisfaction: 'Satisfaction',
  satisfaction_without_fk: 'Satisfaction détectée par email',
  training_enrollments: 'Dossiers OF / OPCO',
  training_documents: 'Documents OF / OPCO',
  disciplinary_incidents: 'Incidents disciplinaires',
  disciplinary_hearings: 'Entretiens disciplinaires',
  audit_logs: 'Journaux d’audit',
  contact_requests: 'Demandes de contact',
  calendar_text_matches: 'Réservations calendrier détectées dans du texte',
  snapshot_matches: 'Données détectées dans des snapshots',
  storage_objects: 'Fichiers Supabase Storage',
  stripe_external: 'Stripe',
  meeting_provider_external: 'Outil de classe virtuelle',
  staff_account: 'Compte personnel ou administrateur',
};

export function allowedPrivacyResolutions(category) {
  if (['profile', 'auth_identity'].includes(category)) return ['external_action'];
  if (category === 'course_access') return ['disable_access', 'retain'];
  if (category === 'lesson_progress') return ['delete', 'retain'];
  if (['contact_requests', 'satisfaction', 'satisfaction_without_fk'].includes(category)) {
    return ['delete', 'anonymize', 'retain'];
  }
  if (['storage_objects', 'stripe_external', 'meeting_provider_external', 'calendar_text_matches', 'snapshot_matches'].includes(category)) {
    return ['external_action', 'retain'];
  }
  return ['retain'];
}

export function privacyExecutionPhrase(subjectReference) {
  return subjectReference ? `EFFACER ${subjectReference}` : '';
}

export function latestAssessmentRun(assessments) {
  const latest = assessments.reduce((current, assessment) => {
    if (!current || new Date(assessment.assessed_at) > new Date(current.assessed_at)) return assessment;
    return current;
  }, null);
  return latest
    ? assessments.filter((assessment) => assessment.analysis_run_id === latest.analysis_run_id)
    : [];
}

export function privacyIdentityMatches(profile, search) {
  const needle = search.trim().toLocaleLowerCase('fr-FR');
  return !needle || profile.email.toLocaleLowerCase('fr-FR').includes(needle);
}
