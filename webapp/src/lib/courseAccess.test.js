import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCourseAccessUnavailable,
  mapPurchaseToCourseAccess,
} from './courseAccessAvailability.js';

test('reconnaît uniquement une table course_access non encore disponible', () => {
  assert.equal(isCourseAccessUnavailable({ code: 'PGRST205' }), true);
  assert.equal(isCourseAccessUnavailable({ code: '42P01' }), true);
  assert.equal(isCourseAccessUnavailable({ code: '42501' }), false);
  assert.equal(isCourseAccessUnavailable(null), false);
});

test('convertit un achat administratif historique en droit actif temporaire', () => {
  assert.deepEqual(mapPurchaseToCourseAccess({
    id: 'purchase-1',
    user_id: 'user-1',
    course_id: 'formation-ia-act',
    purchased_at: '2026-08-09T10:00:00.000Z',
    payment_status: 'granted_by_admin',
  }), {
    id: 'purchase-1',
    user_id: 'user-1',
    course_id: 'formation-ia-act',
    status: 'active',
    granted_at: '2026-08-09T10:00:00.000Z',
    access_source: 'admin',
    purchase_id: 'purchase-1',
    expires_at: null,
  });
});
