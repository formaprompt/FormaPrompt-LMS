import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adminBookingResponsePath,
  adminBookingAnchor,
  adminCorrectionAnchor,
  adminCorrectionPath,
  adminWorkTarget,
  exactTargetRows,
  groupProgressByCourse,
  learnerDirectoryPath,
  learnerRecordPath,
} from './adminLearnerRecord.js';

test('construit une route uniquement depuis le user_id fourni', () => {
  assert.equal(learnerRecordPath('00000000-0000-4000-8000-000000000123'), '/admin/apprenants/00000000-0000-4000-8000-000000000123');
  assert.equal(learnerRecordPath('00000000-0000-4000-8000-000000000123', ' Élodie Martin '), '/admin/apprenants/00000000-0000-4000-8000-000000000123?retourRecherche=%C3%89lodie+Martin');
  assert.equal(learnerRecordPath('00000000-0000-4000-8000-000000000123', 'Élodie Martin', 1), '/admin/apprenants/00000000-0000-4000-8000-000000000123?retourRecherche=%C3%89lodie+Martin&retourPage=2');
  assert.equal(learnerDirectoryPath(' Élodie Martin '), '/admin/pedagogique?onglet=users&recherche=%C3%89lodie%20Martin');
  assert.equal(learnerRecordPath(''), null);
});

test('construit des liens profonds exacts vers les traitements existants', () => {
  assert.equal(
    adminCorrectionPath({ kind: 'exercise', submissionId: 42 }),
    '/admin/pedagogique?onglet=corrections&correction=exercise&submissionId=42#exercise-submission-42',
  );
  assert.equal(
    adminCorrectionPath({ kind: 'final_project', submissionId: 84 }),
    '/admin/pedagogique?onglet=corrections&correction=project&submissionId=84#final-project-submission-84',
  );
  assert.equal(
    adminBookingResponsePath('72000000-0000-4000-8000-000000000009'),
    '/admin/pedagogique?onglet=bookings&bookingId=72000000-0000-4000-8000-000000000009#booking-request-72000000-0000-4000-8000-000000000009',
  );
  assert.equal(adminCorrectionAnchor('project', 84), 'final-project-submission-84');
  assert.equal(adminBookingAnchor('booking-9'), 'booking-request-booking-9');
  assert.deepEqual(
    adminWorkTarget(new URLSearchParams('onglet=corrections&correction=project&submissionId=84')),
    { correction: 'project', submissionId: '84', bookingId: null },
  );
  assert.deepEqual(exactTargetRows([{ id: 42 }, { id: 84 }], '84'), [{ id: 84 }]);
  assert.deepEqual(exactTargetRows([{ id: 42 }, { id: 84 }], '999'), []);
  assert.deepEqual(
    adminWorkTarget(new URLSearchParams('onglet=bookings&bookingId=booking-9')),
    { correction: 'exercise', submissionId: null, bookingId: 'booking-9' },
  );
});

test('dirige les liens profonds vers la route réelle de AdminDashboard', () => {
  const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const dashboardRoute = appSource.match(/<Route path="([^"]+)" element={<AdminShell><AdminDashboard/);
  const cockpitRoute = appSource.match(/<Route path="([^"]+)" element={<RequireAuth><AdminCockpit/);

  assert.ok(dashboardRoute, 'la route AdminDashboard doit exister dans App.jsx');
  assert.ok(cockpitRoute, 'la route AdminCockpit doit exister dans App.jsx');
  assert.equal(`/${cockpitRoute[1]}`, '/admin');
  const expectedPathname = `/${dashboardRoute[1]}`;
  assert.notEqual(expectedPathname, `/${cockpitRoute[1]}`);
  assert.equal(new URL(adminCorrectionPath({ kind: 'exercise', submissionId: 42 }), 'http://local').pathname, expectedPathname);
  assert.equal(new URL(adminBookingResponsePath('booking-9'), 'http://local').pathname, expectedPathname);
});

test('agrège la progression sans mélanger les formations', () => {
  const result = groupProgressByCourse([
    { courseId: 'formation-ia', status: 'completed', progressPercent: 100, lastViewedAt: '2026-09-14T10:00:00Z' },
    { courseId: 'formation-ia', status: 'in_progress', progressPercent: 40, lastViewedAt: '2026-09-15T10:00:00Z' },
    { courseId: 'formation-ia-act', status: 'in_progress', progressPercent: 20, lastViewedAt: '2026-09-13T10:00:00Z' },
  ]);
  assert.deepEqual(result, [
    { courseId: 'formation-ia', completed: 1, visited: 2, lastViewedAt: '2026-09-15T10:00:00Z' },
    { courseId: 'formation-ia-act', completed: 0, visited: 1, lastViewedAt: '2026-09-13T10:00:00Z' },
  ]);
});
