import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeDiagnosticBooking,
  correctDiagnosticRestitution,
  createEmptyRestitutionContent,
  fetchClientDiagnostics,
  fetchDiagnosticAdministration,
  fetchPublishedDiagnosticRestitution,
  filterDiagnostics,
  getClientDiagnosticState,
  isRevisionConflict,
  MATURITY_LEVELS,
  publishDiagnosticRestitution,
  saveDiagnosticRestitution,
  validateRestitutionContent,
} from './diagnosticRestitution.js';

test('centralise les cinq niveaux d’avancement IA avec leurs descriptions métier', () => {
  assert.deepEqual(MATURITY_LEVELS.map(({ value, label }) => [value, label]), [
    [1, 'Découverte'],
    [2, 'Premiers essais'],
    [3, 'Usages structurés'],
    [4, 'Intégration métier'],
    [5, 'Optimisation'],
  ]);
  assert.equal(MATURITY_LEVELS.every((level) => level.description.length > 40), true);
  assert.equal(new Set(MATURITY_LEVELS.map((level) => level.description)).size, 5);
});

function query(data, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    maybeSingle: async () => ({ data, error }),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return chain;
}

function validContent() {
  return {
    ...createEmptyRestitutionContent(),
    overall_summary: 'Synthèse suffisamment détaillée pour présenter les constats utiles et les priorités réalistes.',
    observed_maturity_level: 2,
    maturity_assessment: 'L’organisation expérimente déjà avec une méthode encore peu formalisée.',
    current_uses: 'Synthèses et préparation de documents.',
    strengths: ['Bonne connaissance métier'],
    watch_points: ['Données confidentielles'],
    priority_opportunities: [{
      title: 'Comptes rendus', expected_benefit: 'Gagner du temps', effort: 'Faible',
      indicative_cost: 'Limité', risk_or_watchpoint: 'Anonymiser', first_action: 'Tester sur un exemple fictif',
    }],
    recommendations: ['Formaliser une charte'],
    short_term_actions: [{ action: 'Créer un modèle de compte rendu', horizon: '30_days' }],
    recommended_tool_families: ['Assistant conversationnel'],
    privacy_rgpd_considerations: 'Minimiser les données et vérifier les garanties contractuelles.',
    ai_act_considerations: 'Maintenir une supervision humaine adaptée.',
    next_steps: 'Tester le premier usage puis mesurer le résultat.',
  };
}

test('charge et relie bookings, commandes, questionnaires et restitutions sous RLS', async () => {
  const tables = {
    diagnostic_ia_bookings: [{ id: 'booking-1', order_id: 'order-1', status: 'completed' }],
    diagnostic_ia_orders: [{ id: 'order-1', customer_email: 'client@example.test', status: 'paid' }],
    diagnostic_ia_preparation_questionnaires: [{ id: 'questionnaire-1', booking_id: 'booking-1', first_name: 'Test', last_name: 'E2E' }],
    diagnostic_ia_restitutions: [{ id: 'restitution-1', booking_id: 'booking-1', status: 'draft', revision: 1 }],
  };
  const calls = [];
  const client = { from: (table) => { calls.push(table); return query(tables[table]); } };
  const rows = await fetchDiagnosticAdministration(client);
  assert.deepEqual(calls, Object.keys(tables));
  assert.equal(rows[0].clientName, 'Test E2E');
  assert.equal(rows[0].order.id, 'order-1');
  assert.equal(rows[0].questionnaire.id, 'questionnaire-1');
  assert.equal(rows[0].restitution.id, 'restitution-1');
});

test('applique les cinq filtres métier sans mélanger les formations', () => {
  const rows = [
    { id: 'booked', status: 'booked', restitution: null },
    { id: 'to-write', status: 'completed', restitution: null },
    { id: 'draft', status: 'completed', restitution: { status: 'draft' } },
    { id: 'published', status: 'completed', restitution: { status: 'published' } },
  ];
  assert.equal(filterDiagnostics(rows, 'all').length, 4);
  assert.deepEqual(filterDiagnostics(rows, 'to_complete').map(({ id }) => id), ['booked']);
  assert.deepEqual(filterDiagnostics(rows, 'to_write').map(({ id }) => id), ['to-write']);
  assert.deepEqual(filterDiagnostics(rows, 'draft').map(({ id }) => id), ['draft']);
  assert.deepEqual(filterDiagnostics(rows, 'published').map(({ id }) => id), ['published']);
});

test('aligne la validation locale sur les bornes et le minimum de publication 1E-A', () => {
  assert.equal(validateRestitutionContent(createEmptyRestitutionContent()).valid, true);
  assert.equal(validateRestitutionContent(createEmptyRestitutionContent(), { forPublication: true }).valid, false);
  assert.equal(validateRestitutionContent(validContent(), { forPublication: true }).valid, true);
  const tooMany = validContent();
  tooMany.priority_opportunities = Array.from({ length: 4 }, () => ({
    title: '', expected_benefit: '', effort: '', indicative_cost: '', risk_or_watchpoint: '', first_action: '',
  }));
  assert.equal(validateRestitutionContent(tooMany).valid, false);
  const html = validContent();
  html.overall_summary = '<script>contenu interdit</script>';
  assert.equal(validateRestitutionContent(html).valid, false);
});

test('appelle uniquement les quatre RPC 1E-A avec révision attendue et sans Calendar ou Meet', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: { id: name }, error: null }; } };
  const content = validContent();
  await completeDiagnosticBooking(client, 'booking-1');
  await saveDiagnosticRestitution(client, 'booking-1', 0, content);
  await publishDiagnosticRestitution(client, 'restitution-1', 1);
  await correctDiagnosticRestitution(client, 'restitution-1', 1, content, '  Correction métier  ');
  assert.deepEqual(calls.map(([name]) => name), [
    'admin_complete_diagnostic_ia_booking',
    'admin_save_diagnostic_ia_restitution',
    'admin_publish_diagnostic_ia_restitution',
    'admin_correct_diagnostic_ia_restitution',
  ]);
  assert.deepEqual(calls[0][1], { p_booking_id: 'booking-1', p_completed_at: null });
  assert.equal(calls[1][1].p_expected_revision, 0);
  assert.equal(calls[2][1].p_expected_revision, 1);
  assert.equal(calls[3][1].p_reason, 'Correction métier');
  assert.equal(JSON.stringify(calls).includes('google'), false);
});

test('préserve le code 40001 pour empêcher tout écrasement silencieux', async () => {
  const client = { rpc: async () => ({ data: null, error: { code: '40001', message: 'Conflit de révision' } }) };
  await assert.rejects(
    () => saveDiagnosticRestitution(client, 'booking-1', 1, validContent()),
    (error) => error.code === '40001' && isRevisionConflict(error),
  );
  assert.equal(isRevisionConflict(new Error('Conflit de révision lors de la publication.')), true);
});

test('charge les Diagnostics du client uniquement depuis les quatre tables Diagnostic sous RLS', async () => {
  const tables = {
    diagnostic_ia_orders: [
      { id: 'order-paid', user_id: 'user-1', status: 'paid' },
      { id: 'order-pending', user_id: 'user-1', status: 'payment_pending' },
    ],
    diagnostic_ia_bookings: [{ id: 'booking-1', order_id: 'order-paid', user_id: 'user-1', status: 'completed' }],
    diagnostic_ia_preparation_questionnaires: [{ id: 'questionnaire-1', booking_id: 'booking-1', user_id: 'user-1' }],
    diagnostic_ia_restitutions: [{ id: 'restitution-1', booking_id: 'booking-1', user_id: 'user-1', status: 'published' }],
  };
  const calls = [];
  const client = { from: (table) => { calls.push(table); return query(tables[table]); } };
  const diagnostics = await fetchClientDiagnostics(client, 'user-1');
  assert.deepEqual(calls, Object.keys(tables));
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].order.id, 'order-paid');
  assert.equal(diagnostics[0].booking.id, 'booking-1');
  assert.equal(diagnostics[0].questionnaire.id, 'questionnaire-1');
  assert.equal(diagnostics[0].restitution.id, 'restitution-1');
});

test('détermine les états client sans utiliser purchases ni course_access', () => {
  const paidOrder = { id: 'order-1', status: 'paid' };
  assert.equal(getClientDiagnosticState({ order: paidOrder, booking: null, questionnaire: null, restitution: null }).action, 'book');
  assert.equal(getClientDiagnosticState({ order: paidOrder, booking: { status: 'booked' }, questionnaire: null, restitution: null }).action, 'questionnaire');
  assert.equal(getClientDiagnosticState({ order: paidOrder, booking: { status: 'booked' }, questionnaire: {}, restitution: null }).id, 'scheduled');
  assert.equal(getClientDiagnosticState({ order: paidOrder, booking: { status: 'completed' }, questionnaire: {}, restitution: null }).id, 'preparing');
  assert.equal(getClientDiagnosticState({ order: paidOrder, booking: { status: 'completed' }, questionnaire: {}, restitution: { status: 'published' } }).action, 'restitution');
});

test('une restitution invisible sous RLS retourne null sans charger le booking', async () => {
  const calls = [];
  const client = { from: (table) => { calls.push(table); return query(null); } };
  const result = await fetchPublishedDiagnosticRestitution(client, '82000000-0000-4000-8000-000000000001');
  assert.equal(result, null);
  assert.deepEqual(calls, ['diagnostic_ia_restitutions']);
});

test('charge le rendez-vous seulement après obtention de la restitution publiée', async () => {
  const calls = [];
  const client = { from: (table) => {
    calls.push(table);
    return query(table === 'diagnostic_ia_restitutions'
      ? { id: 'restitution-1', booking_id: '82000000-0000-4000-8000-000000000001', status: 'published' }
      : { id: '82000000-0000-4000-8000-000000000001', starts_at: '2026-09-10T08:00:00Z' });
  } };
  const result = await fetchPublishedDiagnosticRestitution(client, '82000000-0000-4000-8000-000000000001');
  assert.deepEqual(calls, ['diagnostic_ia_restitutions', 'diagnostic_ia_bookings']);
  assert.equal(result.booking.starts_at, '2026-09-10T08:00:00Z');
});
