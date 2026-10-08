import { expect, it, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
import { COURSE_OPTIONS } from '../lib/adminEnrollmentCourses';

it('propose les trois formules créativité avec 14 h et leurs tarifs catalogues', () => {
  expect(COURSE_OPTIONS['ia-creativite-groupe']).toMatchObject({ durationMinutes: 840, priceAmountCents: 69000, service: true });
  expect(COURSE_OPTIONS['ia-creativite-individuel']).toMatchObject({ durationMinutes: 840, priceAmountCents: 90000, service: true });
  expect(COURSE_OPTIONS['ia-creativite-ecole-association']).toMatchObject({ durationMinutes: 840, priceAmountCents: 160000, service: true });
});
