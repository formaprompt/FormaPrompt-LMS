import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBookingCandidates,
  createSplitDayBookingCandidates,
  flattenSelectedSlotIds,
  getLastBookedSession,
  groupBookedSessions,
  hasLearnerSignedLastSession,
} from './courseBookingSlots.js';

function slot(id, startHour, endHour, day = '2026-07-20') {
  return {
    id,
    starts_at: `${day}T${String(startHour).padStart(2, '0')}:00:00+02:00`,
    ends_at: `${day}T${String(endHour).padStart(2, '0')}:00:00+02:00`,
    delivery_modes: ['remote', 'in_person'],
  };
}

const daySlots = [
  slot('h09', 9, 10), slot('h10', 10, 11), slot('h11', 11, 12),
  slot('h13', 13, 14), slot('h14', 14, 15), slot('h15', 15, 16), slot('h16', 16, 17),
];

test('compose les séances de deux heures à partir des heures libres', () => {
  const candidates = createBookingCandidates(daySlots, { duration: 120, deliveryMode: 'remote' });
  assert.deepEqual(candidates.map((candidate) => candidate.slotIds), [
    ['h09', 'h10'], ['h10', 'h11'], ['h13', 'h14'], ['h14', 'h15'], ['h15', 'h16'],
  ]);
});

test('ne propose jamais une séance de quatre heures traversant la pause déjeuner', () => {
  const candidates = createBookingCandidates(daySlots, { duration: 240, deliveryMode: 'remote' });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].slotIds, ['h13', 'h14', 'h15', 'h16']);
});

test('transmet toutes les heures qui composent les choix retenus', () => {
  const candidates = createBookingCandidates(daySlots, { duration: 120, deliveryMode: 'remote' });
  assert.deepEqual(flattenSelectedSlotIds(candidates, [candidates[0].id, candidates[4].id]), ['h09', 'h10', 'h15', 'h16']);
});

test('regroupe les heures enregistrées pour afficher les séances choisies', () => {
  const sessions = daySlots.slice(3).map((hour) => ({ ...hour, duration_minutes: 60, status: 'confirmed' }));
  const grouped = groupBookedSessions(sessions, 'one_4h');
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].duration_minutes, 240);
  assert.equal(grouped[0].starts_at, daySlots[3].starts_at);
  assert.equal(grouped[0].ends_at, daySlots[6].ends_at);
});

function halfHourSlots(day = '2026-07-20') {
  const periods = [[8, 30, 12, 30], [13, 30, 16, 30]];
  const slots = [];
  for (const [startHour, startMinute, endHour, endMinute] of periods) {
    let cursor = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    while (cursor < end) {
      const next = cursor + 30;
      const time = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      slots.push({
        id: `${day}-${time(cursor)}`,
        starts_at: `${day}T${time(cursor)}:00+02:00`,
        ends_at: `${day}T${time(next)}:00+02:00`,
        delivery_modes: ['remote', 'in_person'],
      });
      cursor = next;
    }
  }
  return slots;
}

test('compose une demi-journée de 3 h 30 à partir des demi-heures', () => {
  const candidates = createBookingCandidates(halfHourSlots(), { duration: 210, deliveryMode: 'remote' });
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((candidate) => candidate.slotIds.length === 7));
});

test('compose la journée présentielle 4 h + pause déjeuner + 3 h', () => {
  const candidates = createSplitDayBookingCandidates(halfHourSlots(), {
    deliveryMode: 'in_person',
    morningDuration: 240,
    afternoonDuration: 180,
    lunchMinutes: 60,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].slotIds.length, 14);
  assert.equal(candidates[0].segments.length, 2);
});

test('regroupe quatorze demi-heures en deux séances de 3 h 30', () => {
  const sessions = halfHourSlots('2026-07-20').slice(0, 7)
    .concat(halfHourSlots('2026-07-21').slice(0, 7))
    .map((item) => ({ ...item, duration_minutes: 30, status: 'confirmed' }));
  const grouped = groupBookedSessions(sessions, 'two_3h30');
  assert.equal(grouped.length, 2);
  assert.ok(grouped.every((session) => session.duration_minutes === 210));
});

test('identifie la dernière séance et sa signature apprenant', () => {
  const sessions = [
    { ...slot('first', 9, 11, '2026-07-20'), duration_minutes: 120 },
    { ...slot('last', 14, 16, '2026-07-22'), duration_minutes: 120 },
  ];
  const booking = {
    schedule_format: 'two_2h',
    course_session_bookings: sessions,
    course_session_attendance: [{
      session_starts_at: sessions[1].starts_at,
      session_ends_at: sessions[1].ends_at,
      learner_signature_sha256: 'signature-presente',
    }],
  };

  assert.equal(getLastBookedSession(booking).id, 'last');
  assert.equal(hasLearnerSignedLastSession(booking), true);
});

test('n’ouvre pas le questionnaire si seule une séance antérieure est signée', () => {
  const sessions = [
    { ...slot('first', 9, 11, '2026-07-20'), duration_minutes: 120 },
    { ...slot('last', 14, 16, '2026-07-22'), duration_minutes: 120 },
  ];
  const booking = {
    schedule_format: 'two_2h',
    course_session_bookings: sessions,
    course_session_attendance: [{
      session_starts_at: sessions[0].starts_at,
      session_ends_at: sessions[0].ends_at,
      learner_signature_sha256: 'signature-presente',
    }],
  };

  assert.equal(hasLearnerSignedLastSession(booking), false);
});
