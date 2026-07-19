import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import {
  professionalDocumentsCategory,
  type ProfessionalDocumentsValues,
} from './professionalDocuments';

const completeValues: ProfessionalDocumentsValues = {
  documentType: 'procédure opérationnelle',
  documentContext: 'Formaliser un processus fictif de validation interne utilisé par plusieurs services afin de rendre les responsabilités, les délais et les contrôles plus faciles à comprendre.',
  audience: 'responsables de service découvrant le nouveau processus interne',
  sourceInformation: 'Le processus comprend trois validations successives, une réponse sous deux jours ouvrés et un suivi dans un tableau partagé fictif.',
  role: 'un rédacteur professionnel rigoureux, spécialiste des procédures internes claires, accessibles et vérifiables',
  documentObjective: 'Expliquer chaque étape du processus afin que les responsables puissent l’appliquer de manière homogène et contrôler son avancement sans ambiguïté.',
  expectedAction: 'Chaque responsable identifie son intervention, le délai à respecter et le contrôle à réaliser avant transmission.',
  tone: 'professionnel, clair et factuel',
  structure: 'document organisé en étapes numérotées avec points de contrôle',
  length: 'longueur intermédiaire, adaptée au sujet',
  requiredElements: 'Objectif, périmètre, responsabilités, étapes numérotées, délais, points de contrôle et date de révision fictive.',
  constraints: 'Phrases courtes, aucun jargon non expliqué, aucune donnée personnelle, aucun engagement juridique et aucune information inventée.',
  verificationCriteria: 'Toutes les étapes sont présentes, les responsabilités sont explicites et chaque délai correspond aux informations sources fournies.',
};

describe('catégorie Documents professionnels', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(professionalDocumentsCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(professionalDocumentsCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le document est mieux cadré', () => {
    const weakValues: ProfessionalDocumentsValues = {
      ...completeValues,
      documentContext: 'Présenter un nouveau processus interne.',
      audience: 'équipe',
      sourceInformation: '',
      role: 'un rédacteur',
      documentObjective: 'Expliquer le processus.',
      expectedAction: '',
      requiredElements: '',
      constraints: '',
      verificationCriteria: '',
    };

    const weakDiagnostic = calculateCategoryScore(professionalDocumentsCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(professionalDocumentsCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et interdit les informations inventées', () => {
    const firstPrompt = professionalDocumentsCategory.buildPrompt(completeValues);
    const secondPrompt = professionalDocumentsCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente aucun chiffre');
  });
});
