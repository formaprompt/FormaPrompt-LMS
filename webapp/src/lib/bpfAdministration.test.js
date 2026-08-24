import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBpfCsv, buildBpfSummary, createExternalActivity, deriveBpfCockpitActions,
  fetchBpfAdministration, filterExternalActivities, findBpfDataIssues,
  updateExternalActivity,
} from './bpfAdministration.js';

function activity(overrides = {}) {
  return {
    source_kind: 'external', activity_id: 'ext-1', title: 'Formation externe',
    activity_relationship: 'direct', starts_on: '2026-03-01', ends_on: '2026-03-02',
    status: 'completed', trainee_count: 3, delivered_hours: 7, trainee_hours: 18,
    invoiced_amount_cents: 100000, collected_amount_cents: 60000, invoice_status: 'partially_paid',
    ...overrides,
  };
}

function formValues(overrides = {}) {
  return {
    title: 'Formation externe', activityRelationship: 'direct', orderingOrganization: '',
    customerCategory: 'company', fundingMode: 'company', deliveryMode: 'remote',
    startsOn: '2026-03-01', endsOn: '2026-03-02', status: 'completed',
    traineeCount: 3, deliveredHours: 7, traineeHours: 18,
    invoicedAmount: 1000, collectedAmount: 600, invoiceReference: 'F-2026-01',
    invoiceStatus: 'partially_paid', administrativeNote: 'Contrôle administratif',
    reason: 'Saisie contrôlée pour la préparation BPF', ...overrides,
  };
}

test('les trois relations réelles du contrat sont transmises aux RPC', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: {}, error: null }; } };
  await createExternalActivity(client, formValues({ activityRelationship: 'direct' }));
  await createExternalActivity(client, formValues({ activityRelationship: 'subcontracted_to_us', orderingOrganization: 'OF partenaire' }));
  await createExternalActivity(client, formValues({ activityRelationship: 'subcontracted_by_us', orderingOrganization: 'OF partenaire' }));
  assert.deepEqual(calls.map(([, params]) => params.p_activity_relationship), ['direct', 'subcontracted_to_us', 'subcontracted_by_us']);
  assert.ok(calls.every(([name]) => name === 'admin_create_external_training_activity'));
});

test('création et modification restent derrière les RPC administratives auditées', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: {}, error: null }; } };
  await createExternalActivity(client, formValues());
  await updateExternalActivity(client, formValues({ activityId: 'ext-1', status: 'cancelled' }));
  assert.deepEqual(calls.map(([name]) => name), ['admin_create_external_training_activity', 'admin_update_external_training_activity']);
  assert.equal(calls[1][1].p_activity_id, 'ext-1');
  assert.equal(calls[1][1].p_status, 'cancelled');
  assert.equal('from' in client, false);
});

test('les montants facturé et encaissé restent distincts en centimes', async () => {
  let params;
  const client = { rpc: async (_name, values) => { params = values; return { data: {}, error: null }; } };
  await createExternalActivity(client, formValues({ invoicedAmount: '1234.56', collectedAmount: '345.67' }));
  assert.equal(params.p_invoiced_amount_cents, 123456);
  assert.equal(params.p_collected_amount_cents, 34567);
});

test('la sous-traitance exige un donneur d’ordre sans collecter de stagiaires nominatifs', async () => {
  const client = { rpc: async () => ({ data: {}, error: null }) };
  assert.throws(() => createExternalActivity(client, formValues({ activityRelationship: 'subcontracted_to_us', orderingOrganization: '' })), /donneur d’ordre/);
  const values = formValues();
  assert.equal(Object.keys(values).some((key) => /name|email|learner/i.test(key)), false);
});

test('la consolidation compte une seule fois chaque source et exclut les activités annulées', () => {
  const rows = [
    activity({ source_kind: 'internal_lms', activity_id: 'int-1', activity_relationship: null, invoiced_amount_cents: null, collected_amount_cents: null }),
    activity({ activity_id: 'ext-1' }),
    activity({ activity_id: 'cancelled', status: 'cancelled' }),
  ];
  const bpfRows = [
    { source_kind: 'internal_lms', activity_id: 'int-1', product_amount_cents: 50000 },
    { source_kind: 'external', activity_id: 'ext-1', product_amount_cents: 100000 },
  ];
  const summary = buildBpfSummary(rows, bpfRows);
  assert.equal(summary.total.activityCount, 2);
  assert.equal(summary.internal.activityCount, 1);
  assert.equal(summary.external.activityCount, 1);
  assert.equal(summary.total.productAmountCents, 150000);
});

test('les heures-stagiaires ne sont jamais recalculées depuis stagiaires × durée', () => {
  const summary = buildBpfSummary([activity({ trainee_count: 3, delivered_hours: 7, trainee_hours: 18 })], []);
  assert.equal(summary.total.trainingHours, 7);
  assert.equal(summary.total.traineeHours, 18);
  assert.notEqual(summary.total.traineeHours, 3 * 7);
});

test('les contrôles signalent doublons et données BPF incomplètes sans faux silence', () => {
  const broken = activity({ trainee_count: 0, delivered_hours: null, trainee_hours: null, invoice_status: 'not_invoiced' });
  const issues = findBpfDataIssues([broken, { ...broken }], []);
  assert.ok(issues.some((issue) => issue.type === 'duplicate'));
  assert.ok(issues.some((issue) => issue.type === 'missing_trainees'));
  assert.ok(issues.some((issue) => issue.type === 'missing_hours'));
  assert.ok(issues.some((issue) => issue.type === 'missing_trainee_hours'));
  assert.ok(issues.some((issue) => issue.type === 'not_invoiced'));
});

test('les alertes BPF du cockpit restent actionnables et orientent vers la page BPF', () => {
  const actions = deriveBpfCockpitActions([activity({ invoice_status: 'not_invoiced' })], new Date('2026-08-24T10:00:00Z'));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].destination_path, '/admin/bpf');
  assert.equal(actions[0].domain, 'bpf');
});

test('l’export CSV contient les lignes consolidées et neutralise les formules', () => {
  const csv = buildBpfCsv([{ source_kind: 'external', activity_id: 'ext-1', title: '=DANGEREUX', trainee_count: 2, training_hours: 7, trainee_hours: 14, product_amount_cents: 10000 }]);
  assert.match(csv, /heures_stagiaires/);
  assert.match(csv, /'=DANGEREUX/);
  assert.match(csv, /ext-1/);
});

test('les filtres recherchent sans dupliquer ni modifier les activités', () => {
  const rows = [activity({ activity_id: 'a', title: 'Excel', activity_relationship: 'direct' }), activity({ activity_id: 'b', title: 'IA Act', activity_relationship: 'subcontracted_to_us' })];
  const filtered = filterExternalActivities(rows, { search: 'ia act', relationship: 'subcontracted_to_us', status: 'completed' });
  assert.deepEqual(filtered.map((row) => row.activity_id), ['b']);
  assert.equal(rows.length, 2);
});

test('le chargement lit uniquement le registre et les trois vues du Lot 1', async () => {
  const sources = [];
  const builderFor = (source) => {
    const builder = { select() { return builder; }, gte() { return builder; }, lte() { return builder; }, order() { return Promise.resolve({ data: [], error: null }); } };
    sources.push(source); return builder;
  };
  await fetchBpfAdministration({ from: builderFor }, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
  assert.deepEqual(sources, ['external_training_activities', 'admin_internal_training_activity', 'admin_training_activity_all_sources', 'admin_bpf_preparation_rows']);
  assert.ok(!sources.includes('purchases') && !sources.includes('course_access') && !sources.includes('training_enrollments'));
});
