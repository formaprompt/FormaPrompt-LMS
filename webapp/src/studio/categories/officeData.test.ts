import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { officeDataCategory, type OfficeDataValues } from './officeData';

const completeValues: OfficeDataValues = {
  officeContext: 'Fiabiliser un tableau de suivi fictif utilisé chaque mois afin de réduire les erreurs de saisie, repérer les doublons et contrôler les montants avant une synthèse interne.',
  tool: 'Microsoft Excel pour Microsoft 365',
  sourceDescription: 'Une feuille Suivi avec les colonnes Date, Catégorie, Statut et Montant fictif, une ligne par opération et une feuille Listes pour les valeurs autorisées.',
  userLevel: 'débutant ou occasionnel',
  role: 'un formateur expert en bureautique, pédagogue, rigoureux et attentif à la fiabilité des données et des résultats',
  taskObjective: 'Créer une liste contrôlée pour le statut, signaler les doublons et produire un total mensuel qui puisse être vérifié facilement.',
  successCriteria: 'Aucune valeur hors liste, doublons clairement signalés et total identique à un calcul manuel sur un échantillon fictif.',
  taskType: 'nettoyage et préparation de données',
  outputFormat: 'procédure pas à pas avec exemples fictifs',
  guidanceLevel: 'explications détaillées pour une personne débutante',
  structureRules: 'Conserver les colonnes existantes, ajouter les contrôles à droite et ne jamais fusionner les cellules contenant les données.',
  localeSettings: 'paramètres français avec dates jour/mois/année et séparateur de fonctions point-virgule',
  constraints: 'Aucune macro, conserver le fichier source intact, utiliser uniquement des fonctions compatibles avec Excel 365.',
  verificationMethod: 'Tester une ligne valide, un doublon, une valeur vide et comparer le total à un calcul manuel sur cinq lignes fictives.',
};

describe('catégorie Bureautique et données', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(officeDataCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(officeDataCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque la tâche est mieux cadrée', () => {
    const weakValues: OfficeDataValues = {
      ...completeValues,
      officeContext: 'Corriger un tableau de suivi fictif.',
      sourceDescription: 'Un tableau avec plusieurs colonnes.',
      role: 'un formateur',
      taskObjective: 'Nettoyer le tableau.',
      successCriteria: '',
      structureRules: '',
      constraints: '',
      verificationMethod: '',
    };

    const weakDiagnostic = calculateCategoryScore(officeDataCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(officeDataCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et impose une copie et des contrôles', () => {
    const firstPrompt = officeDataCategory.buildPrompt(completeValues);
    const secondPrompt = officeDataCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('Travaille sur une copie');
    expect(firstPrompt).toContain('N’invente aucun nom de colonne');
  });
});
