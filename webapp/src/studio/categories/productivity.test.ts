import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { productivityCategory, type ProductivityValues } from './productivity';

const completeValues: ProductivityValues = {
  workContext: 'Une petite équipe fictive prépare chaque semaine plusieurs livrables, mais les priorités changent et les validations arrivent trop tard pour organiser la charge sereinement.',
  taskType: 'organisation et priorisation d’une charge de travail',
  peopleAffected: 'Trois personnes polyvalentes, dont une valide les priorités et deux réalisent les tâches.',
  currentMethod: 'Les demandes arrivent par plusieurs canaux, une liste est tenue manuellement et les priorités sont confirmées tardivement sans revue intermédiaire.',
  role: 'un conseiller en organisation professionnelle, pragmatique, attentif à la simplicité, à la charge réelle et aux validations humaines',
  mainGoal: 'Construire une méthode hebdomadaire simple qui clarifie les priorités avant le début du travail et rend les blocages visibles.',
  successOutcome: 'Chaque personne connaît ses trois priorités, leur échéance et le point de validation prévu.',
  frequencyVolume: 'Revue chaque lundi, environ quinze tâches actives et deux urgences imprévues par semaine.',
  inputsResources: 'Liste des demandes, échéances confirmées, charge disponible, critères d’urgence et modèle de suivi.',
  toolsEnvironment: 'Agenda partagé, tableau de tâches existant et messagerie ; aucun nouvel outil payant.',
  deadlinePriority: 'Sécurité et engagements datés avant les améliorations internes ; arbitrage par le responsable.',
  workflowRequirements: 'Vérifier les informations, prioriser, affecter un responsable, réaliser, relire puis valider avant diffusion.',
  automationLevel: 'proposer une méthode principalement manuelle avec assistance ponctuelle',
  outputFormat: 'plan d’action priorisé avec étapes, responsables, délais et points de contrôle',
  successCriteria: 'Priorités validées avant mardi, aucune tâche sans responsable et blocages signalés sous vingt-quatre heures.',
  humanChecks: 'Le responsable valide les priorités et toute communication externe est relue avant envoi.',
  risksConstraints: 'Aucune suppression, dépense, affectation définitive ou communication externe sans confirmation humaine.',
};

describe('catégorie Productivité', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(productivityCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(productivityCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le processus est mieux cadré', () => {
    const weakValues: ProductivityValues = {
      ...completeValues,
      workContext: 'Mieux organiser les tâches de la semaine.',
      peopleAffected: 'équipe',
      currentMethod: '',
      role: 'un assistant',
      mainGoal: 'Gagner du temps chaque semaine.',
      successOutcome: '',
      frequencyVolume: '',
      inputsResources: '',
      toolsEnvironment: '',
      deadlinePriority: '',
      workflowRequirements: '',
      successCriteria: '',
      humanChecks: '',
      risksConstraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(productivityCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(productivityCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et conserve les validations humaines', () => {
    const firstPrompt = productivityCategory.buildPrompt(completeValues);
    const secondPrompt = productivityCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('validations humaines');
    expect(firstPrompt).toContain('N’affirme jamais avoir exécuté une action');
  });
});
