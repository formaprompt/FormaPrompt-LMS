import { expect, it } from 'vitest';
import { createHalfDayChoices, parisDate } from './courseCohortRangeChoices';

function range(day, hour, prefix, mode = 'remote') {
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(`${day}T${String(hour + Math.floor(index / 2)).padStart(2, '0')}:${String((index % 2) * 30).padStart(2, '0')}:00.000Z`);
    return { id: `${prefix}-${index}`, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(), delivery_modes: [mode] };
  });
}

it('propose seulement sept demi-heures contiguës et compatibles', () => {
  const slots = [...range('2026-10-01', 8, 'ok'), ...range('2026-10-02', 8, 'other', 'in_person'), ...range('2026-10-03', 8, 'reserved')];
  slots[6] = { ...slots[6], starts_at: '2026-10-01T12:00:00.000Z', ends_at: '2026-10-01T12:30:00.000Z' };
  slots[20] = { ...slots[20], is_reserved: true };
  expect(createHalfDayChoices(slots, 'remote')).toEqual([]);
  expect(createHalfDayChoices(slots, 'in_person')).toHaveLength(1);
});

it('conserve une plage de brouillon réservée pour son édition', () => {
  const saved = { position: 1, slot_ids: ['locked-0', 'locked-1', 'locked-2', 'locked-3', 'locked-4', 'locked-5', 'locked-6'], starts_at: '2026-10-03T08:00:00.000Z', ends_at: '2026-10-03T11:30:00.000Z' };
  expect(createHalfDayChoices([], 'remote', [saved])[0]).toMatchObject({ slotIds: saved.slot_ids, existing: true });
});

it('garde les alternatives qui se chevauchent sans confondre leurs identifiants', () => {
  const choices = createHalfDayChoices([...range('2026-10-04', 8, 'first'), ...range('2026-10-04', 8, 'second')], 'remote');
  expect(choices.some((choice) => choices.some((other) => choice !== other && choice.slotIds.every((id) => !other.slotIds.includes(id))))).toBe(true);
});

it('produit une clé ISO stable pour les comparaisons des jours Paris', () => {
  expect(parisDate('2026-09-30T22:30:00.000Z')).toBe('2026-10-01');
});
