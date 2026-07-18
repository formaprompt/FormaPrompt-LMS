import { describe, expect, it } from 'vitest';
import { professionalEmailCategory, type ProfessionalEmailValues } from '../categories/professionalEmail';
import { calculateCategoryScore } from './scoreCategory';

const completeValues: ProfessionalEmailValues = {
  need: 'Préparer un courriel de rappel avant une classe virtuelle destinée à des adultes débutants, avec toutes les informations pratiques nécessaires.',
  recipient: 'participants adultes inscrits à une formation à distance',
  usefulInformation: 'La séance fictive a lieu mardi à 9 h. La connexion est recommandée dix minutes avant et le lien figure dans la convocation.',
  role: 'un assistant spécialisé en communication pédagogique, attentif à la clarté et à l’accessibilité',
  objective: 'Rappeler les modalités de connexion et obtenir une confirmation de présence avant la veille de la séance.',
  successCriteria: 'Le message tient en moins de 180 mots, toutes les étapes sont présentes et la demande de confirmation est explicite.',
  tone: 'professionnel et cordial',
  expectedFormat: 'courriel concis avec un objet et des paragraphes courts',
  requiredElements: 'Objet, date fictive, heure, matériel conseillé, lien dans la convocation et demande de confirmation.',
  constraints: 'Moins de 180 mots, phrases courtes, aucun jargon, aucune donnée personnelle et aucune information inventée.',
};

describe('moteur de diagnostic CROP', () => {
  it('attribue 100 points à un cadrage qui satisfait tous les seuils documentés', () => {
    const diagnostic = calculateCategoryScore(professionalEmailCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria).toHaveLength(4);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.reduce((total, criterion) => total + criterion.maxPoints, 0)).toBe(100);
    expect(diagnostic.criteria.every((criterion) => criterion.description.length > 20)).toBe(true);
    expect(diagnostic.criteria.every((criterion) => criterion.checkpoints.length > 0)).toBe(true);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque les champs faibles sont complétés', () => {
    const weakValues: ProfessionalEmailValues = {
      ...completeValues,
      need: 'Préparer un rappel de réunion.',
      recipient: 'équipe',
      usefulInformation: '',
      role: 'un rédacteur',
      objective: 'Rappeler la réunion prévue.',
      successCriteria: '',
      requiredElements: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(professionalEmailCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(professionalEmailCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('produit toujours le même score et le même prompt pour la même saisie', () => {
    const firstDiagnostic = calculateCategoryScore(professionalEmailCategory, completeValues);
    const secondDiagnostic = calculateCategoryScore(professionalEmailCategory, { ...completeValues });

    expect(secondDiagnostic).toEqual(firstDiagnostic);
    expect(professionalEmailCategory.buildPrompt(completeValues)).toBe(
      professionalEmailCategory.buildPrompt({ ...completeValues }),
    );
  });
});
