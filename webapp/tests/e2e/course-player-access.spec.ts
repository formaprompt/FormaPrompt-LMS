import { expect, test } from '@playwright/test';
import { courseCatalog } from '../../supabase/functions/_shared/paidCourseCatalog.js';

const LEARNER_ID = '61000000-0000-0000-0000-000000000001';

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'authenticated',
    sub: LEARNER_ID,
  })}.test-signature`;
}

test('CoursePlayer échoue fermé sans fallback purchases puis retrouve un accès restauré', async ({ page }) => {
  const access = {
    id: 'access-course-player',
    user_id: LEARNER_ID,
    course_id: 'formation-prompt-level-1',
    status: 'active',
    access_source: 'admin',
    granted_at: '2026-08-10T10:00:00Z',
    expires_at: null,
  };
  let accessReadFails = false;
  let purchasesRequests = 0;

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: LEARNER_ID, email: 'learner.course@example.test', role: 'authenticated' }),
    });
  });

  await page.route('**/functions/v1/paid-course-content', async (route) => {
    if (accessReadFails) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Impossible de vérifier votre accès à la formation.' }),
      });
      return;
    }
    if (access.status !== 'active') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Accès à la formation refusé.' }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ course: courseCatalog['formation-prompt-level-1'] }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split('/').pop();

    if (resource === 'profiles') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role: 'user' }) });
      return;
    }
    if (resource === 'purchases') {
      purchasesRequests += 1;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'purchase-without-right' }]) });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  const token = fakeJwt();
  await page.addInitScript(({ accessToken, learnerId }) => {
    localStorage.setItem('sb-crxodkbcukhjdejlcfpg-auth-token', JSON.stringify({
      access_token: accessToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      refresh_token: 'local-course-player-test',
      token_type: 'bearer',
      user: { id: learnerId, email: 'learner.course@example.test', role: 'authenticated' },
    }));
  }, { accessToken: token, learnerId: LEARNER_ID });

  await page.goto('/course/formation-prompt-level-1');
  await expect(page.getByRole('heading', { name: 'Quiz de positionnement' })).toBeVisible();
  expect(purchasesRequests).toBe(0);

  access.status = 'revoked';
  await page.goto('/course/formation-prompt-level-1');
  await expect(page).toHaveURL(/\/formation-prompt-engineering$/);
  expect(purchasesRequests).toBe(0);

  accessReadFails = true;
  await page.goto('/course/formation-prompt-level-1');
  await expect(page.getByRole('alert')).toContainText('Impossible de vérifier votre accès');
  expect(purchasesRequests).toBe(0);

  accessReadFails = false;
  access.status = 'active';
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quiz de positionnement' })).toBeVisible();
  expect(purchasesRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
