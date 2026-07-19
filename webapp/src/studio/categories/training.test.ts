import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { trainingCategory, type TrainingValues } from './training';

const completeValues: TrainingValues = {
  trainingContext: 'Concevoir une séquence permettant à une équipe administrative de structurer et de fiabiliser un tableau de suivi partagé utilisé chaque semaine.',
  audience: 'adultes débutants travaillant dans des services administratifs',
  learnerLevel: 'débutant ou hétérogène',
  priorKnowledge: 'Les participants savent saisir des données mais utilisent peu les formules et les contrôles.',
  role: 'un ingénieur pédagogique spécialisé dans la formation des adultes et les usages professionnels du tableur',
  learningObjective: 'À l’issue de la séquence, les participants seront capables de structurer un tableau de suivi, d’utiliser une formule simple et de vérifier la cohérence du résultat.',
  successCriteria: 'Le tableau respecte le modèle, les calculs sont exacts et chaque participant explique les contrôles réalisés.',
  deliverableType: 'séquence pédagogique structurée avec activités et évaluation',
  duration: '90 minutes en trois étapes de 30 minutes',
  modality: 'formation en présentiel',
  requiredElements: 'Objectif, démonstration, exercice guidé, activité autonome, correction et synthèse.',
  constraints: 'Consignes courtes, documents accessibles au clavier, données fictives et aucun outil payant.',
};

describe('catégorie Formation', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(trainingCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(trainingCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les informations manquantes et améliore le score après enrichissement', () => {
    const weakValues: TrainingValues = {
      ...completeValues,
      trainingContext: 'Préparer une courte formation sur un tableur.',
      audience: 'adultes',
      priorKnowledge: '',
      role: 'un formateur',
      learningObjective: 'Apprendre à utiliser un tableau.',
      successCriteria: '',
      duration: '1 heure',
      requiredElements: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(trainingCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(trainingCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt CROP sans appel externe', () => {
    const firstPrompt = trainingCategory.buildPrompt(completeValues);
    const secondPrompt = trainingCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif pédagogique');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente aucune donnée absente');
  });
});
