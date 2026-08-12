import { expect, test } from '@playwright/test';

const LEARNER_ID = '41000000-0000-0000-0000-000000000001';

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'authenticated',
    sub: LEARNER_ID,
  })}.test-signature`;
}

test('bloque le parcours révoqué puis retrouve la progression après restauration', async ({ page }) => {
  const access = {
    id: 'access-prompt-level-one',
    user_id: LEARNER_ID,
    course_id: 'formation-prompt-level-1',
    status: 'active',
    access_source: 'admin',
    granted_at: '2026-08-10T10:00:00Z',
    expires_at: null,
    status_changed_at: '2026-08-10T10:00:00Z',
    suspension_ends_at: null,
  };
  const progressRows = [{
    user_id: LEARNER_ID,
    course_id: 'introduction-prompt-engineering',
    lesson_id: 'definir-un-role',
    status: 'in_progress',
    progress_percent: 0,
    last_viewed_at: '2026-08-10T11:00:00Z',
    completed_at: null,
  }];
  let writes = 0;

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: LEARNER_ID, email: 'learner.path@example.test', role: 'authenticated' }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resource = url.pathname.split('/').pop();

    if (resource === 'profiles') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role: 'user' }) });
      return;
    }

    if (resource === 'course_access') {
      const expectsSingleObject = request.headers().accept?.includes('application/vnd.pgrst.object+json');
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(expectsSingleObject ? access : [access]),
      });
      return;
    }

    if (resource === 'course_lesson_progress') {
      if (request.method() === 'POST') {
        writes += 1;
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      } else {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(progressRows) });
      }
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
      refresh_token: 'local-learning-path-test',
      token_type: 'bearer',
      user: { id: learnerId, email: 'learner.path@example.test', role: 'authenticated' },
    }));
  }, { accessToken: token, learnerId: LEARNER_ID });

  await page.goto('/parcours/introduction-prompt-engineering');
  await expect(page.getByRole('heading', { level: 2, name: 'Définir un rôle' })).toBeVisible();
  await expect.poll(() => writes).toBeGreaterThan(0);

  access.status = 'revoked';
  const writesBeforeRevocation = writes;
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Introduction au Prompt Engineering' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('plus disponible');
  await page.waitForTimeout(150);
  expect(writes).toBe(writesBeforeRevocation);

  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Commencer ou reprendre' })).toHaveCount(0);

  access.status = 'active';
  await page.reload();
  await expect(page.getByRole('link', { name: 'Commencer ou reprendre' })).toBeVisible();
  await page.getByRole('link', { name: 'Commencer ou reprendre' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Définir un rôle' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
