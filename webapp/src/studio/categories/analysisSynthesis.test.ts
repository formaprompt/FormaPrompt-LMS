import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { analysisSynthesisCategory, type AnalysisSynthesisValues } from './analysisSynthesis';

const completeValues: AnalysisSynthesisValues = {
  analysisContext: 'Comparer plusieurs retours anonymisés concernant l’utilisation d’une procédure fictive afin d’identifier les difficultés récurrentes et les étapes à clarifier.',
  sourceType: 'plusieurs documents ou notes textuelles',
  sourceScope: 'Cinq retours anonymisés recueillis sur un mois, limités à la phase de validation et sans données individuelles.',
  audience: 'responsables pédagogiques connaissant le processus mais pas les retours détaillés',
  role: 'un analyste professionnel rigoureux, neutre et attentif à la traçabilité des constats et aux limites des sources',
  mainQuestion: 'Quelles difficultés reviennent le plus souvent, à quelles étapes apparaissent-elles et quels points nécessitent une clarification prioritaire ?',
  decisionUse: 'Prioriser les explications à revoir avant la prochaine diffusion de la procédure fictive.',
  analysisMode: 'analyse thématique structurée',
  analysisCriteria: 'Fréquence, étape concernée, impact sur le délai, clarté de la consigne et solution déjà proposée.',
  outputFormat: 'synthèse structurée avec constats, points de vigilance et conclusion',
  detailLevel: 'niveau intermédiaire avec explications courtes',
  traceability: 'rattacher chaque constat important à la source ou à la section correspondante',
  uncertainties: 'Signaler les thèmes présents dans une seule source, les périodes non comparables et les causes non démontrées.',
  constraints: 'Moins de 800 mots, aucun jargon, aucune cause supposée et aucune recommandation sans appui dans les sources.',
};

describe('catégorie Analyse et synthèse', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(analysisSynthesisCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(analysisSynthesisCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque l’analyse est mieux cadrée', () => {
    const weakValues: AnalysisSynthesisValues = {
      ...completeValues,
      analysisContext: 'Analyser des retours sur une procédure.',
      sourceScope: '',
      audience: 'équipe',
      role: 'un analyste',
      mainQuestion: 'Quels sont les problèmes ?',
      decisionUse: '',
      analysisCriteria: '',
      uncertainties: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(analysisSynthesisCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(analysisSynthesisCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et impose la séparation des faits et interprétations', () => {
    const firstPrompt = analysisSynthesisCategory.buildPrompt(completeValues);
    const secondPrompt = analysisSynthesisCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif d’analyse');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('Distingue explicitement les faits');
    expect(firstPrompt).toContain('sans inventer de chiffre');
  });
});
