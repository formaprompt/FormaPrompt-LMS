import { describe, expect, it } from 'vitest';
import { calculateCategoryScore } from '../engine/scoreCategory';
import { audioCategory, type AudioValues } from './audio';

const completeValues: AudioValues = {
  audioContext: 'Capsule sonore intégrée à une formation en ligne pour expliquer comment vérifier une source avant de la citer dans un document professionnel.',
  audioType: 'capsule pédagogique ou exercice audio',
  audience: 'Adultes débutants écoutant la capsule sur téléphone depuis leur espace apprenant, parfois dans un environnement bruyant.',
  sourceMaterials: 'Procédure validée, plan pédagogique, trois exemples fictifs, charte sonore autorisée et liste des sources officielles à citer.',
  role: 'un concepteur éditorial et sonore, attentif à la narration, à l’intelligibilité, à l’accessibilité, aux droits, aux consentements et à la vérification des informations',
  communicationGoal: 'Permettre au public d’appliquer une vérification simple en trois étapes avant de partager ou de citer une information dans un document.',
  keyMessage: 'Une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.',
  productionMode: 'préparer un script et un conducteur à enregistrer ensuite',
  targetTool: 'application d’enregistrement et de montage audio',
  targetToolDetails: 'Application disponible dans l’organisme, avec export MP3 et WAV.',
  duration: 'entre 3 et 10 minutes',
  outputFormat: 'script balisé avec conducteur minuté et liste de contrôle',
  structure: 'Question concrète, erreur fréquente, méthode en trois étapes, exemple fictif, récapitulatif puis invitation à appliquer la méthode.',
  voiceAndSpeakers: 'Une voix adulte claire pour la narration, avec responsabilité éditoriale du formateur et aucun recours à l’imitation d’une personne réelle.',
  tonePacing: 'Ton rassurant et professionnel, débit modéré, phrases courtes et pause de deux secondes après chaque étape.',
  pronunciation: 'Épeler les sigles à la première occurrence, lire les nombres en toutes lettres et signaler les noms propres à faire vérifier.',
  soundMusic: 'Générique très court sous licence, aucune musique sous les explications et silence bref entre les trois étapes.',
  accessibilityTranscript: 'Fournir une transcription intégrale relue, identifier la voix et décrire chaque information importante portée uniquement par le son.',
  rightsConsent: 'Utiliser uniquement des voix, musiques, œuvres et extraits disposant des droits, licences et consentements documentés pour cet usage et cette diffusion.',
  technicalQuality: 'Voix intelligible, niveau homogène, absence de saturation et de bruit gênant, contrôle au casque, sur téléphone et sur ordinateur.',
  verificationMethod: 'Faire relire le script par le formateur, contrôler les faits, prononciations, droits et consentements, puis écouter le résultat et vérifier la transcription avant diffusion.',
};

describe('catégorie Audio', () => {
  it('valide une configuration complète et lui attribue 100 points', () => {
    expect(audioCategory.schema.safeParse(completeValues).success).toBe(true);

    const diagnostic = calculateCategoryScore(audioCategory, completeValues);

    expect(diagnostic.total).toBe(100);
    expect(diagnostic.criteria.map((criterion) => criterion.maxPoints)).toEqual([25, 15, 25, 35]);
    expect(diagnostic.criteria.every((criterion) => criterion.missing.length === 0)).toBe(true);
  });

  it('explique les manques et améliore le score lorsque le contenu est mieux cadré', () => {
    const weakValues: AudioValues = {
      ...completeValues,
      audioContext: 'Faire une courte capsule audio sur une méthode.',
      audience: 'adultes',
      sourceMaterials: '',
      role: 'un rédacteur',
      communicationGoal: 'Expliquer une méthode.',
      keyMessage: 'Vérifier les sources.',
      structure: '',
      voiceAndSpeakers: '',
      tonePacing: '',
      pronunciation: '',
      soundMusic: '',
      accessibilityTranscript: '',
      rightsConsent: 'Respecter les droits.',
      technicalQuality: '',
      verificationMethod: 'Faire une relecture.',
    };

    const weakDiagnostic = calculateCategoryScore(audioCategory, weakValues);
    const completeDiagnostic = calculateCategoryScore(audioCategory, completeValues);

    expect(weakDiagnostic.total).toBeLessThan(completeDiagnostic.total);
    expect(weakDiagnostic.criteria.flatMap((criterion) => criterion.missing).length).toBeGreaterThan(0);
    expect(weakDiagnostic.criteria.every((criterion) => criterion.recommendation.length > 20)).toBe(true);
  });

  it('construit toujours le même prompt et rappelle les limites de production', () => {
    const firstPrompt = audioCategory.buildPrompt(completeValues);
    const secondPrompt = audioCategory.buildPrompt({ ...completeValues });

    expect(secondPrompt).toBe(firstPrompt);
    expect(firstPrompt).toContain('## Contexte');
    expect(firstPrompt).toContain('## Rôle');
    expect(firstPrompt).toContain('## Objectif');
    expect(firstPrompt).toContain('## Précisions');
    expect(firstPrompt).toContain('ne clones jamais la voix d’une personne réelle');
    expect(firstPrompt).toContain('N’affirme jamais avoir enregistré, synthétisé, monté');
    expect(firstPrompt).toContain('Prévois une transcription relue');
  });
});
