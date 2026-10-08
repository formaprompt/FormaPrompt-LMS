import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import AdminCourseCohorts from './AdminCourseCohorts';

afterEach(() => {
  try { cleanup(); } finally { vi.useRealTimers(); }
});

function useSeptemberFixtureDate() {
  // Le mois initial doit correspondre aux fixtures, quelle que soit la date d'exécution.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
}

function halfDay(day, startHour, prefix, modes = ['remote', 'in_person']) {
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(`${day}T${String(startHour + Math.floor(index / 2)).padStart(2, '0')}:${String((index % 2) * 30).padStart(2, '0')}:00.000Z`);
    return { id: `${prefix}-${index}`, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(), duration_minutes: 30, delivery_modes: modes };
  });
}

const fourDays = ['01', '02', '03', '04'].flatMap((day) => halfDay(`2026-10-${day}`, 8, `day-${day}`));
const selectLabel = (name) => `${name} · plage de 3 h 30`;
function renderAdmin(props = {}) { return render(<AdminCourseCohorts courseOptions={[{ id: 'word-initiation', label: 'Word Initiation' }]} availableSlots={fourDays} {...props} />); }
function fillBase(format) {
  fireEvent.change(screen.getByLabelText('Formation'), { target: { value: 'word-initiation' } });
  fireEvent.click(screen.getByLabelText('À distance'));
  fireEvent.change(screen.getByLabelText('Format'), { target: { value: format } });
  fireEvent.change(screen.getByLabelText('Capacité maximale'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('Seuil minimum de participants'), { target: { value: '4' } });
}
function selectRange(name, slotIds) { fireEvent.change(screen.getByLabelText(selectLabel(name)), { target: { value: slotIds.join(':') } }); }

it('refuse la publication d’un brouillon sans capacité ni seuil', () => {
  const onSaveDraft = vi.fn(); renderAdmin({ onSaveDraft });
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le brouillon' }).closest('form'));
  expect(screen.getByRole('alert')).toHaveTextContent('Choisissez la formation');
  expect(onSaveDraft).not.toHaveBeenCalled();
});

it('envoie quatre plages complètes de 3 h 30 et 28 identifiants dans leur ordre de séance', () => {
  const onSaveDraft = vi.fn(); renderAdmin({ onSaveDraft }); fillBase('four_half_days_3h30');
  ['Demi-journée 1', 'Demi-journée 2', 'Demi-journée 3', 'Demi-journée 4'].forEach((name, index) => {
    const ids = fourDays.slice(index * 7, index * 7 + 7).map((slot) => slot.id);
    expect([...screen.getByLabelText(selectLabel(name)).options].find((option) => option.value === ids.join(':'))).not.toBeDisabled();
    selectRange(name, ids);
  });
  expect(screen.getByLabelText(selectLabel('Demi-journée 1'))).toHaveValue(fourDays.slice(0, 7).map((slot) => slot.id).join(':'));
  ['Demi-journée 2', 'Demi-journée 3', 'Demi-journée 4'].forEach((name, index) => expect(screen.getByLabelText(selectLabel(name))).toHaveValue(fourDays.slice((index + 1) * 7, (index + 2) * 7).map((slot) => slot.id).join(':')));
  expect(document.querySelectorAll('.admin-course-cohorts__range-summary')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.queryByRole('alert')).toBeNull();
  const draft = onSaveDraft.mock.calls[0][0];
  expect(draft).toMatchObject({ course_id: 'word-initiation', capacity: 8, minimum_participants: 4 });
  expect(draft.sessions.map((session) => session.position)).toEqual([1, 2, 3, 4]);
  expect(draft.sessions.flatMap((session) => session.slot_ids)).toEqual(fourDays.map((slot) => slot.id));
  expect(draft.sessions.every((session) => session.slot_ids.length === 7)).toBe(true);
});

it('ne propose pas une plage trouée, réservée ou incompatible', () => {
  const onSaveDraft = vi.fn();
  const invalid = fourDays.map((slot) => slot.id === 'day-01-6' ? { ...slot, starts_at: '2026-10-01T12:00:00.000Z', ends_at: '2026-10-01T12:30:00.000Z' } : slot).filter((slot) => !slot.id.startsWith('day-02'));
  renderAdmin({ availableSlots: invalid, onSaveDraft }); fillBase('four_half_days_3h30');
  expect(screen.getByLabelText(selectLabel('Demi-journée 1')).querySelectorAll('option')).toHaveLength(3);
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le brouillon' }).closest('form'));
  expect(screen.getByRole('alert')).toHaveTextContent('plage complète');
  expect(onSaveDraft).not.toHaveBeenCalled();
});

it('bloque une alternative temporellement chevauchante même avec des identifiants différents', () => {
  const first = halfDay('2026-10-01', 8, 'first'); const alternative = halfDay('2026-10-01', 8, 'alternative');
  renderAdmin({ availableSlots: [...first, ...alternative, ...halfDay('2026-10-02', 8, 'day-2'), ...halfDay('2026-10-03', 8, 'day-3'), ...halfDay('2026-10-04', 8, 'day-4')] }); fillBase('four_half_days_3h30');
  selectRange('Demi-journée 1', first.map((slot) => slot.id));
  const option = [...screen.getByLabelText(selectLabel('Demi-journée 2')).options].find((item) => item.value === alternative.map((slot) => slot.id).join(':'));
  expect(option).toBeDisabled();
});

it('compose deux jours de deux plages séparées par une pause et les transmet comme quatre séances', () => {
  const onSaveDraft = vi.fn();
  const slots = ['01', '02'].flatMap((day) => [...halfDay(`2026-10-${day}`, 8, `${day}-morning`, ['remote']), ...halfDay(`2026-10-${day}`, 12, `${day}-afternoon`, ['remote'])]);
  renderAdmin({ availableSlots: slots, onSaveDraft }); fillBase('two_days_2x3h30');
  fireEvent.change(screen.getByLabelText('Date Jour 1'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Date Jour 2'), { target: { value: '2026-10-02' } });
  selectRange('Jour 1 · 1re plage', slots.slice(0, 7).map((slot) => slot.id)); selectRange('Jour 1 · 2e plage', slots.slice(7, 14).map((slot) => slot.id));
  selectRange('Jour 2 · 1re plage', slots.slice(14, 21).map((slot) => slot.id)); selectRange('Jour 2 · 2e plage', slots.slice(21, 28).map((slot) => slot.id));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
  expect(screen.getByText('4 plages de 3 h 30 · total 14 h')).toBeVisible();
  expect(onSaveDraft.mock.calls[0][0].sessions).toHaveLength(4);
  expect(onSaveDraft.mock.calls[0][0].sessions.flatMap((session) => session.slot_ids)).toHaveLength(28);
  expect(onSaveDraft.mock.calls[0][0].sessions.map((session) => session.position)).toEqual([1, 2, 3, 4]);
});

it('retire explicitement les deux plages d’un jour lorsque sa date est remplacée', () => {
  const onSaveDraft = vi.fn();
  const slots = ['01', '02', '03'].flatMap((day) => [...halfDay(`2026-10-${day}`, 8, `${day}-morning`, ['remote']), ...halfDay(`2026-10-${day}`, 12, `${day}-afternoon`, ['remote'])]);
  renderAdmin({ availableSlots: slots, onSaveDraft }); fillBase('two_days_2x3h30');
  fireEvent.change(screen.getByLabelText('Date Jour 1'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Date Jour 2'), { target: { value: '2026-10-02' } });
  selectRange('Jour 1 · 1re plage', slots.slice(0, 7).map((slot) => slot.id)); selectRange('Jour 1 · 2e plage', slots.slice(7, 14).map((slot) => slot.id));
  selectRange('Jour 2 · 1re plage', slots.slice(14, 21).map((slot) => slot.id)); selectRange('Jour 2 · 2e plage', slots.slice(21, 28).map((slot) => slot.id));
  fireEvent.change(screen.getByLabelText('Date Jour 1'), { target: { value: '2026-10-03' } });
  expect(screen.getByLabelText(selectLabel('Jour 1 · 1re plage'))).toHaveValue('');
  expect(screen.getByLabelText(selectLabel('Jour 1 · 2e plage'))).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
  expect(screen.getByRole('alert')).toHaveTextContent('plage complète');
  expect(onSaveDraft).not.toHaveBeenCalled();
});

it('conserve quatre choix répartis sur plusieurs mois et les enregistre dans l’ordre chronologique', async () => {
  useSeptemberFixtureDate();
  const onSaveDraft = vi.fn();
  const monthSlots = {
    '2026-09': halfDay('2026-09-21', 8, 'sep', ['remote']),
    '2026-10': halfDay('2026-10-15', 8, 'oct', ['remote']),
    '2026-11': [...halfDay('2026-11-02', 8, 'nov-2', ['remote']), ...halfDay('2026-11-06', 8, 'nov-6', ['remote'])],
    '2026-12': [],
  };
  const onLoadAvailabilityMonth = vi.fn((month) => Promise.resolve(monthSlots[month] || []));
  renderAdmin({ availableSlots: [], onSaveDraft, onLoadAvailabilityMonth }); fillBase('four_half_days_3h30');
  await waitFor(() => expect(onLoadAvailabilityMonth).toHaveBeenCalledWith('2026-09'));
  await waitFor(() => expect([...screen.getByLabelText(selectLabel('Demi-journée 1')).options]).toHaveLength(2));
  selectRange('Demi-journée 1', monthSlots['2026-09'].map((slot) => slot.id));
  for (const [index, month, slots] of [[2, '2026-10', monthSlots['2026-10']], [3, '2026-11', monthSlots['2026-11'].slice(0, 7)], [4, '2026-11', monthSlots['2026-11'].slice(7)]]) {
    const name = `Demi-journée ${index}`;
    fireEvent.change(screen.getByLabelText(`Mois à consulter — ${name}`), { target: { value: month } });
    await waitFor(() => expect(onLoadAvailabilityMonth).toHaveBeenCalledWith(month));
    await waitFor(() => expect([...screen.getByLabelText(selectLabel(name)).options].some((option) => option.value === slots.map((slot) => slot.id).join(':'))).toBe(true));
    selectRange(name, slots.map((slot) => slot.id));
  }
  fireEvent.change(screen.getByLabelText('Mois à consulter — Demi-journée 1'), { target: { value: '2026-12' } });
  await waitFor(() => expect(onLoadAvailabilityMonth).toHaveBeenCalledWith('2026-12'));
  expect(screen.getByText(/Sélection conservée/)).toHaveTextContent('21');
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
  expect(onSaveDraft).toHaveBeenCalledTimes(1);
  expect(onSaveDraft.mock.calls[0][0].sessions.map((session) => session.slot_ids[0])).toEqual(['sep-0', 'oct-0', 'nov-2-0', 'nov-6-0']);
});

it('signale un échec de chargement mensuel sans créer de disponibilité', async () => {
  const onLoadAvailabilityMonth = vi.fn(() => Promise.reject(new Error('Erreur de chargement contrôlée')));
  renderAdmin({ availableSlots: [], onLoadAvailabilityMonth }); fillBase('four_half_days_3h30');
  await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Erreur de chargement contrôlée'));
  expect(screen.getByText(/Aucune disponibilité n’est créée ici/)).toBeVisible();
});

it('conserve le chargement mensuel le plus récent sous StrictMode', async () => {
  useSeptemberFixtureDate();
  const resolvers = [];
  const onLoadAvailabilityMonth = vi.fn(() => new Promise((resolve) => { resolvers.push(resolve); }));
  render(<StrictMode><AdminCourseCohorts courseOptions={[{ id: 'word-initiation', label: 'Word Initiation' }]} availableSlots={[]} onLoadAvailabilityMonth={onLoadAvailabilityMonth} /></StrictMode>);
  fillBase('four_half_days_3h30');
  await waitFor(() => expect(onLoadAvailabilityMonth.mock.calls.length).toBeGreaterThanOrEqual(2));
  resolvers.at(-1)(halfDay('2026-09-21', 8, 'strict', ['remote']));
  await waitFor(() => expect(screen.getByLabelText(selectLabel('Demi-journée 1')).options).toHaveLength(2));
});

it('hydrate et enregistre un brouillon réservé sans le remplacer par une nouvelle disponibilité', () => {
  const onSaveDraft = vi.fn();
  const lockedSessions = ['01', '02', '03', '04'].map((day, index) => {
    const range = halfDay(`2026-10-${day}`, 8, `locked-${day}`);
    return { position: index + 1, slot_ids: range.map((slot) => slot.id), starts_at: range[0].starts_at, ends_at: range[6].ends_at };
  });
  renderAdmin({ availableSlots: [], onSaveDraft, cohorts: [{ id: 'draft-edit', course_id: 'word-initiation', status: 'draft', delivery_mode: 'remote', schedule_format: 'four_half_days_3h30', capacity: 8, minimum_participants: 4, sessions: lockedSessions }] });
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  expect(screen.getByLabelText(selectLabel('Demi-journée 1'))).toHaveValue(`existing:1:${lockedSessions[0].slot_ids.join(':')}`);
  fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le brouillon' }));
  expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-edit', sessions: expect.arrayContaining([expect.objectContaining({ slot_ids: lockedSessions[0].slot_ids })]) }));
});

it('demande un motif avant l’annulation et transmet ce motif', () => {
  const onCancel = vi.fn(); renderAdmin({ cohorts: [{ id: 'draft-1', course_id: 'word-initiation', status: 'draft', capacity: 8, minimum_participants: 4, sessions: [] }], onCancel });
  const cancel = screen.getByRole('button', { name: 'Annuler la cohorte' }); expect(cancel).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motif d’annulation'), { target: { value: 'Dates à revoir' } }); fireEvent.click(cancel);
  expect(onCancel).toHaveBeenCalledWith('draft-1', 'Dates à revoir');
});

it('génère une seule fois les liens Meet d’une cohorte publiée et conserve les liens manuels', async () => {
  let resolveGeneration;
  const onGenerateMeetingLinks = vi.fn(() => new Promise((resolve) => { resolveGeneration = resolve; }));
  const sessions = [1, 2, 3, 4].map((position) => ({ id: `session-${position}`, position, starts_at: `2026-10-0${position}T08:00:00.000Z`, ends_at: `2026-10-0${position}T11:30:00.000Z`, meeting_url: position === 1 ? 'https://meet.example.test/manual' : null }));
  const view = renderAdmin({ cohorts: [{ id: 'published-1', course_id: 'word-initiation', status: 'published', delivery_mode: 'remote', capacity: 10, minimum_participants: 2, sessions }], onGenerateMeetingLinks });
  expect(screen.getByLabelText('Visioconférence — séance 1')).toHaveValue('https://meet.example.test/manual');
  const button = screen.getByRole('button', { name: 'Générer les liens Google Meet' });
  fireEvent.click(button); fireEvent.click(button);
  expect(onGenerateMeetingLinks).toHaveBeenCalledTimes(1);
  expect(onGenerateMeetingLinks).toHaveBeenCalledWith('published-1');
  resolveGeneration({ cohort_id: 'published-1', complete: false, sessions: [{ session_id: 'session-2', position: 2, status: 'created' }, { session_id: 'session-3', position: 3, status: 'failed' }] });
  await waitFor(() => expect(screen.getByText('Génération partielle : les séances indiquées « À réessayer » peuvent être relancées.')).toBeVisible());
  expect(screen.getByText('Lien créé')).toBeVisible();
  expect(screen.getByText('À réessayer')).toBeVisible();
  view.rerender(<AdminCourseCohorts courseOptions={[{ id: 'word-initiation', label: 'Word Initiation' }]} availableSlots={fourDays} cohorts={[{ id: 'published-1', course_id: 'word-initiation', status: 'published', delivery_mode: 'remote', capacity: 10, minimum_participants: 2, sessions: sessions.map((session) => session.id === 'session-2' ? { ...session, meeting_url: 'https://meet.example.test/generated' } : session) }]} onGenerateMeetingLinks={onGenerateMeetingLinks} />);
  expect(screen.getByLabelText('Visioconférence — séance 2')).toHaveValue('https://meet.example.test/generated');
});

it('réessaie une seule fois le nettoyage Meet d’une cohorte annulée et signale un résultat partiel', async () => {
  let resolveCleanup;
  const onCleanupMeetingEvents = vi.fn(() => new Promise((resolve) => { resolveCleanup = resolve; }));
  const sessions = [1, 2].map((position) => ({ id: `cancelled-${position}`, position, starts_at: `2026-10-0${position}T08:00:00.000Z`, ends_at: `2026-10-0${position}T11:30:00.000Z`, google_sync_status: position === 1 ? 'delete_pending' : 'delete_error' }));
  renderAdmin({ cohorts: [{ id: 'cancelled-1', course_id: 'word-initiation', status: 'cancelled', delivery_mode: 'remote', capacity: 10, minimum_participants: 2, sessions }], onCleanupMeetingEvents });
  const button = screen.getByRole('button', { name: 'Réessayer le nettoyage Google Meet' });
  fireEvent.click(button); fireEvent.click(button);
  expect(onCleanupMeetingEvents).toHaveBeenCalledTimes(1);
  expect(onCleanupMeetingEvents).toHaveBeenCalledWith('cancelled-1');
  resolveCleanup({ cohort_id: 'cancelled-1', complete: false, sessions: [{ session_id: 'cancelled-1', position: 1, status: 'deleted' }, { session_id: 'cancelled-2', position: 2, status: 'failed' }] });
  await waitFor(() => expect(screen.getByText('Nettoyage partiel : vous pouvez réessayer.')).toBeVisible());
  expect(screen.getByRole('button', { name: 'Réessayer le nettoyage Google Meet' })).toBeEnabled();
});

it('limite le groupe créativité à quatre demi-journées et six places avec seuil quatre', () => {
  renderAdmin({ courseOptions: [{ id: 'ia-creativite-groupe', label: 'Créativité' }] });
  fireEvent.change(screen.getByLabelText('Formation'), { target: { value: 'ia-creativite-groupe' } });
  expect(screen.getByLabelText('Format')).toHaveValue('four_half_days_3h30');
  expect(screen.queryByRole('option', { name: '2 jours de 7 h (2 × 3 h 30 par jour)' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Capacité maximale')).toHaveValue(6);
  expect(screen.getByLabelText('Capacité maximale')).toHaveAttribute('max', '6');
  expect(screen.getByLabelText('Seuil minimum de participants')).toHaveValue(4);
  expect(screen.getByLabelText('Seuil minimum de participants')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Seuil minimum de participants')).toHaveAttribute('min', '2');
  expect(screen.getByLabelText('Seuil minimum de participants')).toHaveAttribute('max', '6');
  expect(screen.getByLabelText('En présentiel à Calais')).toBeInTheDocument();
});
it('ne permet pas la confirmation créativité avant quatre inscrits éligibles', () => {
  renderAdmin({ cohorts: [{ id: 'creativity-one', course_id: 'ia-creativite-groupe', status: 'published', enrolled_count: 3, capacity: 6, minimum_participants: 4, sessions: [] }] });
  expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
});

it('charge les participants via le parent et distingue cadeau, remboursement en attente et remboursement terminé', async () => {
  const onLoadParticipants = vi.fn().mockResolvedValue([
    { id: 'gift', user_id: 'gift-user', name: 'Cadeau test', is_gift: true, eligible: true, status: 'active' },
    { id: 'pending', user_id: 'pending-user', name: 'Paiement test', is_gift: false, eligible: false, status: 'cohort_cancelled_refund_review', payment_status: 'paid' },
    { id: 'refunded', user_id: 'refunded-user', name: 'Remboursé test', is_gift: false, eligible: false, status: 'cohort_cancelled_refund_review', payment_status: 'refunded' },
  ]);
  renderAdmin({ onLoadParticipants, cohorts: [{ id: 'group-roster', course_id: 'ia-creativite-groupe', status: 'cancelled', capacity: 6, minimum_participants: 4, enrolled_count: 0, sessions: [] }] });
  fireEvent.click(screen.getByRole('button', { name: 'Voir les participants' }));
  await waitFor(() => expect(onLoadParticipants).toHaveBeenCalledWith('group-roster'));
  expect((await screen.findByRole('link', { name: 'Cadeau test' })).closest('li')).toHaveTextContent('Formation offerte · Éligible');
  expect(screen.getByRole('link', { name: 'Paiement test' }).closest('li')).toHaveTextContent('Remboursement à vérifier dans Stripe');
  const refunded = screen.getByRole('link', { name: 'Remboursé test' }).closest('li');
  expect(refunded).toHaveTextContent('Paiement remboursé');
  expect(refunded).not.toHaveTextContent('Remboursement à vérifier dans Stripe');
});

it('enregistre un brouillon créativité avec seuil deux et les quatre séances prévues', () => {
  const onSaveDraft = vi.fn();
  renderAdmin({ onSaveDraft, courseOptions: [{ id: 'ia-creativite-groupe', label: 'Créativité' }] });
  fireEvent.change(screen.getByLabelText('Formation'), { target: { value: 'ia-creativite-groupe' } });
  fireEvent.click(screen.getByLabelText('À distance'));
  fireEvent.change(screen.getByLabelText('Seuil minimum de participants'), { target: { value: '2' } });
  [0, 1, 2, 3].forEach(index => selectRange(`Demi-journée ${index + 1}`, fourDays.slice(index * 7, index * 7 + 7).map(slot => slot.id)));
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le brouillon' }).closest('form'));
  expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ minimum_participants: 2, capacity: 6 }));
  expect(onSaveDraft.mock.calls[0][0].sessions.flatMap(session => session.slot_ids)).toEqual(fourDays.map(slot => slot.id));
});
it.each(['1', '7', '2.5'])('refuse un seuil créativité hors bornes ou non entier (%s)', value => {
  const onSaveDraft = vi.fn();
  renderAdmin({ onSaveDraft, courseOptions: [{ id: 'ia-creativite-groupe', label: 'Créativité' }] });
  fireEvent.change(screen.getByLabelText('Formation'), { target: { value: 'ia-creativite-groupe' } });
  fireEvent.click(screen.getByLabelText('À distance'));
  fireEvent.change(screen.getByLabelText('Seuil minimum de participants'), { target: { value } });
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le brouillon' }).closest('form'));
  expect(onSaveDraft).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
it('refuse un seuil supérieur à la capacité réduite du brouillon', () => {
  const onSaveDraft = vi.fn();
  renderAdmin({ onSaveDraft, courseOptions: [{ id: 'ia-creativite-groupe', label: 'Créativité' }] });
  fireEvent.change(screen.getByLabelText('Formation'), { target: { value: 'ia-creativite-groupe' } });
  fireEvent.click(screen.getByLabelText('À distance'));
  fireEvent.change(screen.getByLabelText('Capacité maximale'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Seuil minimum de participants'), { target: { value: '5' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le brouillon' }).closest('form'));
  expect(onSaveDraft).not.toHaveBeenCalled();
});
it('modifie seulement le seuil d’un groupe publié et confirme selon le seuil reçu', async () => {
  const onSetMinimumParticipants = vi.fn().mockResolvedValue({});
  const onConfirm = vi.fn().mockResolvedValue({});
  const cohort = { id: 'published-two', course_id: 'ia-creativite-groupe', status: 'published', enrolled_count: 2, capacity: 6, minimum_participants: 4, sessions: [] };
  const view = renderAdmin({ onSetMinimumParticipants, onConfirm, cohorts: [cohort] });
  expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Seuil minimum du groupe'), { target: { value: '2' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le seuil' }).closest('form'));
  await waitFor(() => expect(onSetMinimumParticipants).toHaveBeenCalledWith('published-two', 2));
  expect(onSetMinimumParticipants.mock.calls[0]).toHaveLength(2);
  view.rerender(<AdminCourseCohorts onSetMinimumParticipants={onSetMinimumParticipants} onConfirm={onConfirm} cohorts={[{ ...cohort, minimum_participants: 2 }]} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmer' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('published-two'));
  expect(screen.getByText(/Ouverture confirmée manuellement à partir de 2/)).toBeInTheDocument();
});
it.each(['draft', 'published'])('borne aussi le changement de seuil sur un groupe %s', status => {
  const onSetMinimumParticipants = vi.fn();
  renderAdmin({ onSetMinimumParticipants, cohorts: [{ id: 'bounded', course_id: 'ia-creativite-groupe', status, capacity: 4, minimum_participants: 4, enrolled_count: 2, sessions: [] }] });
  for (const value of ['1', '5', '7', '2.5']) {
    fireEvent.change(screen.getByLabelText('Seuil minimum du groupe'), { target: { value } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le seuil' }).closest('form'));
  }
  expect(onSetMinimumParticipants).not.toHaveBeenCalled();
});
it('ne propose pas de changement de seuil après confirmation du groupe', () => {
  renderAdmin({ cohorts: [{ id: 'confirmed-two', course_id: 'ia-creativite-groupe', status: 'confirmed', minimum_participants: 2, capacity: 6, enrolled_count: 2, sessions: [] }] });
  expect(screen.queryByLabelText('Seuil minimum du groupe')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enregistrer le seuil' })).not.toBeInTheDocument();
});

function futureCreativityCohort(overrides = {}) {
  const sessions = Array.from({ length: 4 }, (_, position) => ({ id: `future-${position}`, position: position + 1, starts_at: new Date(Date.now() + (position + 1) * 86400000).toISOString(), ends_at: new Date(Date.now() + (position + 1) * 86400000 + 210 * 60000).toISOString() }));
  return { id: 'future-group', course_id: 'ia-creativite-groupe', status: 'published', capacity: 6, minimum_participants: 2, enrolled_count: 1, sessions, ...overrides };
}
it('inscrit un cadeau groupe existant puis recharge candidats et participants', async () => {
  const candidate = { user_id: 'gift-group', name: 'Cadeau groupe', email: 'group@example.test', access_source: 'gift', already_enrolled: false };
  const onLoadCreativityCandidates = vi.fn().mockResolvedValueOnce([candidate]).mockResolvedValueOnce([{ ...candidate, already_enrolled: true }]);
  const onLoadParticipants = vi.fn().mockResolvedValue([{ id: 'enrolled', user_id: candidate.user_id, name: candidate.name, is_gift: true, eligible: true, status: 'active' }]);
  const onEnrollCreativity = vi.fn().mockResolvedValue({ id: 'enrolled' });
  renderAdmin({ cohorts: [futureCreativityCohort()], onLoadCreativityCandidates, onLoadParticipants, onEnrollCreativity });
  fireEvent.click(screen.getByRole('button', { name: 'Charger les apprenants éligibles' }));
  expect(await screen.findByRole('option', { name: /Cadeau groupe.*group@example.test.*Formation offerte/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Apprenant éligible au groupe ouvert'), { target: { value: candidate.user_id } });
  fireEvent.click(screen.getByRole('button', { name: 'Inscrire à cette session' }));
  await waitFor(() => expect(onEnrollCreativity).toHaveBeenCalledWith('future-group', 'gift-group'));
  expect(onEnrollCreativity.mock.calls[0]).toHaveLength(2);
  expect(await screen.findByText(/L’apprenant est inscrit à cette session/)).toBeInTheDocument();
  expect(onLoadParticipants).toHaveBeenCalledWith('future-group');
  expect(onLoadCreativityCandidates).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('option', { name: /Déjà inscrit à un groupe/ })).toBeDisabled();
});
it('ne propose pas de cadeau individuel quand le serveur ne renvoie aucun droit groupe', async () => {
  const onLoadCreativityCandidates = vi.fn().mockResolvedValue([]);
  renderAdmin({ cohorts: [futureCreativityCohort()], onLoadCreativityCandidates });
  fireEvent.click(screen.getByRole('button', { name: 'Charger les apprenants éligibles' }));
  expect(await screen.findByText(/Un droit à la formule individuelle ne permet pas/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Inscrire à cette session' })).toBeDisabled();
});
it('désactive les doublons déjà inscrits et les groupes complets', async () => {
  const candidate = { user_id: 'already', name: 'Déjà inscrit', access_source: 'gift', already_enrolled: true };
  const onEnrollCreativity = vi.fn();
  renderAdmin({ cohorts: [futureCreativityCohort({ enrolled_count: 6 })], onLoadCreativityCandidates: vi.fn().mockResolvedValue([candidate]), onEnrollCreativity });
  fireEvent.click(screen.getByRole('button', { name: 'Charger les apprenants éligibles' }));
  expect(await screen.findByRole('option', { name: /Déjà inscrit.*Formation offerte/ })).toBeDisabled();
  expect(screen.getByLabelText('Apprenant éligible au groupe ouvert')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Inscrire à cette session' })).toBeDisabled();
  expect(screen.getByText('Ce groupe est complet.')).toBeInTheDocument();
  expect(onEnrollCreativity).not.toHaveBeenCalled();
});
it('présente une erreur lisible si le chargement des candidats échoue', async () => {
  renderAdmin({ cohorts: [futureCreativityCohort()], onLoadCreativityCandidates: vi.fn().mockRejectedValue(new Error('Liste momentanément indisponible.')) });
  fireEvent.click(screen.getByRole('button', { name: 'Charger les apprenants éligibles' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Liste momentanément indisponible.');
  expect(screen.getByRole('button', { name: 'Charger les apprenants éligibles' })).toBeEnabled();
});
it('ne présente pas d’inscription admin pour brouillon, annulé ou séances déjà commencées', () => {
  renderAdmin({ cohorts: [futureCreativityCohort({ status: 'draft' }), futureCreativityCohort({ id: 'cancelled-group', status: 'cancelled' }), futureCreativityCohort({ id: 'started-group', sessions: Array.from({ length: 4 }, (_, position) => ({ position, starts_at: '2020-01-01T08:00:00Z', ends_at: '2020-01-01T11:30:00Z' })) })] });
  expect(screen.queryByRole('button', { name: 'Charger les apprenants éligibles' })).not.toBeInTheDocument();
});

it.each(['manual', 'opco'])('nomme le candidat %s dossier administratif et son inscription annulée sans remboursement Stripe', async access_source => {
  const onLoadCreativityCandidates = vi.fn().mockResolvedValue([{ user_id: 'admin-learner', name: 'Dossier test', email: 'dossier@example.test', access_source, already_enrolled: false }]);
  const onLoadParticipants = vi.fn().mockResolvedValue([{ id: 'administrative-enrollment', user_id: 'admin-learner', name: 'Dossier test', access_source, is_administrative: true, is_gift: false, has_purchase: false, payment_status: null, eligible: true, status: 'cohort_cancelled_refund_review' }]);
  renderAdmin({ cohorts: [futureCreativityCohort()], onLoadCreativityCandidates, onLoadParticipants });
  fireEvent.click(screen.getByRole('button', { name: 'Charger les apprenants éligibles' }));
  expect(await screen.findByRole('option', { name: /Dossier test.*Dossier administratif/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Dossier test.*Inscription payée/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Voir les participants' }));
  const row = (await screen.findByRole('link', { name: 'Dossier test' })).closest('li');
  expect(row).toHaveTextContent('Dossier administratif');
  expect(row).not.toHaveTextContent('Remboursement à vérifier dans Stripe');
  expect(row).not.toHaveTextContent('Formation offerte');
});
