import test from 'node:test';
import assert from 'node:assert/strict';
import { isDisciplinaryIncidentOpen } from './disciplinaryIncidentAdministration.js';

test('un incident disciplinaire reste à traiter tant que son état réel n est pas clôturé', () => {
  assert.equal(isDisciplinaryIncidentOpen({ incident_status: 'decision_pending' }), true);
  assert.equal(isDisciplinaryIncidentOpen({ incident_status: 'closed' }), false);
});
