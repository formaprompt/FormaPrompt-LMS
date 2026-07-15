import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvailabilitySlots } from './availabilitySlots.js';

const baseForm = {
  fromDate: '2026-07-20',
  toDate: '2026-07-26',
  dayStart: '09:00',
  dayEnd: '17:00',
  lunchStart: '12:00',
  mode: 'both',
  includeSaturday: false,
  excludeHolidays: false,
  notes: '',
};

test('génère les créneaux du lundi au vendredi et exclut le dimanche', () => {
  const result = createAvailabilitySlots(baseForm, {
    createdBy: 'admin-id',
    now: new Date('2026-07-01T00:00:00+02:00'),
  });

  assert.equal(result.includedDays, 5);
  assert.equal(result.slots.length, 70);
  assert.ok(result.slots.every((slot) => ![0, 6].includes(new Date(slot.starts_at).getDay())));
});

test('inclut le samedi sur demande mais jamais le dimanche', () => {
  const result = createAvailabilitySlots({ ...baseForm, includeSaturday: true }, {
    createdBy: 'admin-id',
    now: new Date('2026-07-01T00:00:00+02:00'),
  });

  assert.equal(result.includedDays, 6);
  assert.equal(result.slots.length, 84);
  assert.ok(result.slots.some((slot) => new Date(slot.starts_at).getDay() === 6));
  assert.ok(result.slots.every((slot) => new Date(slot.starts_at).getDay() !== 0));
});

test('conserve toujours une heure de pause pour déjeuner', () => {
  const result = createAvailabilitySlots({
    ...baseForm,
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
  }, {
    createdBy: 'admin-id',
    now: new Date('2026-07-01T00:00:00+02:00'),
  });

  assert.equal(result.slots.length, 14);
  assert.ok(result.slots.every((slot) => new Date(slot.ends_at) - new Date(slot.starts_at) === 30 * 60_000));
  assert.ok(result.slots.every((slot) => {
    const start = new Date(slot.starts_at);
    const end = new Date(slot.ends_at);
    return end.getHours() <= 12 || start.getHours() >= 13;
  }));
});

test('permet de déplacer la pause déjeuner tout en conservant une heure', () => {
  const result = createAvailabilitySlots({
    ...baseForm,
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
    lunchStart: '13:00',
  }, {
    createdBy: 'admin-id',
    now: new Date('2026-07-01T00:00:00+02:00'),
  });

  assert.ok(result.slots.every((slot) => {
    const start = new Date(slot.starts_at);
    const end = new Date(slot.ends_at);
    return end.getHours() <= 13 || start.getHours() >= 14;
  }));
});
