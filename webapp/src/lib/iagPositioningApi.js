import { IAG_COURSE_ID, normalizeIagAnswers } from '../../supabase/functions/_shared/iagPositioning.js';

export async function invokeIagPositioning(supabase, action, answers, revision) {
  const body = { action, courseId: IAG_COURSE_ID };
  if (answers !== undefined) body.answers = normalizeIagAnswers(answers, action === 'submit_positioning');
  if (revision !== undefined) body.revision = revision;
  const { data, error } = await supabase.functions.invoke('paid-course-content', { body });
  if (error) {
    let message = "Votre questionnaire n'a pas pu être enregistré. Vos réponses restent dans ce formulaire.";
    try { const response = await error.context?.json?.(); if (typeof response?.error === 'string') message = response.error; } catch { /* Message utilisateur sobre. */ }
    const failure = new Error(message); failure.status = error.context?.status; throw failure;
  }
  if (!data?.positioning) throw new Error('Le suivi du questionnaire est momentanément indisponible.');
  return data.positioning;
}

export const loadIagPositioning = (supabase) => invokeIagPositioning(supabase, 'positioning');
export const saveIagPositioning = (supabase, answers, revision) => invokeIagPositioning(supabase, 'save_positioning', answers, revision);
export const submitIagPositioning = (supabase, answers, revision) => invokeIagPositioning(supabase, 'submit_positioning', answers, revision);
