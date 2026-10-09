export const CHALLENGE_COURSE_ID = 'formation-ia-act';

export async function aiActChallengeApi(action, payload = {}) {
  const { supabase } = await import('./supabaseClient');
  const { data, error } = await supabase.rpc('ai_act_challenge', { p_action: action, p_payload: payload });
  if (error) throw error;
  return data;
}

export async function challengeTrainingApi(action, payload = {}) {
  const { supabase } = await import('./supabaseClient');
  const { data, error } = await supabase.rpc('challenge_training_status', { p_action: action, p_payload: payload });
  if (error) throw error;
  return data;
}

export async function adminChallengeTrainingApi(action, payload = {}) {
  const { supabase } = await import('./supabaseClient');
  const { data, error } = await supabase.rpc('admin_challenge_training', { p_action: action, p_payload: payload });
  if (error) throw error;
  return data;
}

export const trainingEndStatus = (status) => ({ ongoing: 'Fin non déclarée', declared: 'Fin déclarée · vérification en attente', verified: 'Fin effective vérifiée', review_required: 'Dossier à examiner' }[status] || 'État à vérifier');

export function trainingEndError(error) {
  const detail = challengeError(error);
  if (detail.denied || detail.conflict) return detail;
  const message = error?.message || '';
  if (message.includes('ALREADY_VERIFIED')) return { conflict: true, text: 'La fin est déjà vérifiée. Rechargez le dossier avant toute nouvelle décision.' };
  if (message.includes('REQUEST_ID_REUSED')) return { conflict: true, text: 'Cette demande a déjà été utilisée différemment. Rechargez le dossier avant de continuer.' };
  if (message.includes('TRAINING_NOT_CLOSED')) return { text: 'Le dossier de formation est encore actif. Sa clôture administrative doit être examinée avant cette vérification.' };
  if (message.includes('EVIDENCE_')) return { text: 'Le justificatif est absent ou ne permet pas cette vérification. Examinez une pièce admissible.' };
  if (message.includes('INVALID_')) return { text: 'La date ou les informations fournies ne sont pas valides. Vérifiez les champs.' };
  return detail;
}

export const challengeStatus = (status) => ({ not_started: 'Non démarré', in_progress: 'En cours', passed: 'Réussi', failed: 'Non réussi' }[status] || 'Non démarré');
export const challengeDate = (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
export const openAttempt = (state) => state?.attempts?.find((attempt) => attempt.status === 'in_progress');
export const completedAttempts = (state) => (state?.attempts || []).filter((attempt) => attempt.status !== 'in_progress');
export const canFinishAttempt = (attempt, questions, pending = false) => !pending && attempt?.status === 'in_progress' && questions?.length === 12 && questions.every((q) => q.options.some((o) => o.code === attempt.answers?.[q.code]));
export function challengeError(error) {
  const message = error?.message || '';
  if (message.includes('CHALLENGE_PROCESSING_RESTRICTED')) return { restricted: true, text: 'Le suivi de ce jeu est limité à la suite d’une demande relative à vos données. Vous pouvez consulter vos résultats existants. Contactez FormaPrompt pour toute nouvelle participation.' };
  if (message.includes('ACCESS_DENIED')) return { denied: true, text: 'Votre accès à cette formation ou votre habilitation ne permet plus cette consultation.' };
  if (message.includes('REVISION_CONFLICT')) return { conflict: true, text: 'Une autre fenêtre a enregistré des réponses. Rechargez les réponses du serveur avant de continuer.' };
  if (message.includes('INCOMPLETE_ATTEMPT')) return { text: 'Les douze réponses doivent être enregistrées avant de terminer.' };
  if (message.includes('ATTEMPT_LIMIT')) return { text: 'Les deux tentatives sont déjà utilisées.' };
  if (message.includes('ATTEMPT_CLOSED')) return { conflict: true, text: 'Cette tentative est déjà clôturée. Rechargez votre bilan.' };
  return { text: 'L’opération n’a pas été confirmée par le serveur. Vérifiez votre connexion puis réessayez.' };
}

// Agrégation de présentation uniquement : les notes et corrections proviennent du serveur.
export function challengeThemes(attempt, questions = []) {
  const themes = new Map();
  for (const result of attempt?.results || []) {
    const theme = questions.find((q) => q.code === result.question_code)?.theme || result.theme || 'Thématique';
    const item = themes.get(theme) || { theme, correct: 0, total: 0 };
    item.total += 1;
    item.correct += result.is_correct ? 1 : 0;
    themes.set(theme, item);
  }
  return [...themes.values()];
}
