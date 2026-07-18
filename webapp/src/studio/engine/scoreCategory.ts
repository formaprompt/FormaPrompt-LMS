import type { FieldValues } from 'react-hook-form';
import type { StudioCategoryConfig, StudioDiagnostic } from '../types';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function calculateCategoryScore<TValues extends FieldValues>(
  category: StudioCategoryConfig<TValues>,
  values: TValues,
): StudioDiagnostic {
  const criteria = category.scoreRules.map((rule) => {
    const evaluation = rule.evaluate(values);
    return {
      id: rule.id,
      label: rule.label,
      maxPoints: rule.maxPoints,
      description: rule.description,
      checkpoints: rule.checkpoints,
      ...evaluation,
      earnedPoints: clamp(evaluation.earnedPoints, 0, rule.maxPoints),
    };
  });

  const maxTotal = criteria.reduce((total, criterion) => total + criterion.maxPoints, 0);
  const earnedTotal = criteria.reduce((total, criterion) => total + criterion.earnedPoints, 0);
  const total = maxTotal === 0 ? 0 : Math.round((earnedTotal / maxTotal) * 100);

  let summary = 'Le prompt est encore incomplet. Commencez par les recommandations prioritaires.';
  if (total >= 85) {
    summary = 'Le prompt est bien cadré. Une relecture humaine reste nécessaire avant utilisation.';
  } else if (total >= 65) {
    summary = 'Le prompt possède une base solide, mais certains éléments peuvent encore être précisés.';
  } else if (total >= 40) {
    summary = 'Le besoin est identifiable, mais plusieurs informations utiles manquent encore.';
  }

  return { total, maxTotal: 100, criteria, summary };
}
