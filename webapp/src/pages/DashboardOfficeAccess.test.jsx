import { expect, it } from 'vitest';
import { BUREAUTIQUE_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';
import { OFFICE_SUPPORTS, bureautiqueResourceRoute, officeResourceRoute } from '../lib/officeAccessRoutes';
import { isCourseAccessOpen } from '../lib/courseAccessLifecycle';

const OFFICE_ALIASES = [
  'word-initiation-inter',
  'word-initiation-individuel',
  'word-perfectionnement-inter',
  'word-perfectionnement-individuel',
  'powerpoint-initiation-inter',
  'powerpoint-initiation-individuel',
];

it('dirige chacun des six droits commerciaux Office vers ses supports privés', () => {
  for (const courseId of OFFICE_ALIASES) {
    expect(OFFICE_SUPPORTS).toHaveProperty(courseId);
    expect(officeResourceRoute(courseId)).toBe(`/course/office-supports/${courseId}`);
  }
});

it('ne confond pas un alias Office inconnu avec une offre reconnue', () => {
  expect(OFFICE_SUPPORTS).not.toHaveProperty('powerpoint-perfectionnement-inter');
  expect(officeResourceRoute('powerpoint-perfectionnement-inter')).toBeNull();
});

it('dirige les douze droits bureautiques actifs, y compris un don sans achat, vers leurs supports protégés', () => {
  const giftedExcelAccess = {
    course_id: 'excel-initiation-inter',
    status: 'active',
    expires_at: null,
    access_source: 'gift',
    purchase_id: null,
  };

  expect(isCourseAccessOpen(giftedExcelAccess)).toBe(true);
  for (const [courseId, offer] of Object.entries(BUREAUTIQUE_PURCHASES)) {
    expect(bureautiqueResourceRoute(courseId)).toBe(offer.resourcePath);
  }
});

it.each([
  { status: 'revoked', expires_at: null },
  { status: 'suspended', expires_at: null },
  { status: 'active', expires_at: '2026-09-13T12:00:00.000Z' },
])('ne rend pas un droit fermé utilisable (%o)', (access) => {
  expect(isCourseAccessOpen(access, new Date('2026-09-14T12:00:00.000Z'))).toBe(false);
});
