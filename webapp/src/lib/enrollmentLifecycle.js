export const FUNDING_STATUS_LABELS = {
  not_requested: 'Non demandé',
  requested: 'Demandé',
  under_review: 'En instruction',
  partially_granted: 'Accord partiel',
  granted: 'Accordé',
  refused: 'Refusé',
  withdrawn: 'Retiré',
};

export const EVENT_LABELS = {
  initial_snapshot: 'Création du dossier',
  dossier_updated: 'Dossier actualisé',
  funding_updated: 'Financement actualisé',
  cancelled: 'Inscription annulée',
  postponed: 'Formation reportée',
  beneficiary_transferred: 'Bénéficiaire transféré',
  abandoned: 'Abandon enregistré',
  amendment_created: 'Avenant créé',
};

export function euroAmount(cents) {
  if (cents == null) return 'Non renseigné';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function filterAdministrativeEnrollments(enrollments, filters = {}) {
  const needle = (filters.search || '').trim().toLocaleLowerCase('fr-FR');
  return enrollments.filter((enrollment) => {
    if (filters.status && enrollment.status !== filters.status) return false;
    if (filters.fundingStatus && enrollment.funding_status !== filters.fundingStatus) return false;
    if (!needle) return true;
    return [
      enrollment.learner_first_name, enrollment.learner_last_name, enrollment.profiles?.email,
      enrollment.organization_name, enrollment.funder_name, enrollment.funding_reference,
      enrollment.client_name, enrollment.payer_name,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR').includes(needle);
  });
}

export function sortedLifecycleItems(enrollment) {
  return [
    ...(enrollment.training_enrollment_events || []).map((item) => ({ ...item, kind: 'event' })),
    ...(enrollment.training_amendments || []).map((item) => ({ ...item, kind: 'amendment' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
