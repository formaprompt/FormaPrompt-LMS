import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { researchCategory, type ResearchValues } from './research';

const completeValues: ResearchValues = {
  researchContext: 'Actualiser un support pédagogique fictif consacré à une pratique professionnelle afin d’identifier les évolutions publiques récentes et les points nécessitant une vérification spécialisée.',
  researchType: 'recherche documentaire générale',
  audience: 'Formateurs généralistes connaissant le sujet mais pas ses évolutions récentes.',
  knownInformation: 'Une recommandation générale est connue, mais sa date d’application, son périmètre et ses exceptions doivent être confirmés.',
  role: 'un documentaliste professionnel rigoureux, spécialisé dans l’évaluation des sources, le recoupement et la traçabilité des informations',
  researchQuestion: 'Quelles évolutions vérifiées depuis 2024 modifient cette pratique, quels acteurs sont concernés et quelles limites restent incertaines ?',
  intendedUse: 'Décider quels passages du support fictif doivent être actualisés et quels points doivent être orientés vers une personne compétente.',
  geographicScope: 'France et Union européenne, avec comparaison internationale si elle éclaire le contexte.',
  timeScope: 'Publications de janvier 2024 à aujourd’hui, avec date de consultation indiquée.',
  sourcePriority: 'privilégier les sources primaires, officielles et récentes',
  sourceRequirements: 'Auteur et date identifiables, document primaire recherché, contenu sponsorisé signalé et aucune source anonyme utilisée seule.',
  searchStrategy: 'Rechercher la définition officielle, la chronologie, les acteurs concernés, les exceptions et les évaluations indépendantes.',
  outputFormat: 'note de recherche structurée avec réponse courte, constats détaillés et sources',
  detailLevel: 'niveau intermédiaire avec explications courtes',
  citationMethod: 'placer un lien ou une référence après chaque affirmation importante',
  contradictions: 'Comparer les dates et périmètres des sources divergentes, puis isoler les points impossibles à trancher.',
  constraints: 'Moins de 1 200 mots, français clair, aucune recommandation juridique et aucune affirmation sans référence vérifiable.',
};

describe('catégorie Recherche', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(researchCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(researchCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque la recherche est mieux cadrée', () => {
    const weakValues: ResearchValues = {
      ...completeValues,
      researchContext: 'Chercher des informations récentes sur ce sujet.',
      audience: 'équipe',
      knownInformation: '',
      role: 'un chercheur',
      researchQuestion: 'Quelles sont les nouveautés ?',
      intendedUse: '',
      geographicScope: '',
      timeScope: '',
      sourceRequirements: '',
      searchStrategy: '',
      contradictions: '',
      constraints: '',
    };

    const weakDiagnostic = calculateCategoryScore(researchCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(researchCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et interdit les références inventées', () => {
    const firstPrompt = researchCategory.buildPrompt(completeValues);
    const secondPrompt = researchCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif de recherche');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('limite d’accès ou d’actualité');
    expect(firstPrompt).toContain('N’invente aucune source, URL, date, citation, statistique ou conclusion');
  });
});
