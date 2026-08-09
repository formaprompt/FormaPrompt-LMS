import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStripeCourseAccess,
  COURSE_ACCESS_CONFLICT_TARGET,
} from '../_shared/courseAccess.js';

const input = {
  userId: 'b86f9479-e782-4c03-8fe0-e55f4ab67a56',
  courseId: 'formation-ia-act',
  purchaseId: 'b19e9d7f-d0dc-4e8b-b4b2-45f064786a6f',
  grantedAt: '2026-08-09T10:00:00.000Z',
  updatedAt: '2026-08-09T10:00:01.000Z',
};

test('construit un droit Stripe actif lié à la preuve de paiement', () => {
  assert.deepEqual(buildStripeCourseAccess(input), {
    user_id: input.userId,
    course_id: input.courseId,
    status: 'active',
    access_source: 'stripe',
    purchase_id: input.purchaseId,
    granted_at: input.grantedAt,
    expires_at: null,
    updated_at: input.updatedAt,
  });
});

test('conserve la même clé idempotente pour une relivraison Stripe', () => {
  const first = buildStripeCourseAccess(input);
  const retry = buildStripeCourseAccess({ ...input, updatedAt: '2026-08-09T10:01:00.000Z' });

  assert.equal(COURSE_ACCESS_CONFLICT_TARGET, 'user_id,course_id');
  assert.equal(first.user_id, retry.user_id);
  assert.equal(first.course_id, retry.course_id);
  assert.equal(first.purchase_id, retry.purchase_id);
});

test('refuse de créer un droit Stripe sans preuve de paiement', () => {
  assert.throws(
    () => buildStripeCourseAccess({ ...input, purchaseId: '' }),
    /Données insuffisantes/,
  );
});
