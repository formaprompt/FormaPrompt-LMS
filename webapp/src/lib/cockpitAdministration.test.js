import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCockpitSummary,
  getActionDestination,
  prioritizeCockpitActions,
} from './cockpitAdministration.js';

test('la priorité fonctionnelle place le client avant la qualité et la technique', () => {
  const actions = prioritizeCockpitActions([
    { item_id: 'stripe', domain: 'stripe', item_type: 'orphan_transaction', severity: 'high', age_seconds: 500 },
    { item_id: 'quality', domain: 'quality', item_type: 'quality_action', severity: 'high', age_seconds: 500 },
    { item_id: 'client', domain: 'quality', item_type: 'complaint', severity: 'medium', age_seconds: 10 },
  ], new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['client', 'quality', 'stripe']);
});

test('une alerte critique remonte immédiatement et les retards départagent un même groupe', () => {
  const actions = prioritizeCockpitActions([
    { item_id: 'future', domain: 'commercial', item_type: 'commercial_follow_up', severity: 'medium', due_at: '2026-08-23T10:00:00Z' },
    { item_id: 'overdue', domain: 'commercial', item_type: 'commercial_follow_up', severity: 'medium', due_at: '2026-08-21T10:00:00Z' },
    { item_id: 'critical', domain: 'stripe', item_type: 'amount_mismatch', severity: 'critical' },
  ], new Date('2026-08-22T12:00:00Z'));

  assert.deepEqual(actions.map((action) => action.item_id), ['critical', 'overdue', 'future']);
});

test('le chargement utilise uniquement le RPC de lecture du contrat Lot 1', async () => {
  const calls = [];
  const client = {
    rpc: async (name, parameters) => {
      calls.push([name, parameters]);
      return { data: { kpis: {}, priority_actions: [] }, error: null };
    },
  };

  await fetchCockpitSummary(client, {
    dateFrom: '2026-01-01',
    dateTo: '2026-08-22',
    courseId: 'formation-ia',
  });

  assert.deepEqual(calls, [[
    'admin_get_cockpit_summary',
    { p_date_from: '2026-01-01', p_date_to: '2026-08-22', p_course_id: 'formation-ia' },
  ]]);
  assert.equal('from' in client, false, 'aucune mutation ou lecture directe de course_access');
});

test('les destinations sont limitées aux écrans administratifs existants', () => {
  assert.equal(getActionDestination({ destination_path: '/admin/commercial' }), '/admin/commercial');
  assert.equal(getActionDestination({ destination_path: '/admin/qualite' }), null);
  assert.equal(getActionDestination({ destination_path: 'https://example.invalid' }), null);
});
