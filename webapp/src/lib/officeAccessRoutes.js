import { BUREAUTIQUE_PURCHASES, OFFICE_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';

export const OFFICE_SUPPORTS = Object.freeze({
  'word-initiation': { label: 'Word Initiation' },
  'word-perfectionnement': { label: 'Word Perfectionnement' },
  'powerpoint-initiation': { label: 'PowerPoint Initiation' },
  ...Object.fromEntries(Object.entries(OFFICE_PURCHASES).map(([courseId, offer]) => [
    courseId,
    { label: offer.label },
  ])),
});

export function officeResourceRoute(courseId) {
  return Object.hasOwn(OFFICE_SUPPORTS, courseId)
    ? `/course/office-supports/${courseId}`
    : null;
}

// Les destinations privées des offres commerciales restent définies dans le
// catalogue serveur partagé. Une carte de droit active ne doit jamais repasser
// par la confirmation de paiement, notamment lorsqu'un accès a été offert.
export function bureautiqueResourceRoute(courseId) {
  return BUREAUTIQUE_PURCHASES[courseId]?.resourcePath || officeResourceRoute(courseId);
}
