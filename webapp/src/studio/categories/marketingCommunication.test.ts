import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { marketingCommunicationCategory, type MarketingCommunicationValues } from './marketingCommunication';

const completeValues: MarketingCommunicationValues = {
  campaignContext: 'Présenter une nouvelle ressource professionnelle fictive sur le site et dans une newsletter mensuelle afin d’expliquer son usage et de préparer une consultation volontaire.',
  offerDescription: 'Un guide pratique gratuit proposant une méthode en quatre étapes, une grille de vérification et des exemples professionnels entièrement fictifs.',
  targetAudience: 'Responsables pédagogiques connaissant leur besoin, mais disposant de peu de temps et recherchant une méthode claire et directement réutilisable.',
  audienceAwareness: 'public connaissant le besoin mais pas encore la solution proposée',
  role: 'un responsable marketing et communication, clair, responsable, attentif au public et à la vérification de chaque affirmation',
  communicationGoal: 'faire connaître une offre, une ressource ou une initiative',
  keyMessage: 'Cette ressource fournit une méthode structurée pour préciser une demande professionnelle et vérifier les informations manquantes avant utilisation.',
  desiredAction: 'Consulter la page détaillée, télécharger librement le guide puis décider s’il répond au besoin professionnel.',
  contentType: 'page de présentation d’une offre ou d’un service',
  primaryChannel: 'site internet ou page de destination',
  tone: 'professionnel, clair et accessible',
  outputFormat: 'contenu final structuré avec titres, paragraphes courts et appel à l’action',
  valueProposition: 'Une méthode courte, documentée et réutilisable qui aide à repérer les imprécisions avant de transmettre une consigne.',
  proofPoints: 'Contenu du guide validé, accès gratuit confirmé, grille en quatre étapes et exemples fictifs relus ; aucun témoignage disponible.',
  brandGuidelines: 'Ton pédagogique, vouvoiement, phrases courtes, vocabulaire concret et aucune promesse excessive ou formulation trop commerciale.',
  legalEthicalConstraints: 'Aucune fausse urgence, aucun ciblage individuel, consentement requis pour les courriels et mentions à vérifier avant diffusion.',
  successIndicators: 'Compréhension du message lors d’une relecture test et nombre de consultations qualifiées de la page.',
  constraints: 'Six cents mots maximum, aucune comparaison non sourcée, aucun superlatif et liens à ajouter manuellement.',
};

describe('catégorie Marketing et communication', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(marketingCommunicationCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(marketingCommunicationCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque la communication est mieux cadrée', () => {
    const weakValues: MarketingCommunicationValues = {
      ...completeValues,
      campaignContext: 'Présenter une nouvelle ressource fictive.',
      offerDescription: 'Un guide professionnel gratuit.',
      targetAudience: 'Des professionnels.',
      role: 'un rédacteur',
      keyMessage: 'Découvrir le guide.',
      desiredAction: '',
      valueProposition: '',
      proofPoints: '',
      brandGuidelines: '',
      legalEthicalConstraints: '',
      successIndicators: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(marketingCommunicationCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(marketingCommunicationCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et interdit les arguments inventés ou manipulateurs', () => {
    const firstPrompt = marketingCommunicationCategory.buildPrompt(completeValues);
    const secondPrompt = marketingCommunicationCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente aucun chiffre');
    expect(firstPrompt).toContain('pression artificielle');
    expect(firstPrompt).toContain('vérifications humaines');
  });
});
