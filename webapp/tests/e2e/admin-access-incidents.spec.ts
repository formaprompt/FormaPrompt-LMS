import { expect, test } from '@playwright/test';

const ADMIN_ID = 'f422b1ae-56a4-4d23-b84b-6c368e5635f0';
const USER_B_ID = '4c9751e3-6e8f-46d6-a77c-623a35f25b2e';
const ACCESS_A_ID = 'access-a-mobile-test';
const ACCESS_B_ID = 'access-b-mobile-test';

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'authenticated',
    sub: ADMIN_ID,
  })}.test-signature`;
}

test('cible le bon apprenant et reste utilisable à 390 px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Contrôle métier réservé au projet mobile 390 px.');

  const profiles = [
    { id: ADMIN_ID, email: 'thierry227@gmail.com', role: 'admin' },
    { id: USER_B_ID, email: 'thierry270363@gmail.com', role: 'user' },
  ];
  const accesses = [
    {
      id: ACCESS_A_ID,
      user_id: ADMIN_ID,
      course_id: 'formation-ia',
      status: 'active',
      access_source: 'admin',
      granted_at: '2026-08-11T13:54:55Z',
      expires_at: null,
      status_changed_at: '2026-08-11T13:54:55Z',
      suspension_ends_at: null,
    },
    {
      id: ACCESS_B_ID,
      user_id: USER_B_ID,
      course_id: 'formation-ia',
      status: 'active',
      access_source: 'admin',
      granted_at: '2026-08-11T13:54:55Z',
      expires_at: null,
      status_changed_at: '2026-08-11T13:54:55Z',
      suspension_ends_at: null,
    },
  ];
  const auditEntries: Array<Record<string, unknown>> = [];

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: ADMIN_ID, email: 'thierry227@gmail.com', role: 'authenticated' }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resource = url.pathname.split('/').pop();

    if (resource === 'admin_change_course_access') {
      const parameters = request.postDataJSON();
      const access = accesses.find(({ id }) => id === parameters.p_access_id);
      const matches = access
        && access.user_id === parameters.p_expected_user_id
        && access.course_id === parameters.p_expected_course_id;
      if (!matches) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Cible incohérente' }) });
        return;
      }

      const previousStatus = access.status;
      access.status = parameters.p_action === 'revoke' ? 'revoked' : 'active';
      access.status_changed_at = '2026-08-11T18:26:41Z';
      auditEntries.unshift({
        id: `audit-${auditEntries.length + 1}`,
        actor_user_id: ADMIN_ID,
        action_type: parameters.p_action === 'restore' ? 'access_restored' : 'access_revoked',
        target_type: 'course_access',
        target_id: access.id,
        target_user_id: access.user_id,
        course_id: access.course_id,
        previous_state: { status: previousStatus },
        new_state: { status: access.status },
        reason: parameters.p_reason,
        metadata: {},
        created_at: '2026-08-11T18:26:41Z',
      });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, access }) });
      return;
    }

    let body: unknown = [];
    if (resource === 'profiles') {
      body = url.searchParams.get('select') === 'role' ? { role: 'admin' } : profiles;
    } else if (resource === 'training_enrollments') {
      body = [{ user_id: USER_B_ID, learner_first_name: 'Thierry', learner_last_name: 'Frezard', updated_at: '2026-08-11T10:00:00Z' }];
    } else if (resource === 'course_positioning_assessments') {
      body = [{ user_id: ADMIN_ID, learner_name: 'Thierry FREZARD', submitted_at: '2026-08-11T09:00:00Z' }];
    } else if (resource === 'course_access') {
      body = accesses;
    } else if (resource === 'audit_log') {
      body = auditEntries;
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });

  const token = fakeJwt();
  await page.addInitScript(({ accessToken, adminId }) => {
    localStorage.setItem('sb-crxodkbcukhjdejlcfpg-auth-token', JSON.stringify({
      access_token: accessToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      refresh_token: 'local-browser-test',
      token_type: 'bearer',
      user: { id: adminId, email: 'thierry227@gmail.com', role: 'authenticated' },
    }));
  }, { accessToken: token, adminId: ADMIN_ID });

  await page.goto('/admin/acces-incidents');
  await expect(page.getByText('thierry270363@gmail.com', { exact: true })).toBeVisible();

  const search = page.getByLabel(/Rechercher un apprenant/i);
  await search.fill('thierry270363@gmail.com');
  await expect(page.getByText('thierry227@gmail.com', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Révoquer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Thierry Frezard');
  await expect(dialog).toContainText('thierry270363@gmail.com');
  await expect(dialog).toContainText('Formation IA générative');
  await expect(dialog).toContainText('Actif');
  await expect(dialog.getByRole('button', { name: /Révoquer l’accès de thierry270363@gmail.com/i })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await dialog.getByLabel('Motif obligatoire').fill('Révocation ciblée du compte B');
  await dialog.getByRole('button', { name: /Révoquer l’accès de thierry270363@gmail.com/i }).click();
  await expect(page.getByText('Révoqué', { exact: true })).toBeVisible();
  expect(accesses.find(({ id }) => id === ACCESS_A_ID)?.status).toBe('active');
  expect(accesses.find(({ id }) => id === ACCESS_B_ID)?.status).toBe('revoked');

  await page.reload();
  await expect(page.getByText('thierry270363@gmail.com', { exact: true })).toBeVisible();
  await search.fill('thierry227@gmail.com');
  await expect(page.getByText('thierry270363@gmail.com', { exact: true })).toHaveCount(0);
  await search.fill('thierry270363@gmail.com');
  await expect(page.getByText('thierry227@gmail.com', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Restaurer l’accès' }).click();
  const restoreDialog = page.getByRole('dialog');
  await restoreDialog.getByLabel('Motif obligatoire').fill('Révocation effectuée par erreur sur le mauvais compte');
  await restoreDialog.getByRole('button', { name: /Restaurer l’accès de thierry270363@gmail.com/i }).click();
  await expect(page.getByText('Actif', { exact: true })).toBeVisible();
  await expect(page.getByText(/Historique sensible \(2\)/)).toBeVisible();
  expect(accesses.find(({ id }) => id === ACCESS_A_ID)?.status).toBe('active');
  expect(accesses.find(({ id }) => id === ACCESS_B_ID)?.status).toBe('active');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
