import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQualityOverview, createComplaint, createQualityAction, createQualityRecord, createQualityRisk,
  updateComplaint, updateQualityAction, updateQualityRecord, updateQualityRisk,
} from './qualityAdministration.js';

test('les réclamations client non accusées et en retard passent avant les actions internes', () => {
  const overview = buildQualityOverview({
    records: [
      { id: 'complaint-1', severity: 'medium', title: 'Client sans réponse' },
      { id: 'complaint-2', severity: 'critical', title: 'Déjà accusée' },
    ],
    complaints: [
      { quality_record_id: 'complaint-2', outcome: 'pending', acknowledged_at: '2026-08-20T10:00:00Z', response_due_at: '2026-08-21T10:00:00Z', received_at: '2026-08-20T10:00:00Z' },
      { quality_record_id: 'complaint-1', outcome: 'pending', acknowledged_at: null, received_at: '2026-08-22T10:00:00Z' },
    ],
    actions: [{ id: 'action-1', quality_record_id: 'complaint-1', status: 'planned', due_at: '2026-08-20T10:00:00Z' }],
    risks: [],
  }, new Date('2026-08-22T12:00:00Z'));
  assert.deepEqual(overview.openComplaints.map((item) => item.quality_record_id), ['complaint-1', 'complaint-2']);
  assert.equal(overview.openComplaints[0].associatedActions.length, 1);
  assert.equal(overview.overdueActions.length, 1);
});

test('la création d’une réclamation utilise les deux RPC audités sans écriture directe', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => {
    calls.push([name, params]);
    return { data: name === 'admin_create_quality_record' ? { id: 'record-1' } : { quality_record_id: 'record-1' }, error: null };
  } };
  await createComplaint(client, { title: 'Retard de réponse', description: 'Description factuelle suffisante', severity: 'high', ownerUserId: 'admin-1', reason: 'Motif administratif suffisant', receivedAt: '2026-08-22T10:00:00Z', channel: 'email', complainantType: 'learner' });
  assert.deepEqual(calls.map(([name]) => name), ['admin_create_quality_record', 'admin_create_quality_complaint']);
  assert.equal(calls[0][1].p_record_type, 'complaint');
  assert.equal(calls[1][1].p_quality_record_id, 'record-1');
  assert.equal('from' in client, false);
});

test('les mises à jour de réclamation restent dans le RPC dédié', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: {}, error: null }; } };
  await updateComplaint(client, { qualityRecordId: 'record-1', reason: 'Réponse finale communiquée au client', outcome: 'substantiated', acknowledgedAt: '2026-08-22T10:00:00Z', finalResponseAt: '2026-08-22T11:00:00Z', resolutionSummary: 'Correction réalisée et réponse envoyée.' });
  assert.equal(calls[0][0], 'admin_update_quality_complaint');
  assert.equal(calls[0][1].p_outcome, 'substantiated');
});

test('les actions et risques utilisent exclusivement les RPC du contrat', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: {}, error: null }; } };
  await createQualityAction(client, { qualityRecordId: 'r1', actionType: 'corrective', title: 'Corriger', description: 'Description suffisante', priority: 'high', responsibleUserId: 'a1', reason: 'Motif suffisant' });
  await updateQualityAction(client, { actionId: 'a1', status: 'completed', completionEvidence: 'Preuve documentaire', reason: 'Action vérifiée' });
  await createQualityRisk(client, { qualityRecordId: 'r1', title: 'Risque', description: 'Description suffisante', likelihood: '4', impact: '5', strategy: 'mitigate', ownerUserId: 'a1', reason: 'Motif suffisant' });
  await updateQualityRisk(client, { riskId: 'risk1', status: 'assessed', likelihood: '2', impact: '3', reason: 'Revue documentée' });
  assert.deepEqual(calls.map(([name]) => name), ['admin_create_quality_action', 'admin_update_quality_action', 'admin_create_quality_risk', 'admin_update_quality_risk']);
  assert.equal(calls[2][1].p_likelihood, 4);
  assert.ok(calls.every(([, params]) => !Object.keys(params).some((key) => key.includes('course_access'))));
});

test('les constats génériques sont créés et clôturés via les RPC audités', async () => {
  const calls = [];
  const client = { rpc: async (name, params) => { calls.push([name, params]); return { data: {}, error: null }; } };
  await createQualityRecord(client, { recordType: 'finding', sourceType: 'quality_review', title: 'Constat', description: 'Description factuelle suffisante', severity: 'medium', ownerUserId: 'admin-1', reason: 'Création documentée' });
  await updateQualityRecord(client, { recordId: 'record-1', status: 'closed', reason: 'Clôture après vérification complète' });
  assert.deepEqual(calls.map(([name]) => name), ['admin_create_quality_record', 'admin_update_quality_record']);
  assert.equal(calls[1][1].p_status, 'closed');
});
