import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const professionalEmailSchema = z.object({
  need: z.string().trim().min(20, 'Décrivez le besoin en au moins 20 caractères.').max(600, 'Limitez le besoin à 600 caractères.'),
  recipient: z.string().trim().min(2, 'Indiquez le destinataire.').max(160, 'Limitez le destinataire à 160 caractères.'),
  usefulInformation: z.string().trim().max(800, 'Limitez les informations utiles à 800 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(240, 'Limitez le rôle à 240 caractères.'),
  objective: z.string().trim().min(15, "Décrivez l’objectif en au moins 15 caractères.").max(600, "Limitez l’objectif à 600 caractères."),
  successCriteria: z.string().trim().max(400, 'Limitez les critères de réussite à 400 caractères.'),
  tone: z.string().trim().min(1, 'Choisissez un ton.'),
  expectedFormat: z.string().trim().min(1, 'Choisissez un format.'),
  requiredElements: z.string().trim().max(500, 'Limitez les éléments obligatoires à 500 caractères.'),
  constraints: z.string().trim().max(500, 'Limitez les contraintes à 500 caractères.'),
}).strict();

export type ProfessionalEmailValues = z.infer<typeof professionalEmailSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: ProfessionalEmailValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  const needLength = textLength(values.need);
  if (needLength >= 80) {
    earnedPoints += 12;
    present.push('Le besoin est décrit avec un contexte exploitable.');
  } else if (needLength >= 40) {
    earnedPoints += 9;
    present.push('Le besoin général est compréhensible.');
    missing.push('Quelques repères supplémentaires sur la situation.');
  } else {
    earnedPoints += 6;
    present.push('Une première description du besoin est fournie.');
    missing.push('Le contexte, la situation et le résultat attendu sont encore peu détaillés.');
  }

  if (textLength(values.recipient) >= 12) {
    earnedPoints += 7;
    present.push('Le destinataire est décrit précisément.');
  } else {
    earnedPoints += 5;
    present.push('Le destinataire est indiqué.');
    missing.push('Le rôle, le niveau d’information ou la relation avec le destinataire.');
  }

  const informationLength = textLength(values.usefulInformation);
  if (informationLength >= 40) {
    earnedPoints += 6;
    present.push('Les informations utiles à reprendre sont détaillées.');
  } else if (informationLength >= 15) {
    earnedPoints += 4;
    present.push('Quelques informations utiles sont fournies.');
    missing.push('Les faits, dates ou repères autorisés à intégrer au courriel.');
  } else {
    missing.push('Les informations factuelles utiles au courriel.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la situation, le destinataire et uniquement les faits nécessaires, sans donnée sensible.',
  };
}

function evaluateRole(values: ProfessionalEmailValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 50) {
    return {
      earnedPoints: 15,
      present: ['Le rôle et la compétence attendue sont clairement définis.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond bien à votre contexte professionnel.',
    };
  }
  if (length >= 25) {
    return {
      earnedPoints: 12,
      present: ['Un rôle professionnel est attribué à l’assistant.'],
      missing: ['Le domaine d’expertise ou la posture attendue.'],
      recommendation: 'Ajoutez la compétence attendue, par exemple communication interne, relation client ou pédagogie.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une posture et une compétence adaptées au courriel.'],
    recommendation: 'Décrivez plus précisément le rôle : spécialité, posture et responsabilité dans la rédaction.',
  };
}

function evaluateObjective(values: ProfessionalEmailValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.objective);

  if (objectiveLength >= 60) {
    earnedPoints += 17;
    present.push('L’objectif décrit une action et un résultat attendus.');
  } else if (objectiveLength >= 30) {
    earnedPoints += 13;
    present.push('L’objectif principal est compréhensible.');
    missing.push('Le résultat concret attendu après la lecture du courriel.');
  } else {
    earnedPoints += 8;
    present.push('Un objectif général est indiqué.');
    missing.push('L’action attendue du destinataire et le résultat recherché.');
  }

  const criteriaLength = textLength(values.successCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères de réussite permettent de contrôler le résultat.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de réussite est fourni.');
    missing.push('Des critères plus observables pour vérifier le courriel.');
  } else {
    missing.push('Les critères permettant de reconnaître un courriel réussi.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Indiquez ce que le destinataire doit comprendre ou faire et comment vous vérifierez que le courriel remplit son objectif.',
  };
}

function evaluatePrecisions(values: ProfessionalEmailValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  if (values.tone) {
    earnedPoints += 10;
    present.push(`Le ton « ${values.tone} » est défini.`);
  } else {
    missing.push('Le ton du courriel.');
  }

  if (values.expectedFormat) {
    earnedPoints += 8;
    present.push(`Le format « ${values.expectedFormat} » est demandé.`);
  } else {
    missing.push('La structure ou la longueur attendue.');
  }

  const requiredLength = textLength(values.requiredElements);
  if (requiredLength >= 30) {
    earnedPoints += 8;
    present.push('Les éléments obligatoires sont détaillés.');
  } else if (requiredLength >= 10) {
    earnedPoints += 5;
    present.push('Un élément obligatoire est indiqué.');
    missing.push('La liste complète des informations à faire apparaître.');
  } else {
    missing.push('Les éléments qui doivent impérativement apparaître.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 40) {
    earnedPoints += 9;
    present.push('Les contraintes et limites sont clairement définies.');
  } else if (constraintsLength >= 15) {
    earnedPoints += 6;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de longueur, de vocabulaire ou les éléments à éviter.');
  } else {
    missing.push('Les contraintes, limites ou éléments à éviter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Ajoutez les éléments obligatoires, les limites et la forme attendue pour réduire les interprétations.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildProfessionalEmailPrompt(values: ProfessionalEmailValues) {
  return [
    '## Contexte',
    `- Besoin : ${values.need}`,
    `- Destinataire : ${values.recipient}`,
    optionalLine('Informations utiles et autorisées', values.usefulInformation),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    values.objective,
    optionalLine('Critères de réussite', values.successCriteria),
    '',
    '## Précisions',
    `- Ton : ${values.tone}`,
    `- Format attendu : ${values.expectedFormat}`,
    optionalLine('Éléments obligatoires', values.requiredElements),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    '',
    '## Consigne finale',
    'Rédige le courriel complet avec un objet clair, une introduction directe, un corps structuré et une conclusion adaptée. N’invente aucune information absente. Si une information indispensable manque, signale-la avant de proposer le courriel. Relis le résultat selon les critères indiqués.',
  ].join('\n');
}

export const professionalEmailCategory: StudioCategoryConfig<ProfessionalEmailValues> = {
  id: 'professional-email',
  label: 'Courriel professionnel',
  shortDescription: 'Préparer une consigne claire pour rédiger un courriel adapté à son destinataire.',
  schema: professionalEmailSchema,
  defaultValues: {
    need: '',
    recipient: '',
    usefulInformation: '',
    role: 'un assistant de communication professionnelle attentif, clair et précis',
    objective: '',
    successCriteria: '',
    tone: 'professionnel et cordial',
    expectedFormat: 'courriel concis avec un objet et des paragraphes courts',
    requiredElements: '',
    constraints: '',
  },
  fields: [
    {
      name: 'need',
      label: 'Décrivez votre besoin',
      type: 'textarea',
      cropSection: 'context',
      help: 'Expliquez la situation sans nom, adresse, dossier réel ou information confidentielle.',
      placeholder: 'Exemple : préparer un rappel avant une classe virtuelle qui aura lieu la semaine prochaine.',
      required: true,
      maxLength: 600,
      rows: 4,
    },
    {
      name: 'recipient',
      label: 'À qui s’adresse le courriel ?',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez une fonction ou un groupe, sans saisir une identité réelle.',
      placeholder: 'Exemple : participants adultes inscrits à une formation à distance',
      required: true,
      maxLength: 160,
      autoComplete: 'off',
    },
    {
      name: 'usefulInformation',
      label: 'Informations utiles et autorisées',
      type: 'textarea',
      cropSection: 'context',
      help: 'Ajoutez uniquement les faits nécessaires : date fictive, étapes, documents ou consignes génériques.',
      placeholder: 'Exemple : connexion 10 minutes avant, lien disponible dans la convocation, prévoir un casque.',
      required: false,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Le rôle précise la posture et la compétence attendues pour rédiger le courriel.',
      required: true,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'objective',
      label: 'Objectif du courriel',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le destinataire doit comprendre, décider ou faire après la lecture.',
      placeholder: 'Exemple : rappeler les informations pratiques et obtenir une confirmation de présence.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez deux ou trois signes permettant de vérifier que le courriel est réussi.',
      placeholder: 'Exemple : toutes les étapes sont présentes, le message tient en 180 mots et l’action attendue est explicite.',
      required: false,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'tone',
      label: 'Ton du courriel',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un ton cohérent avec la relation et la situation.',
      required: true,
      options: [
        { value: 'professionnel et cordial', label: 'Professionnel et cordial' },
        { value: 'chaleureux et rassurant', label: 'Chaleureux et rassurant' },
        { value: 'direct et factuel', label: 'Direct et factuel' },
        { value: 'pédagogique et encourageant', label: 'Pédagogique et encourageant' },
        { value: 'formel et institutionnel', label: 'Formel et institutionnel' },
      ],
    },
    {
      name: 'expectedFormat',
      label: 'Format attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le format aide à obtenir un résultat directement réutilisable.',
      required: true,
      options: [
        { value: 'courriel concis avec un objet et des paragraphes courts', label: 'Courriel concis et structuré' },
        { value: 'courriel détaillé avec un objet, des intertitres et une liste à puces', label: 'Courriel détaillé avec liste' },
        { value: 'message très court avec un objet et un appel à l’action', label: 'Message très court' },
        { value: 'courriel formel avec objet, formule d’appel et formule de politesse', label: 'Courriel formel' },
      ],
    },
    {
      name: 'requiredElements',
      label: 'Éléments obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les informations qui doivent impérativement figurer dans le résultat.',
      placeholder: 'Exemple : objet, date, durée, matériel à prévoir et demande de confirmation.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez une longueur, des mots à éviter, un délai ou une limite importante.',
      placeholder: 'Exemple : moins de 180 mots, phrases courtes, aucun jargon et aucune information inventée.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
  ],
  requiredInformation: [
    'La situation et le besoin',
    'Le type de destinataire',
    'Le rôle attendu',
    'L’objectif du courriel',
    'Le ton et le format',
  ],
  buildPrompt: buildProfessionalEmailPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Présence d’une situation exploitable, d’un destinataire défini et des faits autorisés utiles.',
      checkpoints: [
        'Besoin : 6, 9 ou 12 points selon le niveau de détail.',
        'Destinataire : 5 ou 7 points selon sa précision.',
        'Informations utiles : 0, 4 ou 6 points selon leur niveau de détail.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de la posture et de la compétence confiées à l’assistant.',
      checkpoints: [
        'Rôle court : 8 points.',
        'Rôle précisé : 12 points.',
        'Posture et compétence détaillées : 15 points.',
      ],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté du résultat attendu et présence de critères permettant de le vérifier.',
      checkpoints: [
        'Objectif : 8, 13 ou 17 points selon son niveau de détail.',
        'Critères de réussite : 0, 5 ou 8 points selon leur caractère observable.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du ton, du format, des éléments obligatoires et des limites.',
      checkpoints: [
        'Ton défini : 10 points.',
        'Format défini : 8 points.',
        'Éléments obligatoires : 0, 5 ou 8 points.',
        'Contraintes : 0, 6 ou 9 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Répondez aux questions dans l’ordre. Les champs facultatifs améliorent la précision du prompt et son score de qualité.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Utilisez des situations génériques, fictives ou anonymisées.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations présentes dans le formulaire et sur une grille CROP documentée.',
  },
  examples: [
    {
      title: 'Rappel de réunion',
      description: 'Préparer un rappel clair avec les informations pratiques et l’action attendue.',
      prompt: `## Contexte
Prépare un rappel destiné à des participants adultes inscrits à une réunion à distance. La réunion fictive est prévue mardi à 10 h et le lien figure dans leur convocation.

## Rôle
Agis comme un assistant de communication professionnelle clair et attentif.

## Objectif
Rappelle les modalités pratiques et demande une confirmation de présence avant lundi midi.

## Précisions
Adopte un ton professionnel et cordial. Rédige moins de 160 mots, avec un objet explicite, des paragraphes courts et aucune information inventée.`,
    },
    {
      title: 'Réponse à une demande',
      description: 'Structurer une réponse professionnelle, factuelle et adaptée au destinataire.',
      prompt: `## Contexte
Réponds à la demande générique d’un responsable d’équipe qui souhaite connaître les modalités d’un accompagnement collectif.

## Rôle
Agis comme un conseiller en formation précis, accessible et prudent.

## Objectif
Présente les étapes disponibles et invite le destinataire à préciser son effectif, ses objectifs et la période souhaitée.

## Précisions
Utilise un ton professionnel et pédagogique. Structure la réponse en trois courts paragraphes. N’invente ni tarif, ni disponibilité, ni engagement contractuel.`,
    },
    {
      title: 'Suivi après formation',
      description: 'Rédiger un message de suivi avec les ressources et les prochaines étapes.',
      prompt: `## Contexte
Prépare un message de suivi destiné à un groupe d’adultes ayant terminé une formation fictive sur les usages responsables des outils numériques.

## Rôle
Agis comme un formateur encourageant et attentif à l’autonomie des participants.

## Objectif
Rappelle où retrouver les ressources, propose une prochaine action simple et invite à compléter l’évaluation prévue.

## Précisions
Adopte un ton pédagogique et cordial. Rédige un objet et moins de 180 mots. Distingue clairement les ressources, l’action proposée et l’évaluation, sans donnée personnelle.`,
    },
  ],
  recommendations: [
    'Décrire le destinataire par sa fonction plutôt que par son identité.',
    'Distinguer les faits fournis des informations qui ne doivent pas être inventées.',
    'Définir une action attendue et des critères de réussite observables.',
  ],
};
