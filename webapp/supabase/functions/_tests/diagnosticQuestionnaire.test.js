import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  DIAGNOSTIC_QUESTIONNAIRE_VERSION,
  validateDiagnosticQuestionnaire,
} from '../_shared/diagnosticQuestionnaire.js'

const endpoint = readFileSync(resolve('supabase/functions/submit-diagnostic-questionnaire/index.ts'), 'utf8')
const migration = readFileSync(resolve('supabase/migrations/20260829103118_add_diagnostic_ia_preparation_questionnaire.sql'), 'utf8')

const validAnswers = {
  first_name: 'Camille', last_name: 'Martin', organization: 'Atelier Exemple', job_title: 'Responsable', sector: 'Services',
  organization_size: '1_9', tools_used: 'Google Workspace', ai_level: 'beginner', repetitive_tasks: 'Compte rendu',
  documents_handled: 'Documents génériques', main_difficulty: 'Manque de temps', diagnostic_goal: 'Prioriser', one_task_to_remove: 'Relancer les demandes',
}

test('borne et normalise les réponses du questionnaire côté client et serveur', () => {
  const result = validateDiagnosticQuestionnaire({ ...validAnswers, first_name: '  Camille  ' })
  assert.equal(result.error, undefined)
  assert.equal(result.data.first_name, 'Camille')
  assert.equal(result.data.questionnaire_version, DIAGNOSTIC_QUESTIONNAIRE_VERSION)
  assert.equal(validateDiagnosticQuestionnaire({ ...validAnswers, tools_used: 'x'.repeat(1001) }).error, 'Certaines réponses sont absentes ou trop longues.')
  assert.equal(validateDiagnosticQuestionnaire({ ...validAnswers, ai_level: 'unknown' }).error, 'Le niveau IA est invalide.')
})

test('réserve la soumission au propriétaire d une réservation confirmée, sans toucher au LMS', () => {
  assert.match(endpoint, /auth[.]getUser\(accessToken\)/)
  assert.match(endpoint, /from\('diagnostic_ia_bookings'\)/)
  assert.match(endpoint, /booking[.]user_id !== user[.]id/)
  assert.match(endpoint, /booking[.]status !== 'booked'/)
  assert.match(endpoint, /from\('diagnostic_ia_preparation_questionnaires'\)/g)
  assert.match(endpoint, /Ce questionnaire a déjà été transmis/)
  assert.match(endpoint, /function safeQuestionnaireErrorCode\(error: unknown\)/)
  assert.match(endpoint, /console[.]error\('submit-diagnostic-questionnaire:', code\)/)
  assert.doesNotMatch(endpoint, /console[.]error\('submit-diagnostic-questionnaire:', error\)/)
  assert.doesNotMatch(endpoint, /from\(['"](?:purchases|course_access)['"]\)/)
  assert.doesNotMatch(endpoint, /Stripe|stripe/)
})

test('versionne la réponse, applique RLS et planifie une suppression à douze mois', () => {
  assert.match(migration, /booking_id uuid NOT NULL UNIQUE/)
  assert.match(migration, /questionnaire_version = 'DIAGNOSTIC-IA-PREPARATION-2026-08-29'/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /auth[.]uid\(\)\) = user_id/)
  assert.match(migration, /private[.]is_strict_admin/)
  assert.match(migration, /retention_due_at = NEW[.]completed_at \+ interval '12 months'/)
  assert.match(migration, /delete_expired_diagnostic_ia_questionnaires/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public[.](?:purchases|course_access)/i)
  assert.doesNotMatch(migration, /stripe/i)
})
