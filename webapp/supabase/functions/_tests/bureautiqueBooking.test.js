import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUREAUTIQUE_BOOKING_COURSES,
  BUREAUTIQUE_INDIVIDUAL_COURSE_IDS,
  BUREAUTIQUE_INTER_COURSE_IDS,
  BUREAUTIQUE_SCHEDULE_FORMATS,
  getBureautiqueBookingCourse,
} from '../_shared/bureautiqueBooking.js';

const migration = readFileSync(new URL('../../migrations/20260913121500_add_bureautique_booking_cohorts.sql', import.meta.url), 'utf8');
const giftMigration = readFileSync(new URL('../../migrations/20260913124811_enable_bureautique_gifts.sql', import.meta.url), 'utf8');
const individualEdge = readFileSync(new URL('../create-course-booking/index.ts', import.meta.url), 'utf8');
const learnerEdge = readFileSync(new URL('../join-course-cohort/index.ts', import.meta.url), 'utf8');
const adminEdge = readFileSync(new URL('../manage-course-cohorts/index.ts', import.meta.url), 'utf8');

test('le catalogue ferme douze droits commerciaux et deux formats totalisant 840 minutes', () => {
  assert.equal(Object.keys(BUREAUTIQUE_BOOKING_COURSES).length, 12);
  assert.equal(BUREAUTIQUE_INTER_COURSE_IDS.length, 6);
  assert.equal(BUREAUTIQUE_INDIVIDUAL_COURSE_IDS.length, 6);
  assert.deepEqual(Object.keys(BUREAUTIQUE_SCHEDULE_FORMATS), ['four_half_days_3h30', 'two_days_2x3h30']);
  for (const format of Object.values(BUREAUTIQUE_SCHEDULE_FORMATS)) {
    assert.equal(format.sessionMinutes, 210);
    assert.equal(format.totalMinutes, 840);
  }
  assert.equal(getBureautiqueBookingCourse('word-initiation'), null);
  assert.equal(getBureautiqueBookingCourse('word-initiation-intra'), null);
  assert.equal(getBureautiqueBookingCourse('word-initiation-inter').bookingKind, 'cohort');
  assert.equal(getBureautiqueBookingCourse('word-initiation-individuel').bookingKind, 'individual');
});

test('l individuel exige 28 identifiants uniques et délègue à la RPC bureautique', () => {
  assert.match(individualEdge, /BUREAUTIQUE_INDIVIDUAL_COURSE_IDS\.map\(\(courseId\) => \[courseId, 28\]\)/);
  assert.match(individualEdge, /new Set\(body\.slot_ids\)\.size !== expectedSlotCount/);
  assert.match(individualEdge, /create_bureautique_booking_request/);
  assert.match(migration, /cardinality\(p_slot_ids\) <> 28/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /expires_at IS NULL OR expires_at > now\(\)/);
  assert.match(migration, /previous_end = starts_at/);
});

test('la dernière place et chaque créneau sont protégés transactionnellement', () => {
  assert.match(migration, /FROM public\.course_cohorts WHERE id = p_cohort_id FOR UPDATE/);
  assert.match(migration, /IF v_count >= v_cohort\.capacity/);
  assert.match(migration, /course_cohort_enrollments_active_course_idx/);
  assert.match(migration, /UNIQUE \(availability_slot_id\)/);
  assert.match(migration, /training_availability_slots_reserved_no_overlap[\s\S]*EXCLUDE USING gist[\s\S]*tstzrange\(starts_at, ends_at, '\[\)'\) WITH &&[\s\S]*WHERE \(is_reserved\)/);
  assert.match(migration, /ORDER BY candidate\.id FOR UPDATE/);
  assert.match(migration, /candidate\.starts_at < selected\.ends_at/);
  assert.match(migration, /occupied\.is_reserved[\s\S]*occupied\.starts_at < selected\.ends_at/);
  assert.match(migration, /Un autre créneau chevauchant est déjà réservé\.' USING ERRCODE = '23P01'/);
});

test('le catalogue apprenant ne renvoie aucun participant ni lien de réunion', () => {
  const listFunction = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.list_available_course_cohorts'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.join_course_cohort'),
  );
  const returnedShape = listFunction.slice(
    listFunction.indexOf('RETURNS TABLE'),
    listFunction.indexOf(') LANGUAGE plpgsql'),
  );
  const publicSessionShape = listFunction.slice(
    listFunction.indexOf("jsonb_build_object("),
    listFunction.indexOf(") ORDER BY s.position"),
  );
  assert.doesNotMatch(returnedShape, /meeting_url|user_id|purchase_id|course_access_id/);
  assert.doesNotMatch(publicSessionShape, /meeting_url|user_id|purchase_id|course_access_id/);
  assert.match(listFunction, /status IN \('published', 'confirmed'\)/);
  assert.match(migration, /get_my_course_cohort_enrollment[\s\S]*'meeting_url', s\.meeting_url/);
  assert.match(migration, /get_my_course_cohort_enrollment[\s\S]*access\.id = e\.course_access_id[\s\S]*access\.status = 'active'/);
});

test('les Edge cohortes authentifient puis n acceptent que des identifiants bornés', () => {
  for (const source of [learnerEdge, adminEdge]) {
    assert.match(source, /auth\.getUser\(token\)/);
    assert.match(source, /Méthode non autorisée/);
    assert.doesNotMatch(source, /STRIPE|SMTP|sendEmail|checkout\.sessions/);
  }
  assert.doesNotMatch(learnerEdge, /GOOGLE|meeting_url/);
  assert.match(adminEdge, /GOOGLE_CALENDAR_CLIENT_ID/);
  assert.doesNotMatch(adminEdge, /attendees|sendUpdates=all/);
  assert.match(learnerEdge, /body\.cohort_id/);
  assert.doesNotMatch(learnerEdge, /capacity.*body|slot_ids.*body/);
  assert.match(adminEdge, /BUREAUTIQUE_INTER_COURSE_IDS/);
  assert.match(adminEdge, /record\.code === '23P01'.*Un autre créneau chevauchant est déjà réservé\./s);
  assert.match(individualEdge, /error\.code === '23P01'.*Un autre créneau chevauchant est déjà réservé\./s);
});

test('annuler une cohorte demande une raison, libère ses créneaux et ne rembourse rien automatiquement', () => {
  assert.match(migration, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) NOT BETWEEN 10 AND 500/);
  assert.match(migration, /status = 'cohort_cancelled_refund_review'/);
  assert.match(migration, /UPDATE public\.training_availability_slots SET is_reserved = false/);
  assert.match(migration, /DELETE FROM public\.course_cohort_session_slots AS links/);
  assert.doesNotMatch(migration, /stripe_refunds|refund\.create|payment_intents|checkout\.sessions/);
});

test('une annulation apprenant libère la place sans toucher au paiement ni au droit', () => {
  const cancellation = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.cancel_my_course_cohort_enrollment'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.get_my_course_cohort_enrollment'),
  );
  assert.match(cancellation, /enrollments\.user_id = v_user/);
  assert.match(cancellation, /now\(\) < \(SELECT min\(sessions\.starts_at\)/);
  assert.match(cancellation, /SET status = 'cancelled'/);
  assert.doesNotMatch(cancellation, /UPDATE public\.(purchases|course_access)|stripe_refunds/);
  assert.match(learnerEdge, /cancel_my_course_cohort_enrollment/);
});

test('un remboursement partiel conserve la réservation si le droit exact reste actif', () => {
  assert.match(migration, /p\.payment_status IN \('paid', 'partially_refunded'\)/);
});

test('un cadeau inter exact est réservable sans achat fictif et les autres provenances restent refusées', () => {
  assert.match(giftMigration, /ALTER COLUMN purchase_id DROP NOT NULL/);
  assert.match(giftMigration, /coalesce\(v_access\.access_source = 'gift' AND v_access\.purchase_id IS NULL, false\)/);
  assert.match(giftMigration, /v_access\.purchase_id IS NOT NULL AND EXISTS/);
  assert.match(giftMigration, /purchases\.payment_status IN \('paid', 'partially_refunded'\)/);
  assert.match(giftMigration, /access\.course_id = v_cohort\.course_id AND access\.status = 'active'/);
  assert.match(giftMigration, /access\.expires_at IS NULL OR access\.expires_at > now\(\)/);
  assert.doesNotMatch(giftMigration, /v_access\.access_source IN \([^)]*'admin'|v_access\.access_source IN \([^)]*'manual'/);
  assert.doesNotMatch(giftMigration, /INSERT INTO public\.purchases|UPDATE public\.purchases/);
});

test('le lien de réunion est borné côté serveur et reste absent du catalogue public', () => {
  assert.match(migration, /admin_set_course_cohort_meeting_url/);
  assert.match(migration, /cohorts\.delivery_mode = 'remote'/);
  assert.match(migration, /btrim\(p_meeting_url\) !~ '\^https:\/\/'/);
  assert.match(adminEdge, /set_meeting_url/);
});

test('la liste admin restitue les créneaux techniques nécessaires pour modifier un brouillon', () => {
  const adminList = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_list_course_cohorts'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.list_available_course_cohorts'),
  );
  assert.match(adminList, /'slot_ids',[\s\S]*course_cohort_session_slots AS links/);
  assert.match(adminList, /links\.cohort_session_id = s\.id/);
});
