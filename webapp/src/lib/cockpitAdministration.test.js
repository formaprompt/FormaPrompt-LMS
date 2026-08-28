import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueCockpitActions,
  deriveIncidentCockpitActions,
  deriveQualityRiskCockpitActions,
  fetchCockpitSummary,
  getActionDestination,
  prioritizeCockpitActions,
} from './cockpitAdministration.js';

test('les incidents ouverts remontent dans le cockpit, les incidents clôturés non', () => {
  const actions = deriveIncidentCockpitActions([
    { id: 'incident-open-123', incident_status: 'decision_pending', severity: 'high', course_id: 'formation-ia', reported_at: '2026-08-20T12:00:00Z' },
    { id: 'incident-closed-456', incident_status: 'closed', severity: 'critical', course_id: 'formation-ia', reported_at: '2026-08-20T12:00:00Z' },
  ], new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['incident-open-123']);
  assert.equal(actions[0].destination_path, '/admin/acces-incidents');
  assert.match(actions[0].neutral_label, /^Incident — Décision attendue/);
});

test('seuls les risques dont needsReview est vrai remontent dans le cockpit', () => {
  const actions = deriveQualityRiskCockpitActions({
    records: [{ id: 'record-1', severity: 'high', detected_at: '2026-08-01T12:00:00Z' }],
    risks: [
      { id: 'risk-review-123', quality_record_id: 'record-1', status: 'assessed', review_due_at: '2026-08-21T12:00:00Z', created_at: '2026-08-01T12:00:00Z' },
      { id: 'risk-future-456', quality_record_id: 'record-1', status: 'assessed', review_due_at: '2026-08-23T12:00:00Z', created_at: '2026-08-01T12:00:00Z' },
    ],
  }, new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['risk-review-123']);
  assert.equal(actions[0].severity, 'high');
  assert.equal(actions[0].destination_path, '/admin/qualite');
});

test('les compléments de la file cockpit restent dédoublonnés', () => {
  const existing = [{ domain: 'incident', item_type: 'disciplinary_incident', item_id: 'incident-1' }];
  const additions = appendUniqueCockpitActions(existing, [
    { domain: 'incident', item_type: 'disciplinary_incident', item_id: 'incident-1' },
    { domain: 'quality', item_type: 'quality_risk_review', item_id: 'risk-1' },
    { domain: 'quality', item_type: 'quality_risk_review', item_id: 'risk-1' },
  ]);
  assert.deepEqual(additions.map((action) => action.item_id), ['risk-1']);
});

test('la priorité fonctionnelle place le client avant la qualité et la technique', () => {
  const actions = prioritizeCockpitActions([
    { item_id: 'stripe', domain: 'stripe', item_type: 'orphan_transaction', severity: 'high', age_seconds: 500 },
    { item_id: 'bpf', domain: 'bpf', item_type: 'bpf_missing_hours', severity: 'high', age_seconds: 600 },
    { item_id: 'quality', domain: 'quality', item_type: 'quality_action', severity: 'high', age_seconds: 500 },
    { item_id: 'client', domain: 'quality', item_type: 'complaint', severity: 'medium', age_seconds: 10 },
  ], new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['client', 'quality', 'bpf', 'stripe']);
});

test('une alerte critique remonte immédiatement et les retards départagent un même groupe', () => {
  const actions = prioritizeCockpitActions([
    { item_id: 'future', domain: 'commercial', item_type: 'commercial_follow_up', severity: 'medium', due_at: '2026-08-23T10:00:00Z' },
    { item_id: 'overdue', domain: 'commercial', item_type: 'commercial_follow_up', severity: 'medium', due_at: '2026-08-21T10:00:00Z' },
    { item_id: 'critical', domain: 'stripe', item_type: 'amount_mismatch', severity: 'critical' },
  ], new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['critical', 'overdue', 'future']);
});

test('le chargement combine les sources de pilotage sans lire course_access directement', async () => {
  const calls = [];
  const builder = {
    select() { return builder; }, gte() { return builder; }, lte() { return builder; }, eq() { return builder; }, neq() { return builder; },
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
  };
  const client = {
    rpc: async (name, parameters) => {
      calls.push([name, parameters]);
      return { data: { kpis: {}, priority_actions: [] }, error: null };
    },
    from: (source) => { calls.push(['from', source]); return builder; },
  };

  await fetchCockpitSummary(client, {
    dateFrom: '2026-01-01',
    dateTo: '2026-08-22',
    courseId: 'formation-ia',
  });

  assert.deepEqual(calls[0], ['from', 'admin_training_activity_all_sources']);
  assert.deepEqual(calls[2], [
    'admin_get_cockpit_summary',
    { p_date_from: '2026-01-01', p_date_to: '2026-08-22', p_course_id: 'formation-ia' },
  ]);
  assert.ok(calls.some((call) => call.includes('disciplinary_incidents')));
  assert.ok(calls.some((call) => call.includes('quality_risks')));
  assert.ok(calls.some((call) => call.includes('quality_records')));
  assert.ok(!calls.some((call) => call.includes('course_access')), 'aucune lecture directe de course_access');
});

test('le chargement conserve les actions existantes lorsque les nouveaux registres sont vides', async () => {
  function query(data) {
    const builder = {
      select() { return builder; }, gte() { return builder; }, lte() { return builder; }, eq() { return builder; }, neq() { return builder; },
      then(resolve) { return Promise.resolve({ data, error: null }).then(resolve); },
    };
    return builder;
  }
  const existingAction = {
    domain: 'stripe', item_type: 'orphan_transaction', item_id: 'stripe-case-1', severity: 'high',
    neutral_label: 'Cas de reconciliation Stripe a examiner', created_at: '2026-08-20T12:00:00Z', age_seconds: 1,
  };
  const client = {
    rpc: async () => ({
      data: {
        kpis: { action_items_total: 1, critical_action_items: 0 },
        action_counts_by_domain: { stripe: 1 },
        priority_actions: [existingAction],
      },
      error: null,
    }),
    from: () => query([]),
  };

  const result = await fetchCockpitSummary(client, {
    dateFrom: '2026-01-01', dateTo: '2026-08-22', courseId: '',
  });

  assert.deepEqual(result.priority_actions, [existingAction]);
  assert.equal(result.kpis.action_items_total, 1);
  assert.deepEqual(result.action_counts_by_domain, { stripe: 1 });
});

test('les destinations sont limitées aux écrans administratifs existants', () => {
  assert.equal(getActionDestination({ destination_path: '/admin/commercial' }), '/admin/commercial');
  assert.equal(getActionDestination({ destination_path: '/admin/qualite' }), '/admin/qualite');
  assert.equal(getActionDestination({ destination_path: '/admin/bpf' }), '/admin/bpf');
  assert.equal(getActionDestination({ item_type: 'withdrawal_request', destination_path: '/admin' }), '/admin/retractations');
  assert.equal(getActionDestination({ destination_path: 'https://example.invalid' }), null);
});
