export const DIAGNOSTIC_QUESTIONNAIRE_VERSION = 'DIAGNOSTIC-IA-PREPARATION-2026-08-29'

export const ORGANIZATION_SIZES = ['independent', '1_9', '10_49', '50_249', '250_plus']
export const AI_LEVELS = ['discovery', 'beginner', 'intermediate', 'advanced']

const TEXT_FIELDS = {
  first_name: [1, 80],
  last_name: [1, 80],
  organization: [1, 160],
  job_title: [1, 120],
  sector: [1, 120],
  tools_used: [1, 1000],
  repetitive_tasks: [1, 2000],
  documents_handled: [1, 1000],
  main_difficulty: [1, 1000],
  diagnostic_goal: [1, 1000],
  one_task_to_remove: [1, 1000],
}

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export function validateDiagnosticQuestionnaire(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Questionnaire invalide.' }
  }
  const normalized = {}
  for (const [field, [minimum, maximum]] of Object.entries(TEXT_FIELDS)) {
    const value = normalizedText(payload[field])
    if (value.length < minimum || value.length > maximum) {
      return { error: 'Certaines réponses sont absentes ou trop longues.' }
    }
    normalized[field] = value
  }
  if (!ORGANIZATION_SIZES.includes(payload.organization_size)) {
    return { error: 'La taille de structure est invalide.' }
  }
  if (!AI_LEVELS.includes(payload.ai_level)) {
    return { error: 'Le niveau IA est invalide.' }
  }
  return {
    data: {
      ...normalized,
      organization_size: payload.organization_size,
      ai_level: payload.ai_level,
      questionnaire_version: DIAGNOSTIC_QUESTIONNAIRE_VERSION,
    },
  }
}
