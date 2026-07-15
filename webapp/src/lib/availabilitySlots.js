import { isJourFerie } from './dates.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const SLOT_DURATION_MINUTES = 30;
const LUNCH_DURATION_MINUTES = 60;
const MAX_RANGE_DAYS = 366;
const MAX_GENERATED_SLOTS = 1000;

function parseDate(value) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseTime(value) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

function atTime(date, time) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hours,
    time.minutes,
    0,
    0,
  );
}

export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialAvailabilityForm(referenceDate = new Date()) {
  const firstDay = new Date(referenceDate);
  firstDay.setDate(firstDay.getDate() + 1);
  const lastDay = new Date(firstDay);
  lastDay.setDate(lastDay.getDate() + 29);

  return {
    fromDate: formatDateInput(firstDay),
    toDate: formatDateInput(lastDay),
    dayStart: '08:30',
    dayEnd: '16:30',
    lunchStart: '12:30',
    mode: 'both',
    includeSaturday: false,
    excludeHolidays: true,
    notes: '',
  };
}

export function createAvailabilitySlots(form, { createdBy, now = new Date() } = {}) {
  const firstDay = parseDate(form.fromDate);
  const lastDay = parseDate(form.toDate);
  const dayStart = parseTime(form.dayStart);
  const dayEnd = parseTime(form.dayEnd);
  const lunchStart = parseTime(form.lunchStart);

  if (!firstDay || !lastDay) throw new Error('Choisissez une date de début et une date de fin valides.');
  if (lastDay < firstDay) throw new Error('La date de fin doit être postérieure ou égale à la date de début.');
  if (!dayStart || !dayEnd || dayEnd.totalMinutes <= dayStart.totalMinutes) {
    throw new Error("L’heure de fin doit être postérieure à l’heure de début.");
  }
  if (!lunchStart
    || lunchStart.totalMinutes <= dayStart.totalMinutes
    || lunchStart.totalMinutes + LUNCH_DURATION_MINUTES > dayEnd.totalMinutes) {
    throw new Error("La pause déjeuner d’une heure doit être comprise dans la journée de disponibilité.");
  }

  const rangeDays = Math.round((lastDay - firstDay) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) throw new Error('La période ne peut pas dépasser un an.');

  const deliveryModes = form.mode === 'both' ? ['remote', 'in_person'] : [form.mode];
  if (!deliveryModes.every((mode) => ['remote', 'in_person'].includes(mode))) {
    throw new Error('Choisissez une modalité valide.');
  }

  const slots = [];
  let includedDays = 0;
  let skippedPastSlots = 0;
  const cursorDay = new Date(firstDay);

  while (cursorDay <= lastDay) {
    const weekday = cursorDay.getDay();
    const isSunday = weekday === 0;
    const isSaturdayExcluded = weekday === 6 && !form.includeSaturday;
    const isHolidayExcluded = form.excludeHolidays && isJourFerie(cursorDay);

    if (!isSunday && !isSaturdayExcluded && !isHolidayExcluded) {
      includedDays += 1;
      const lunchStartAt = atTime(cursorDay, lunchStart);
      const lunchEndAt = new Date(lunchStartAt.getTime() + LUNCH_DURATION_MINUTES * 60_000);
      const periods = [
        [atTime(cursorDay, dayStart), lunchStartAt],
        [lunchEndAt, atTime(cursorDay, dayEnd)],
      ];

      periods.forEach(([periodStart, periodEnd]) => {
        let slotStart = periodStart;

        while (slotStart.getTime() + SLOT_DURATION_MINUTES * 60_000 <= periodEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60_000);
          if (slotStart > now) {
            slots.push({
              starts_at: slotStart.toISOString(),
              ends_at: slotEnd.toISOString(),
              delivery_modes: deliveryModes,
              notes: form.notes.trim() || null,
              created_by: createdBy,
            });
          } else {
            skippedPastSlots += 1;
          }
          slotStart = slotEnd;
        }
      });
    }

    cursorDay.setDate(cursorDay.getDate() + 1);
  }

  if (slots.length === 0) throw new Error('Cette période ne contient aucun créneau futur correspondant à vos choix.');
  if (slots.length > MAX_GENERATED_SLOTS) {
    throw new Error('Cette période génère plus de 1 000 créneaux. Réduisez la période ou la plage horaire.');
  }

  return { slots, includedDays, skippedPastSlots };
}
