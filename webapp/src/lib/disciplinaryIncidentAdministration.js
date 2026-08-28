export const DISCIPLINARY_INCIDENT_STATUS_LABELS = Object.freeze({
  reported: 'Signalé',
  under_review: 'En cours d’instruction',
  conservatory_measure: 'Mesure conservatoire',
  hearing_pending: 'Entretien à organiser',
  decision_pending: 'Décision attendue',
  closed: 'Clôturé',
});

export function isDisciplinaryIncidentOpen(incident) {
  return incident?.incident_status !== 'closed';
}
