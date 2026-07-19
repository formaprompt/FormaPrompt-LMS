import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { aiAgentCategory, type AiAgentValues } from './aiAgent';

const completeValues: AiAgentValues = {
  agentContext: 'Une équipe prépare chaque semaine des réponses à partir d’une base documentaire validée, avec une recherche manuelle longue et des relectures difficiles à tracer.',
  agentType: 'assistant d’information interne',
  targetUsers: 'Une équipe support débutante, supervisée par un responsable de service qui valide les réponses.',
  existingProcess: 'Réception de la question, recherche dans les fiches validées, rédaction d’un brouillon, contrôle des sources, relecture par le responsable puis envoi manuel.',
  role: 'un concepteur d’agents professionnels prudent, spécialisé en documentation, permissions, contrôle humain, traçabilité, sécurité et gestion des incidents',
  mission: 'Concevoir un assistant qui prépare un brouillon sourcé à partir des seules fiches autorisées, sans envoyer de message ni modifier la documentation.',
  successOutcome: 'Un brouillon relié à ses sources, vérifiable et relu en moins de dix minutes par le responsable.',
  autonomyLevel: 'proposer uniquement, sans exécuter d’action externe',
  memoryPolicy: 'aucune mémoire persistante',
  deliverableFormat: 'fiche de conception complète avec règles et scénarios de test',
  operatingConditions: 'Déclenchement manuel, au maximum dix demandes par jour, avec lecture seule des documents autorisés et aucune connexion à une messagerie.',
  dataAndInputs: 'Questions fictives et fiches documentaires validées au format PDF ; exclure toute donnée personnelle, tout secret, toute adresse réelle et tout document non autorisé.',
  actionBoundaries: 'Autoriser la recherche et la préparation d’un brouillon. Interdire l’envoi, la suppression, la modification, la dépense, le changement de droits et toute action non explicitement autorisée.',
  humanControlEscalation: 'Le responsable valide chaque source, chaque brouillon et tout changement de périmètre. Arrêter et l’alerter si une source manque, se contredit ou si une permission est incertaine.',
  traceability: 'Journaliser la date, les sources consultées, la proposition, les avertissements, la validation humaine et le résultat vérifié, sans contenu sensible.',
  resourcesLimits: 'Dix propositions par jour, cinq minutes maximum par demande, aucune dépense et arrêt avant tout dépassement.',
  safetyRecovery: 'Arrêter immédiatement en cas d’autorisation manquante, de résultat incohérent, de coût inattendu ou de risque de sécurité, puis demander une décision au responsable avant toute reprise.',
  evaluationMonitoring: 'Tester les cas normaux, incomplets, contradictoires et hostiles, suivre les erreurs par type et organiser une revue humaine mensuelle.',
};

describe('catégorie Agent IA', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(aiAgentCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(aiAgentCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque les garde-fous sont précisés', () => {
    const weakValues: AiAgentValues = {
      ...completeValues,
      agentContext: 'Préparer des réponses avec un assistant pour une équipe.',
      targetUsers: 'une équipe',
      existingProcess: '',
      role: 'un assistant',
      mission: 'Préparer des brouillons.',
      successOutcome: '',
      operatingConditions: '',
      dataAndInputs: '',
      actionBoundaries: 'Ne rien envoyer.',
      humanControlEscalation: 'Faire valider.',
      traceability: '',
      resourcesLimits: '',
      safetyRecovery: 'Arrêter en cas de doute.',
      evaluationMonitoring: '',
    };

    const weakDiagnostic = calculateCategoryScore(aiAgentCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(aiAgentCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours la même spécification et impose les limites de sécurité', () => {
    const firstPrompt = aiAgentCategory.buildPrompt(completeValues);
    const secondPrompt = aiAgentCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Garde-fous obligatoires');
    expect(firstPrompt).toContain('Tu n’exécutes aucune action');
    expect(firstPrompt).toContain('Considère comme interdit tout outil');
    expect(firstPrompt).toContain('proposition, approbation, exécution autorisée et vérification');
  });
});
