import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { imageCreationCategory, type ImageCreationValues } from './imageCreation';

const completeValues: ImageCreationValues = {
  visualNeed: 'Une personne adulte en reconversion utilisant un ordinateur portable.',
  actionPosture: 'Assise face à l’écran, elle construit un tableau pendant qu’un formateur lui montre une étape.',
  decor: 'Salle de formation lumineuse, mobilier sobre, arrière-plan ordonné et peu chargé.',
  audience: 'adultes débutants en reconversion découvrant les outils bureautiques',
  intendedUse: 'illustration pour un support de formation',
  role: 'un directeur artistique spécialisé dans l’illustration pédagogique professionnelle, lisible et accessible',
  visualObjective: 'Transmettre une impression de progression accessible, de clarté et d’accompagnement bienveillant pendant l’apprentissage.',
  successCriteria: 'Le sujet principal est compris immédiatement, le décor reste discret et les contrastes sont suffisants.',
  style: 'illustration éditoriale moderne et professionnelle',
  composition: 'composition claire avec un sujet principal immédiatement identifiable',
  viewAngle: 'vue de trois quarts',
  lighting: 'Lumière naturelle douce venant de la gauche, sans ombres dures.',
  mood: 'Ambiance rassurante, studieuse, positive et accessible.',
  colors: 'Verts et bleus sobres, fond clair et contraste élevé sur le sujet principal.',
  aspectRatio: 'format horizontal 16:9',
  realismLevel: 'semi-réaliste avec des détails maîtrisés',
  textInImage: 'aucun texte intégré dans l’image',
  targetTool: 'ChatGPT Images',
  requiredElements: 'Ordinateur portable, tableau lisible, interaction bienveillante et espace libre dans le tiers supérieur.',
  constraints: 'Aucun logo, aucune marque, aucun texte intégré, aucun visage identifiable et aucune interface reproduite à l’identique.',
};

describe('catégorie Création d’image', () => {
  it('demande explicitement tous les repères visuels minimaux et les outils ciblés', () => {
    const requiredFieldNames = imageCreationCategory.fields
      .filter((field) => field.required)
      .map((field) => field.name);

    expect(requiredFieldNames).toEqual(expect.arrayContaining([
      'visualNeed',
      'actionPosture',
      'decor',
      'style',
      'composition',
      'viewAngle',
      'lighting',
      'mood',
      'colors',
      'aspectRatio',
      'realismLevel',
      'constraints',
      'textInImage',
      'targetTool',
    ]));

    const targetTool = imageCreationCategory.fields.find((field) => field.name === 'targetTool');
    expect(targetTool?.options?.map((option) => option.label)).toEqual([
      'ChatGPT Images',
      'Midjourney',
      'Flux',
      'Stable Diffusion',
      'Adobe Firefly',
      'Ideogram',
      'Leonardo',
      'Autre outil',
    ]);
  });

  it('valide une consigne complète et lui attribue 100 points', () => {
    expect(imageCreationCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(imageCreationCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque la direction visuelle est précisée', () => {
    const weakValues: ImageCreationValues = {
      ...completeValues,
      visualNeed: 'Une personne apprend.',
      actionPosture: 'Assise devant un écran.',
      decor: 'Une salle sobre.',
      audience: 'adultes',
      role: 'un graphiste',
      visualObjective: 'Montrer un apprentissage accessible.',
      successCriteria: '',
      lighting: 'Douce',
      mood: 'Calme',
      colors: 'Bleu',
      requiredElements: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(imageCreationCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(imageCreationCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit un prompt déterministe et rappelle les limites relatives aux droits', () => {
    const firstPrompt = imageCreationCategory.buildPrompt(completeValues);
    const secondPrompt = imageCreationCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Objectif visuel');
    expect(firstPrompt).toContain('Format et ratio : format horizontal 16:9');
    expect(firstPrompt).toContain('Outil visé : ChatGPT Images');
    expect(firstPrompt).toContain('aucun logo, marque, texte, personne réelle ou élément protégé');
  });
});
