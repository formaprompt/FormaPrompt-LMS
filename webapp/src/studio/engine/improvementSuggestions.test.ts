import { describe, expect, it } from 'vitest';
import { professionalEmailCategory } from '../categories/professionalEmail';
import { getPrioritySuggestions } from './improvementSuggestions';

describe('recommandations prioritaires du Studio', () => {
  it('limite les recommandations et les relie à un champ réel', () => {
    const suggestions = getPrioritySuggestions(
      professionalEmailCategory,
      professionalEmailCategory.defaultValues,
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    suggestions.forEach((suggestion) => {
      expect(professionalEmailCategory.fields.some((field) => field.name === suggestion.fieldName)).toBe(true);
      expect(suggestion.missingPoints).toBeGreaterThan(0);
    });
  });

  it('priorise les critères avec le plus de points manquants', () => {
    const suggestions = getPrioritySuggestions(
      professionalEmailCategory,
      professionalEmailCategory.defaultValues,
    );

    const missingPoints = suggestions.map((suggestion) => suggestion.missingPoints);
    expect(missingPoints).toEqual([...missingPoints].sort((first, second) => second - first));
  });

  it('affiche un état positif lorsque les critères sont suffisamment détaillés', () => {
    const values = Object.fromEntries(
      professionalEmailCategory.fields.map((field) => [field.name, 'Information professionnelle fictive suffisamment détaillée pour le contrôle du prompt.']),
    ) as typeof professionalEmailCategory.defaultValues;
    values.tone = 'professionnel et cordial';
    values.expectedFormat = 'un objet clair et un message de moins de 180 mots';

    expect(getPrioritySuggestions(professionalEmailCategory, values)).toEqual([]);
  });
});
