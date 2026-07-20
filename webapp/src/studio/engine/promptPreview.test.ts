import { describe, expect, it } from 'vitest';
import { professionalEmailCategory } from '../categories/professionalEmail';
import { calculateCategoryScore } from './scoreCategory';
import { buildFinalPrompt, buildPromptPreview, PROMPT_PREVIEW_MARKER } from './promptPreview';

const completeValues = {
  ...professionalEmailCategory.defaultValues,
  need: 'Préparer un courriel de suivi après une réunion professionnelle fictive.',
  recipient: 'Responsable de projet dans une entreprise partenaire',
  usefulInformation: 'La réunion a permis de valider trois actions et une prochaine échéance fictive.',
  role: 'un assistant de communication professionnelle précis et attentif au contexte du destinataire',
  objective: 'Récapituler les décisions et obtenir la confirmation de la prochaine étape avant vendredi.',
  successCriteria: 'Les trois actions, leur responsable et l’échéance sont immédiatement identifiables.',
  tone: 'professionnel et cordial',
  expectedFormat: 'un objet clair et un message de moins de 180 mots',
  requiredElements: 'Un objet, une synthèse des actions et une demande de confirmation.',
  constraints: 'Phrases courtes, aucune donnée personnelle et aucune information inventée.',
};

describe('prévisualisation déterministe du prompt', () => {
  it('construit progressivement le prompt sans inventer les sections absentes', () => {
    const preview = buildPromptPreview(professionalEmailCategory, {
      ...professionalEmailCategory.defaultValues,
      need: 'Préparer un courriel professionnel générique.',
    });

    expect(preview.prompt).toContain('Préparer un courriel professionnel générique.');
    expect(preview.prompt).toContain(professionalEmailCategory.defaultValues.role);
    expect(preview.prompt).toContain('Objectif à compléter');
    expect(preview.missingSections).toEqual(expect.arrayContaining(['context', 'objective', 'precisions']));
    expect(preview.missingSections).not.toContain('role');
  });

  it('utilise exactement le constructeur final lorsque tous les champs sont complétés', () => {
    const preview = buildPromptPreview(professionalEmailCategory, completeValues);
    const finalPrompt = buildFinalPrompt(professionalEmailCategory, completeValues);

    expect(preview.missingFields).toHaveLength(0);
    expect(preview.prompt).toBe(finalPrompt);
    expect(finalPrompt).not.toContain(PROMPT_PREVIEW_MARKER);
  });

  it('conserve le même score avec le moteur en direct et le résultat final', () => {
    const liveDiagnostic = calculateCategoryScore(professionalEmailCategory, completeValues);
    const finalDiagnostic = calculateCategoryScore(professionalEmailCategory, completeValues);

    expect(liveDiagnostic).toEqual(finalDiagnostic);
    expect(liveDiagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(liveDiagnostic.maxTotal).toBe(100);
  });
});
