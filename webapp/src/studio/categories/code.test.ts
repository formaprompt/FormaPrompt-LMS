import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { codeCategory, type CodeValues } from './code';

const completeValues: CodeValues = {
  developmentContext: 'Dans une application fictive, un formulaire perd les modifications lorsque la validation échoue et aucun message accessible n’explique le problème.',
  taskType: 'diagnostic et correction d’un défaut',
  targetUsers: 'Adultes débutants utilisant le formulaire sur téléphone et ordinateur.',
  existingSystem: 'Application React et Vite existante, formulaire React Hook Form, validations Zod et styles partagés à réutiliser sans modifier le service de données.',
  role: 'un développeur senior pragmatique, attentif au code lisible, au typage, aux tests, à la sécurité et à la préservation de l’existant',
  technicalGoal: 'Conserver les valeurs saisies, afficher l’erreur sous le champ concerné et placer le focus sur la première erreur sans déclencher d’envoi.',
  successOutcome: 'Après une validation invalide, les valeurs restent visibles, le message est annoncé et aucun envoi n’est déclenché.',
  technologyStack: 'TypeScript strict, React 19, Vite 5, React Hook Form et Zod.',
  runtimeEnvironment: 'Navigateurs récents sur téléphone et ordinateur Windows, construction sous PowerShell.',
  inputsOutputs: 'Objet fictif avec sujet et destinataire ; sortie contenant statut, messages d’erreur et valeurs normalisées.',
  functionalRequirements: 'Conserver les champs valides, refuser une chaîne vide, gérer les espaces et ne jamais envoyer si une erreur subsiste.',
  qualityRequirements: 'TypeScript strict, navigation clavier, messages annoncés, fonctions courtes et aucun rechargement inutile.',
  constraintsDependencies: 'Réutiliser Zod et React Hook Form, aucune nouvelle dépendance et aucune modification du service de données.',
  changeScope: 'proposer une modification minimale et ciblée dans le projet existant',
  expectedDeliverable: 'code prêt à intégrer avec les fichiers concernés et les commandes de validation',
  codingStandards: 'respecter les conventions du projet, le typage disponible et éviter les dépendances inutiles',
  testRequirements: 'Test unitaire de la validation, test du focus sur erreur et parcours clavier sur téléphone et ordinateur.',
  securityPrivacy: 'Aucune clé dans le navigateur, données fictives dans les tests, validation côté serveur et droits minimaux.',
  errorHandling: 'Message sous le champ invalide, conservation de la saisie, journal sans donnée personnelle et possibilité de réessayer.',
};

describe('catégorie Code', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(codeCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(codeCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le besoin est mieux cadré', () => {
    const weakValues: CodeValues = {
      ...completeValues,
      developmentContext: 'Corriger un formulaire qui ne fonctionne pas bien.',
      targetUsers: 'équipe',
      existingSystem: '',
      role: 'un développeur',
      technicalGoal: 'Corriger le formulaire.',
      successOutcome: '',
      technologyStack: 'React',
      runtimeEnvironment: '',
      inputsOutputs: '',
      functionalRequirements: '',
      qualityRequirements: '',
      constraintsDependencies: '',
      testRequirements: '',
      securityPrivacy: '',
      errorHandling: '',
    };

    const weakDiagnostic = calculateCategoryScore(codeCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(codeCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et interdit les affirmations d’exécution', () => {
    const firstPrompt = codeCategory.buildPrompt(completeValues);
    const secondPrompt = codeCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif technique');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente pas d’API, de fichier, de dépendance');
    expect(firstPrompt).toContain('N’affirme jamais avoir modifié un fichier');
  });
});
