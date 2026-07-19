import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { socialMediaCategory, type SocialMediaValues } from './socialMedia';

const completeValues: SocialMediaValues = {
  contentContext: 'Présenter une nouvelle ressource gratuite consacrée à la rédaction de consignes professionnelles claires avec la méthode CROP.',
  audience: 'responsables pédagogiques et formateurs indépendants débutant avec les outils numériques',
  platform: 'LinkedIn',
  role: 'un rédacteur spécialisé en communication pédagogique professionnelle, claire, crédible et accessible',
  communicationObjective: 'Expliquer l’utilité concrète de la méthode puis inviter les lecteurs à consulter la ressource pour préparer leur prochaine activité.',
  successCriteria: 'Le sujet est compris dès les premières phrases, le bénéfice est concret et l’action finale est explicite.',
  tone: 'professionnel et accessible',
  contentFormat: 'publication structurée avec une accroche et des paragraphes courts',
  keyMessage: 'Une consigne structurée réduit les ambiguïtés et facilite la vérification du résultat obtenu.',
  callToAction: 'Consulter le guide puis tester la méthode sur une demande professionnelle.',
  requiredElements: 'Nom de la ressource, gratuité, méthode CROP et emplacement du lien.',
  constraints: 'Moins de 1 200 caractères, deux émojis maximum, aucun chiffre inventé et trois mots-dièse maximum.',
};

describe('catégorie Réseaux sociaux', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(socialMediaCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(socialMediaCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le cadrage est enrichi', () => {
    const weakValues: SocialMediaValues = {
      ...completeValues,
      contentContext: 'Présenter une ressource sur les prompts.',
      audience: 'formateurs',
      role: 'un rédacteur',
      communicationObjective: 'Faire connaître la ressource.',
      successCriteria: '',
      keyMessage: 'Une méthode peut aider.',
      callToAction: '',
      requiredElements: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(socialMediaCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(socialMediaCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et rappelle la vérification des faits', () => {
    const firstPrompt = socialMediaCategory.buildPrompt(completeValues);
    const secondPrompt = socialMediaCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente aucun chiffre');
  });
});
