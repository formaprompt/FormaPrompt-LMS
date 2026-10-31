import { IAG_RUBRIC_VERSION, WORK_IDS, rubricFor } from '../../supabase/functions/_shared/iagAssessment.js';

export const IAG_COURSE_ID = 'formation-ia-generative-elearning';
const CONTENT_VERSION = 'iag-v7-2026-10-21-with-explicit-v8-media';
// Pass the existing authenticated Supabase client. No service key in the browser.
export function createIagAssessmentApi(client) {
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message || 'Enregistrement impossible.');
    return data;
  }
  return {
    async loadRubrics() {
      const before = await client.auth.getUser();
      const actor = before.data?.user?.id;
      if (before.error || !actor) throw new Error('Connectez-vous pour consulter les grilles d’évaluation.');
      const { data, error } = await client.functions.invoke('paid-course-content', {
        body: { action: 'iag_rubrics', courseId: IAG_COURSE_ID, contentVersion: CONTENT_VERSION },
      });
      const after = await client.auth.getUser();
      if (after.error || after.data?.user?.id !== actor) throw new Error('La session a changé. Rechargez les grilles.');
      if (error) {
        let detail;
        try { detail = await error.context?.json?.(); } catch { /* Keep a safe fallback. */ }
        throw Object.assign(new Error(detail?.error || 'Les grilles ne peuvent pas être chargées. Réessayez.'), { code: detail?.code });
      }
      try {
        if (data?.rubricVersion !== IAG_RUBRIC_VERSION) throw new Error('Version inattendue.');
        return Object.fromEntries(WORK_IDS.map(id => [id, rubricFor(data.rubrics, id)]));
      } catch { throw new Error('La grille reçue ne correspond pas à la version attendue.'); }
    },
    async loadHistory(userId) {
      let query = client.from('iag_assessment_history').select('*').order('received_at', { ascending: true });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message || 'Historique indisponible.');
      return data || [];
    },
    submitWork: ({ workId, responseText, assistants = [], changes = '', registrationConditions = '' }) =>
      rpc('iag_submit_work', { p_work_id: String(workId), p_response_text: responseText,
        p_assistants: assistants, p_changes: changes, p_registration_conditions: registrationConditions }),
    recordReview: ({ responseId, observations, essentials, decision, feedback, changesRequired = '', realTrialsEvidence = '' }) =>
      rpc('iag_record_review', { p_response_id: responseId, p_observations: observations,
        p_essentials: essentials, p_decision: decision, p_feedback: feedback,
        p_changes_required: changesRequired, p_real_trials_evidence: realTrialsEvidence }),
  };
}
