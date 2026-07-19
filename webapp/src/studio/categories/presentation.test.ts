import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { presentationCategory, type PresentationValues } from './presentation';

const completeValues: PresentationValues = {
  presentationContext: 'Présenter les résultats anonymisés d’un projet fictif lors d’une réunion mensuelle afin de partager les enseignements et préparer la décision sur les prochaines étapes.',
  audience: 'Responsables de service connaissant le projet, disposant de peu de temps et attendant une recommandation claire et étayée.',
  deliveryContext: 'présentation en réunion professionnelle en présentiel',
  sourceMaterials: 'Une synthèse anonymisée, trois indicateurs validés, une chronologie vérifiée et une charte graphique fictive.',
  role: 'un concepteur de présentations professionnelles, pédagogue, synthétique et attentif à la narration comme à la lisibilité visuelle',
  presentationGoal: 'obtenir une décision ou un arbitrage',
  keyMessage: 'Les résultats validés montrent que la simplification proposée réduit les étapes inutiles sans supprimer les contrôles essentiels.',
  desiredOutcome: 'Valider les deux prochaines étapes et désigner les personnes responsables de leur suivi avant la prochaine réunion.',
  productionMode: 'préparer le contenu complet à intégrer manuellement dans une application',
  targetTool: 'Microsoft PowerPoint',
  targetToolDetails: 'PowerPoint Microsoft 365 au format horizontal 16:9',
  slideCount: '8 à 10 diapositives, hors annexes',
  speakingDuration: '10 minutes de présentation puis questions',
  narrativeStructure: 'problème, causes vérifiées, options, recommandation et décision attendue',
  visualStyle: 'professionnel, sobre, lisible et peu chargé',
  speakerNotes: 'notes courtes avec messages clés et transitions',
  contentRequirements: 'Présenter le contexte, trois résultats validés, les limites, deux options, la recommandation et la décision attendue.',
  sourceBoundaries: 'Utiliser seulement les indicateurs fournis, citer leur origine et placer « information à compléter » pour toute donnée absente.',
  accessibilityRules: 'Contraste renforcé, texte court, taille lisible et aucune information portée uniquement par la couleur ou un graphique non décrit.',
  constraints: 'Conserver la charte fictive, éviter les animations décoratives et expliquer chaque sigle lors de sa première utilisation.',
  verificationMethod: 'Contrôler chaque chiffre et chaque source, tester la projection et effectuer une répétition chronométrée de neuf minutes.',
};

describe('catégorie Présentation', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(presentationCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(presentationCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque la présentation est mieux cadrée', () => {
    const weakValues: PresentationValues = {
      ...completeValues,
      presentationContext: 'Présenter un projet fictif à une équipe.',
      audience: 'Une équipe interne.',
      sourceMaterials: '',
      role: 'un rédacteur',
      keyMessage: 'Présenter le projet.',
      desiredOutcome: '',
      contentRequirements: '',
      sourceBoundaries: '',
      accessibilityRules: '',
      constraints: '',
      verificationMethod: '',
    };

    const weakDiagnostic = calculateCategoryScore(presentationCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(presentationCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et interdit d’inventer des faits ou des sources', () => {
    const firstPrompt = presentationCategory.buildPrompt(completeValues);
    const secondPrompt = presentationCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('diapositive par diapositive');
    expect(firstPrompt).toContain('N’invente aucun chiffre');
    expect(firstPrompt).toContain('accessibilité');
    expect(firstPrompt).toContain('Adapte le résultat à PowerPoint');
    expect(firstPrompt).toContain('sans prétendre avoir créé un fichier');
  });

  it('adapte les consignes au mode de production et à l’outil sélectionnés', () => {
    const gammaPrompt = presentationCategory.buildPrompt({
      ...completeValues,
      productionMode: 'rédiger une consigne optimisée à transmettre à une application de présentation',
      targetTool: 'Gamma',
      targetToolDetails: '',
    });
    const preziPrompt = presentationCategory.buildPrompt({
      ...completeValues,
      productionMode: 'créer directement une présentation ou un fichier éditable si cette capacité est disponible',
      targetTool: 'Prezi',
      targetToolDetails: '',
    });

    expect(gammaPrompt).toContain('consigne finale autonome');
    expect(gammaPrompt).toContain('cartes ou sections courtes');
    expect(preziPrompt).toContain('zones du canevas');
    expect(preziPrompt).toContain('Sinon, indique clairement cette limite');

    const targetToolField = presentationCategory.fields.find((field) => field.name === 'targetTool');
    expect(targetToolField?.options?.map((option) => option.value)).toEqual(expect.arrayContaining([
      'Microsoft PowerPoint',
      'Google Slides',
      'Gamma',
      'Prezi',
      'Canva Présentations',
      'Apple Keynote',
      'LibreOffice Impress',
      'autre outil à préciser',
    ]));
  });
});
