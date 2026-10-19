import process from 'node:process';
import { spawnSync } from 'node:child_process';
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


test('les horaires Paris, les dates initiales et les pauses restent identiques sous Paris et New York aux deux changements d’heure', () => {
  const moduleUrl = new URL('./availabilitySlots.js', import.meta.url).href;
  const script = `
    import { createAvailabilitySlots, createInitialAvailabilityForm, formatDateInput } from ${JSON.stringify(moduleUrl)};
    const forms = [
      {fromDate:'2026-03-28',toDate:'2026-03-30'},
      {fromDate:'2026-10-24',toDate:'2026-10-26'},
    ];
    const results = forms.map(dates => createAvailabilitySlots({
      ...dates, dayStart:'08:30',dayEnd:'16:30',lunchStart:'12:30',
      mode:'both',includeSaturday:true,excludeHolidays:false,notes:'',
    },{createdBy:'test',now:new Date('2026-01-01T00:00:00Z')}));
    console.log(JSON.stringify({results,
      initial:createInitialAvailabilityForm(new Date('2026-03-28T23:30:00Z')),
      today:formatDateInput(new Date('2026-03-28T23:30:00Z')),
    }));
  `;
  const run = (timeZone) => {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {env:{...process.env,TZ:timeZone},encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    return JSON.parse(child.stdout);
  };
  const paris = run('Europe/Paris');
  const newYork = run('America/New_York');
  assert.deepEqual(newYork,paris);
  assert.equal(paris.today,'2026-03-29');
  assert.equal(paris.initial.fromDate,'2026-03-30');
  assert.equal(paris.initial.toDate,'2026-04-28');
  const expectedStarts = [
    ['2026-03-28T07:30:00.000Z','2026-03-30T06:30:00.000Z'],
    ['2026-10-24T06:30:00.000Z','2026-10-26T07:30:00.000Z'],
  ];
  const clock = value => new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  for (const [index,result] of paris.results.entries()) {
    assert.equal(result.includedDays,2); // Sunday remains excluded, including the DST change day.
    assert.equal(result.slots.length,28);
    assert.deepEqual([result.slots[0].starts_at,result.slots[14].starts_at],expectedStarts[index]);
    for (const offset of [0,14]) {
      assert.equal(clock(result.slots[offset].starts_at),'08:30');
      assert.equal(clock(result.slots[offset+7].ends_at),'12:30');
      assert.equal(clock(result.slots[offset+8].starts_at),'13:30');
      assert.equal(Date.parse(result.slots[offset+8].starts_at)-Date.parse(result.slots[offset+7].ends_at),3_600_000);
    }
    assert.ok(result.slots.every(slot => Date.parse(slot.ends_at)-Date.parse(slot.starts_at) === 1_800_000));
  }
});
