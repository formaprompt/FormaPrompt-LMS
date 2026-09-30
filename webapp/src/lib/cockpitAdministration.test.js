import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueCockpitActions,
  deriveIncidentCockpitActions,
  deriveQualityRiskCockpitActions,
  fetchCockpitSummary,
  formatMoney,
  getActionDestination,
  prioritizeCockpitActions,
} from './cockpitAdministration.js';

test('un montant sans devise valide reste lisible sans inventer une devise', () => {
  assert.equal(formatMoney(12345, 'unknown'), '123,45 — devise inconnue');
});

test('les incidents ouverts remontent dans le cockpit, les incidents clôturés non', () => {
  const actions = deriveIncidentCockpitActions([
    { id: 'incident-open-123', learner_user_id: 'user-1', incident_status: 'decision_pending', severity: 'high', course_id: 'formation-ia', reported_at: '2026-08-20T12:00:00Z' },
    { id: 'incident-closed-456', incident_status: 'closed', severity: 'critical', course_id: 'formation-ia', reported_at: '2026-08-20T12:00:00Z' },
  ], new Date('2026-08-22T12:00:00Z'), [{ user_id: 'user-1', course_id: 'formation-ia', learner_first_name: 'Marie', learner_last_name: 'Dupont', organization_name: 'Entreprise Alpha' }]);

  assert.deepEqual(actions.map((action) => action.item_id), ['incident-open-123']);
  assert.equal(actions[0].destination_path, '/admin/acces-incidents#incident-incident-open-123');
  assert.match(actions[0].neutral_label, /^Incident — Entreprise Alpha — Marie DUPONT · Formation IA générative · Décision attendue/);
  assert.doesNotMatch(actions[0].neutral_label, /incident-open-123|user-1/);
});

test('un incident conserve un nom exploitable issu du positionnement sans inscription', () => {
  const [action] = deriveIncidentCockpitActions([
    { id: 'incident-2', learner_user_id: 'user-2', course_id: 'formation-ia', incident_status: 'reported' },
  ], new Date(), [], [{ user_id: 'user-2', learner_name: 'Alice Martin' }]);
  assert.match(action.neutral_label, /Alice Martin/);
  assert.doesNotMatch(action.neutral_label, /user-2|incident-2/);
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
    select() { return builder; }, gte() { return builder; }, lte() { return builder; }, eq() { return builder; }, neq() { return builder; }, order() { return builder; },
    range() { return builder; },
    then(resolve) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve); },
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
  assert.deepEqual(calls.find(([name]) => name === 'admin_get_cockpit_summary'), [
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
      select() { return builder; }, gte() { return builder; }, lte() { return builder; }, eq() { return builder; }, neq() { return builder; }, order() { return builder; },
      range() { return builder; },
      then(resolve) { return Promise.resolve({ data, count: data.length, error: null }).then(resolve); },
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
  const incidentId = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(getActionDestination({ item_type: 'disciplinary_incident', item_id: incidentId, destination_path: `/admin/acces-incidents#incident-${incidentId}` }), `/admin/acces-incidents#incident-${incidentId}`);
  assert.equal(getActionDestination({ item_type: 'disciplinary_incident', item_id: incidentId, destination_path: '/admin/acces-incidents#incident-other' }), null);
  const bpf = { item_type: 'bpf_missing_hours', item_id: incidentId, source_kind: 'internal_lms', starts_on: '2026-03-01', ends_on: '2026-03-02' };
  const path = `/admin/bpf?du=2026-03-01&au=2026-03-02#bpf-activity-internal_lms-${incidentId}`;
  assert.equal(getActionDestination({ ...bpf, destination_path: path }), path);
  assert.equal(getActionDestination({ ...bpf, destination_path: 'https://example.invalid' }), null);
  assert.equal(getActionDestination({ ...bpf, destination_path: '/admin/bpf#bpf-activity-external-other' }), null);
});

test('les montants cockpit excluent test et indéterminé et respectent les filtres de la vue', async () => {
  const filters = [];
  const rows = [
    { transaction_id: 'test', currency: 'eur', gross_training_cents: 18700, estimated_net_stripe_cents: 18700 },
    { transaction_id: 'live', currency: 'eur', gross_training_cents: 935, successful_refund_cents: 935, estimated_net_stripe_cents: 0 },
    { transaction_id: 'unknown', currency: 'eur', gross_training_cents: 50000 },
  ];
  const client = {
    rpc: async (name) => ({ data: name === 'admin_list_course_cohorts' ? [] : { stripe_financial_by_currency: [{ currency: 'eur', estimated_net_stripe_cents: 18700 }] }, error: null }),
    from(source) {
      const data = source === 'admin_stripe_financial_summary' ? rows : source === 'stripe_payment_transactions' ? [
        { id: 'test', stripe_checkout_session_id: 'cs_test_fixture' },
        { id: 'live', last_event: { livemode: true } },
      ] : [];
      const query = {
        select() { return query; }, order() { return query; }, neq() { return query; }, in() { return query; },
        range() { return query; },
        gte(...args) { filters.push([source, 'gte', ...args]); return query; },
        lte(...args) { filters.push([source, 'lte', ...args]); return query; },
        eq(...args) { filters.push([source, 'eq', ...args]); return query; },
        then(resolve) { return Promise.resolve({ data, count: data.length, error: null }).then(resolve); },
      };
      return query;
    },
  };
  const result = await fetchCockpitSummary(client, { dateFrom: '2026-01-01', dateTo: '2026-09-30', courseId: 'formation-ia' });
  assert.equal(result.stripe_financial_by_currency[0].gross_training_cents, 935);
  assert.equal(result.stripe_financial_by_currency[0].estimated_net_stripe_cents, 0);
  assert.deepEqual(result.stripe_financial_exclusions, { test: 1, unknown: 1 });
  assert.deepEqual(filters.filter(([source]) => source === 'admin_stripe_financial_summary'), [
    ['admin_stripe_financial_summary', 'gte', 'occurred_on', '2026-01-01'],
    ['admin_stripe_financial_summary', 'lte', 'occurred_on', '2026-09-30'],
    ['admin_stripe_financial_summary', 'eq', 'course_id', 'formation-ia'],
  ]);
});
