import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { editorialContentCategory, type EditorialContentValues } from './editorialContent';

const completeValues: EditorialContentValues = {
  editorialContext: 'Article destiné à expliquer aux petites structures comment reconnaître une information technique devenue obsolète avant de la reprendre sur leur site web.',
  articleType: 'article technique ou documentation spécialisée',
  audience: 'Responsables de petites structures, non spécialistes, recherchant une méthode rapide et fiable.',
  publicationDestination: 'site web ou blog de l’organisation',
  publicationDetails: 'Rubrique Conseils pratiques, ton pédagogique et lecture majoritairement réalisée sur téléphone.',
  role: 'un rédacteur web spécialisé dans le sujet, pédagogue, attentif aux sources, aux dates, à la clarté, à l’accessibilité et à la ligne éditoriale',
  editorialGoal: 'Permettre au lecteur de contrôler la date, la version et la source d’une information avant de la publier dans un article professionnel.',
  editorialAngle: 'Une méthode en quatre vérifications réalisables sans expertise technique, illustrée par un cas fictif.',
  articleLength: 'article moyen de 800 à 1 500 mots',
  technicalLevel: 'niveau intermédiaire avec les termes spécialisés expliqués',
  editorialTone: 'professionnel, clair et pédagogique',
  outputFormat: 'article complet avec métadonnées SEO et suggestions de liens',
  articleStructure: 'Introduction par un problème concret, quatre vérifications, exemple fictif, erreurs fréquentes puis liste de contrôle finale.',
  sourceMaterials: 'Documentation officielle datée, note interne anonymisée et deux statistiques dont la source reste à vérifier.',
  sourceRules: 'Utiliser les sources officielles fournies, citer le titre, l’auteur, la date et le lien, et signaler toute information incertaine.',
  temporalScope: 'Situation vérifiée au 20 juillet 2026 ; dater chaque annonce et signaler les éléments susceptibles d’évoluer.',
  seoRequirements: 'Répondre à l’intention « comment vérifier une source », avec un titre et une description naturels sans répétition artificielle.',
  linkRequirements: 'Lien interne vers la formation concernée et liens externes uniquement vers les sources primaires citées.',
  mediaRequirements: 'Une capture fictive annotée et une illustration originale avec légende et texte alternatif descriptif.',
  callToAction: 'Proposer de télécharger une liste de contrôle ou de consulter une ressource complémentaire.',
  editorialRules: 'Aucun titre trompeur, témoignage inventé, promesse de résultat, jargon non expliqué ou classement sans méthode.',
  verificationMethod: 'Validation technique par le référent, contrôle des sources et dates, puis relecture éditoriale sur téléphone.',
};

describe('catégorie Articles et contenus éditoriaux', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(editorialContentCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(editorialContentCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque l’article est mieux cadré', () => {
    const weakValues: EditorialContentValues = {
      ...completeValues,
      editorialContext: 'Écrire un article sur les nouveautés techniques.',
      audience: 'des lecteurs',
      publicationDetails: '',
      role: 'un rédacteur',
      editorialGoal: 'Informer les lecteurs.',
      editorialAngle: 'Présenter les nouveautés.',
      articleStructure: 'Introduction puis conclusion.',
      sourceMaterials: '',
      sourceRules: '',
      temporalScope: '',
      seoRequirements: '',
      linkRequirements: '',
      mediaRequirements: '',
      callToAction: '',
      editorialRules: '',
      verificationMethod: '',
    };

    const weakDiagnostic = calculateCategoryScore(editorialContentCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(editorialContentCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit un prompt déterministe qui distingue les dates et interdit les sources inventées', () => {
    const newsValues: EditorialContentValues = {
      ...completeValues,
      articleType: 'article d’actualité ou de veille',
    };
    const firstPrompt = editorialContentCategory.buildPrompt(newsValues);
    const secondPrompt = editorialContentCategory.buildPrompt({ ...newsValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('Distingue la date de publication de la date réelle des événements');
    expect(firstPrompt).toContain('N’invente aucun fait, chiffre, date, citation, source');
    expect(firstPrompt).toContain('N’affirme jamais avoir recherché, vérifié, publié');
  });
});
