// Les six questions V7 ; aucune réponse attendue, note ou condition d'admission.
export const IAG_COURSE_ID = 'formation-ia-generative-elearning';
export const IAG_POSITIONING_VERSION = 'iag-v7-six-questions';
export const IAG_QUESTIONS = Object.freeze([
  { id: 'computer', title: "Utiliser l'ordinateur", help: 'Pour ouvrir un navigateur, copier puis coller un texte, retrouver un fichier et enregistrer votre travail, indiquez : seul, avec aide ou à apprendre.', placeholder: 'Ouvrir le navigateur : seul. Copier-coller : avec aide…' },
  { id: 'experience', title: "Votre expérience de l'IA", help: 'Jamais, quelques essais ou régulièrement ? Donnez un exemple sans recopier de conversation personnelle.', placeholder: "Je n'ai encore jamais utilisé d'IA." },
  { id: 'need', title: 'Votre besoin', help: 'Quelle tâche simple aimeriez-vous mieux préparer : écrire, rechercher une information, lire un document ou organiser des tâches ? Donnez un exemple.', placeholder: 'Je voudrais préparer un courriel professionnel simple.' },
  { id: 'verification', title: 'Vérifier une réponse', help: "Une réponse annonce une ouverture à 8 h alors qu'aucun horaire n'est fourni. Que faites-vous pour vérifier ce chiffre ?", placeholder: 'Décrivez ce que vous feriez. « Je ne sais pas encore » est une réponse possible.' },
  { id: 'learning', title: "Votre manière d'apprendre", help: 'Texte plus grand, explications écrites, sous-titres disponibles, pauses ou navigation au clavier : indiquez seulement ce qui vous aide, sans diagnostic ni donnée sensible.', placeholder: 'Je préfère lire les explications et faire des pauses.' },
  { id: 'tools', title: 'Vos accès aux outils', help: 'Pour ChatGPT, Claude, Gemini, Mistral, Copilot, Perplexity et DeepSeek : accès disponible, à vérifier ou indisponible. Pouvez-vous ouvrir les pages sources et les images fournies ? Aucun compte payant requis.', placeholder: 'ChatGPT : à vérifier. Claude : indisponible… Pages sources et images : oui.' },
]);

export function normalizeIagAnswers(input, complete = false) {
  if (!Array.isArray(input) || input.length > IAG_QUESTIONS.length) throw new Error('Les six réponses doivent être présentées dans le formulaire.');
  const byId = new Map();
  for (const answer of input) {
    if (!answer || !IAG_QUESTIONS.some((question) => question.id === answer.id) || byId.has(answer.id) || typeof answer.text !== 'string' || answer.text.length > 2000) {
      throw new Error('Une réponse est invalide ou dépasse 2 000 caractères.');
    }
    byId.set(answer.id, answer.text.trim());
  }
  const answers = IAG_QUESTIONS.map(({ id }) => ({ id, text: byId.get(id) || '' }));
  if (complete && answers.some(({ text }) => !text)) throw new Error('Répondez aux six questions ; vous pouvez écrire « Je ne sais pas encore ».');
  return answers;
}

export function isIagPositioningComplete(assessment) {
  if (!assessment || assessment.course_id !== IAG_COURSE_ID || assessment.is_initial !== true || assessment.questionnaire_version !== IAG_POSITIONING_VERSION || !assessment.submitted_at) return false;
  // Un ancien score ou une simple présence de ligne ne vaut pas remise V7.
  if (assessment.score !== null || assessment.maximum_score !== null || assessment.level !== null) return false;
  try { normalizeIagAnswers(assessment.answers, true); return true; } catch { return false; }
}

export async function requireIagPositioning(adminClient, userId) {
  const { data, error } = await adminClient.from('course_positioning_assessments')
    .select('course_id, is_initial, questionnaire_version, answers, submitted_at, score, maximum_score, level')
    .eq('user_id', userId).eq('course_id', IAG_COURSE_ID).eq('is_initial', true).maybeSingle();
  if (error) throw error;
  return isIagPositioningComplete(data);
}
