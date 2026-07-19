import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { videoCategory, type VideoValues } from './video';

const completeValues: VideoValues = {
  videoContext: 'Courte vidéo intégrée à une formation en ligne pour expliquer comment vérifier une source avant de la citer dans un document professionnel.',
  videoType: 'vidéo pédagogique ou explicative',
  audience: 'Adultes débutants regardant la vidéo sur téléphone depuis leur espace apprenant.',
  sourceMaterials: 'Procédure validée, trois captures fictives, charte graphique autorisée et liste des sources officielles à citer.',
  role: 'un concepteur-réalisateur pédagogique, attentif à la narration, au rythme, à l’accessibilité, aux droits et à la vérification des informations',
  communicationGoal: 'Permettre au public d’appliquer une vérification simple en trois étapes avant de partager ou de citer une information.',
  keyMessage: 'Une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.',
  productionMode: 'préparer un scénario et un storyboard à réaliser ensuite',
  targetTool: 'application de montage vidéo',
  targetToolDetails: 'Montage dans une application disponible dans l’organisme, avec export MP4.',
  duration: 'entre 1 et 3 minutes',
  formatRatio: 'horizontal 16:9 pour écran et plateforme vidéo',
  narrativeStructure: 'Question concrète, erreur fréquente, méthode en trois étapes, démonstration brève puis rappel final.',
  scenesAndShots: 'Plan d’ensemble du bureau, gros plan sur trois indices fictifs, retour au formateur puis écran final récapitulatif.',
  narrationDialogue: 'Voix chaleureuse et posée, phrases courtes, trois mots-clés affichés successivement et aucun jargon.',
  visualDirection: 'Style pédagogique sobre, lumière naturelle, plans stables, charte verte et bleue, aucun effet décoratif rapide.',
  soundMusic: 'Voix claire au premier plan, musique discrète autorisée et silences entre les étapes.',
  captionsAccessibility: 'Sous-titres relus, contraste élevé, texte lisible sur téléphone et aucune information portée uniquement par le son.',
  rightsAndConsent: 'Utiliser uniquement des personnes, voix, musiques, images, marques et ressources disposant des droits et autorisations nécessaires.',
  verificationMethod: 'Validation du script par le formateur, test sans le son sur téléphone et contrôle des faits et des droits avant publication.',
};

describe('catégorie Vidéo', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(videoCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(videoCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le projet est mieux cadré', () => {
    const weakValues: VideoValues = {
      ...completeValues,
      videoContext: 'Faire une courte vidéo pour expliquer une méthode.',
      audience: 'des adultes',
      sourceMaterials: '',
      role: 'un vidéaste',
      communicationGoal: 'Expliquer la méthode.',
      keyMessage: 'Vérifier les sources.',
      narrativeStructure: 'Une introduction simple.',
      scenesAndShots: '',
      narrationDialogue: '',
      visualDirection: '',
      soundMusic: '',
      captionsAccessibility: '',
      rightsAndConsent: '',
      verificationMethod: '',
    };

    const weakDiagnostic = calculateCategoryScore(videoCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(videoCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et rappelle les limites de production', () => {
    const firstPrompt = videoCategory.buildPrompt(completeValues);
    const secondPrompt = videoCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('N’invente aucun fait');
    expect(firstPrompt).toContain('N’affirme jamais avoir tourné, monté, créé, exporté, publié ou testé une vidéo');
  });
});
