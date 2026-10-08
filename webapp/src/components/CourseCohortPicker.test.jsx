import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CourseCohortPicker from './CourseCohortPicker';

afterEach(() => cleanup());

const cohort = {
  id: 'cohort-1', course_id: 'word-initiation', schedule_format: 'four_half_days_3h30', status: 'published', capacity: 8, enrolled_count: 6, available_places: 2,
  sessions: [{ id: 's1', position: 1, starts_at: '2026-10-01T08:00:00.000Z', ends_at: '2026-10-01T11:30:00.000Z', duration_minutes: 210 }],
};

it('affiche uniquement les dates et places publiées, puis transmet seulement l’identifiant de cohorte', () => {
  const onJoin = vi.fn();
  render(<CourseCohortPicker courseId="word-initiation" cohorts={[cohort, { ...cohort, id: 'other', course_id: 'powerpoint-initiation' }]} onJoin={onJoin} />);
  expect(screen.getByText((_, element) => element?.className === 'course-cohorts__places' && element.textContent === '2 places restantes sur 8')).toBeVisible();
  expect(screen.getByText(/jeudi 1 octobre 2026/i)).toBeVisible();
  expect(screen.queryByText(/meet|visioconférence/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre cette session' }));
  expect(onJoin).toHaveBeenCalledWith('cohort-1');
});

it('empêche l’inscription à une cohorte complète ou annulée', () => {
  render(<CourseCohortPicker courseId="word-initiation" cohorts={[{ ...cohort, id: 'full', available_places: 0 }, { ...cohort, id: 'cancelled', status: 'cancelled', available_places: 2 }]} />);
  expect(screen.getByRole('button', { name: 'Session complète' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Session annulée' })).toBeDisabled();
});

it('présente une cohorte confirmée avec places comme réservable et bloque un double-clic pendant la promesse', async () => {
  let resolveJoin;
  const onJoin = vi.fn(() => new Promise((resolve) => { resolveJoin = resolve; }));
  render(<CourseCohortPicker courseId="word-initiation" cohorts={[{ ...cohort, status: 'confirmed' }]} onJoin={onJoin} />);
  expect(screen.getByText('Confirmée')).toBeVisible();
  const join = screen.getByRole('button', { name: 'Rejoindre cette session' });
  fireEvent.click(join); fireEvent.click(join);
  expect(onJoin).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Inscription en cours…' })).toBeDisabled();
  resolveJoin();
});

it('affiche le seuil et la capacité exacts d’un groupe créativité publié', () => {
  render(<CourseCohortPicker courseId="ia-creativite-groupe" cohorts={[{ ...cohort, course_id: 'ia-creativite-groupe', minimum_participants: 2, capacity: 4, available_places: 2 }]} />);
  expect(screen.getByText('2 participants minimum, 4 maximum.')).toBeInTheDocument();
  expect(screen.queryByText('4 participants minimum, 6 maximum.')).not.toBeInTheDocument();
});
