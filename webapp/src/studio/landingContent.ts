export const studioLandingContent = {
  scoreRules: [
    { id: 'context', label: 'Contexte', maxPoints: 25, description: 'Présence d’une situation exploitable, d’un destinataire défini et des faits autorisés utiles.' },
    { id: 'role', label: 'Rôle', maxPoints: 15, description: 'Précision de la posture et de la compétence confiées à l’assistant.' },
    { id: 'objective', label: 'Objectif', maxPoints: 25, description: 'Clarté du résultat attendu et présence de critères permettant de le vérifier.' },
    { id: 'precisions', label: 'Précisions', maxPoints: 35, description: 'Définition du ton, du format, des éléments obligatoires et des limites.' },
  ],
  beforeAfter: {
    vagueRequest: '« Rédige un mail pour rappeler une réunion. »',
    missingDescription: 'Le destinataire, le résultat attendu, le ton et les informations pratiques ne sont pas définis.',
    structuredPrompt: '« Contexte : rappel destiné à des participants adultes. Rôle : assistant de communication pédagogique. Objectif : rappeler les modalités et obtenir une confirmation. Précisions : ton cordial, moins de 180 mots, objet clair, date fictive et action attendue explicite. »',
    benefit: 'Le résultat peut être relu à partir d’éléments observables.',
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
} as const;
