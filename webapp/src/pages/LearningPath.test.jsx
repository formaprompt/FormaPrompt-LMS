import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LearningPath from './LearningPath';

const learningState = vi.hoisted(() => ({
  user: { id: 'learner-a', email: 'learner-a@example.test' },
  rows: [],
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: learningState.user }),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => {
      const filters = {};
      const builder = {
        select: () => builder,
        eq: (column, value) => {
          filters[column] = value;
          return builder;
        },
        order: async () => ({
          data: learningState.rows
            .filter((row) => Object.entries(filters).every(([column, value]) => row[column] === value))
            .sort((first, second) => new Date(second.last_viewed_at) - new Date(first.last_viewed_at)),
          error: null,
        }),
        upsert: async (row) => {
          learningState.rows = [
            ...learningState.rows.filter((item) => !(
              item.user_id === row.user_id
              && item.course_id === row.course_id
              && item.lesson_id === row.lesson_id
            )),
            row,
          ];
          return { error: null };
        },
      };
      return builder;
    },
  },
}));

function renderLearningPath(initialEntry = '/parcours/introduction-prompt-engineering') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/parcours/:slug/:lessonId?" element={<LearningPath />} />
        <Route path="/dashboard" element={<p>Tableau de bord</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Parcours apprenant persistant', () => {
  afterEach(cleanup);

  beforeEach(() => {
    learningState.rows = [{
      user_id: learningState.user.id,
      course_id: 'introduction-prompt-engineering',
      lesson_id: 'definir-un-role',
      status: 'in_progress',
      progress_percent: 0,
      last_viewed_at: '2026-08-08T09:00:00Z',
      completed_at: null,
    }];
  });

  it('reprend la dernière leçon puis conserve la nouvelle position après remontage', async () => {
    const user = userEvent.setup();
    const firstView = renderLearningPath();

    expect(await screen.findByRole('heading', { level: 2, name: 'Définir un rôle' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: /Définir un objectif/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Définir un objectif' })).toBeVisible();

    await waitFor(() => {
      expect(learningState.rows.some((row) => row.lesson_id === 'definir-un-objectif')).toBe(true);
    });
    firstView.unmount();

    renderLearningPath();
    expect(await screen.findByRole('heading', { level: 2, name: 'Définir un objectif' })).toBeVisible();
  });

  it('enregistre la complétion et recalcule la progression', async () => {
    const user = userEvent.setup();
    renderLearningPath('/parcours/introduction-prompt-engineering/definir-un-role');

    await user.click(await screen.findByRole('button', { name: 'Marquer comme terminé' }));
    expect(await screen.findByText(/Module terminé et enregistré/)).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    expect(learningState.rows.find((row) => row.lesson_id === 'definir-un-role')).toMatchObject({
      status: 'completed',
      progress_percent: 100,
    });
  });
});
