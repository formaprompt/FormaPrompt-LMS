const HALF_DAY_MINUTES = 210;
const SLOT_MINUTES = 30;

function minutesBetween(start, end) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
}

function choiceId(slotIds) { return slotIds.join(':'); }

export function sameSlotIds(first = [], second = []) {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

export function formatRange(choice) {
  const start = new Date(choice.starts_at);
  const end = new Date(choice.ends_at);
  const options = { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' };
  return `${start.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} · ${start.toLocaleTimeString('fr-FR', options)}–${end.toLocaleTimeString('fr-FR', options)}`;
}

export function createHalfDayChoices(slots = [], deliveryMode, existingSessions = []) {
  const compatible = slots
    .filter((slot) => !slot.is_reserved && slot.is_active !== false && slot.delivery_modes?.includes(deliveryMode) && minutesBetween(slot.starts_at, slot.ends_at) === SLOT_MINUTES)
    .sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
  const byStart = compatible.reduce((groups, slot) => {
    const key = new Date(slot.starts_at).getTime();
    return groups.set(key, [...(groups.get(key) || []), slot]);
  }, new Map());
  const buildGroups = (group) => {
    if (group.length === HALF_DAY_MINUTES / SLOT_MINUTES) return [group];
    const next = byStart.get(new Date(group[group.length - 1].ends_at).getTime()) || [];
    return next.flatMap((slot) => buildGroups([...group, slot]));
  };
  const seen = new Set();
  const choices = compatible.flatMap((first) => buildGroups([first])).flatMap((group) => {
    const slotIds = group.map((slot) => slot.id); const id = choiceId(slotIds);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, slotIds, starts_at: group[0].starts_at, ends_at: group[group.length - 1].ends_at }];
  });
  existingSessions.forEach((session) => {
    const slotIds = Array.isArray(session.slot_ids) ? session.slot_ids : [];
    if (slotIds.length !== 7 || !session.starts_at || !session.ends_at || minutesBetween(session.starts_at, session.ends_at) !== HALF_DAY_MINUTES) return;
    if (!choices.some((choice) => sameSlotIds(choice.slotIds, slotIds))) choices.push({ id: `existing:${session.position}:${choiceId(slotIds)}`, slotIds, starts_at: session.starts_at, ends_at: session.ends_at, existing: true });
  });
  return choices.sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
}

export function findChoiceForSlotIds(choices, slotIds) { return choices.find((choice) => sameSlotIds(choice.slotIds, slotIds)); }

export function parisDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}
