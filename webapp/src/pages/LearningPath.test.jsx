import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LearningPath from './LearningPath';

const learningState = vi.hoisted(() => ({
  user: { id: 'learner-a', email: 'learner-a@example.test' },
  rows: [],
  access: null,
  accessError: null,
  writes: 0,
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: learningState.user }),
}));

vi.mock('../lib/courseAccess', () => ({
  fetchCourseAccessEntitlement: async () => ({
    data: learningState.access,
    error: learningState.accessError,
  }),
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
          learningState.writes += 1;
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

function activeAccess(overrides = {}) {
  return {
    id: 'access-a',
    user_id: learningState.user.id,
    course_id: 'formation-prompt-level-1',
    status: 'active',
    expires_at: null,
    ...overrides,
  };
}

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

describe('Parcours apprenant protégé par course_access', () => {
  afterEach(cleanup);

  beforeEach(() => {
    learningState.access = activeAccess();
    learningState.accessError = null;
    learningState.writes = 0;
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

  it("autorise l'URL directe et reprend la dernière leçon avec un accès actif", async () => {
    renderLearningPath();
    expect(await screen.findByRole('heading', { level: 2, name: 'Définir un rôle' })).toBeVisible();
  });

  it('conserve la nouvelle position après remontage avec un accès actif', async () => {
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

  it('enregistre la complétion avec un accès actif', async () => {
    const user = userEvent.setup();
    renderLearningPath('/parcours/introduction-prompt-engineering/definir-un-role');

    await user.click(await screen.findByRole('button', { name: 'Marquer comme terminé' }));
    expect(await screen.findByText(/Module terminé et enregistré/)).toBeVisible();
    expect(learningState.rows.find((row) => row.lesson_id === 'definir-un-role')).toMatchObject({
      status: 'completed',
      progress_percent: 100,
    });
  });

  it.each(['suspended', 'revoked', 'refunded', 'expired'])(
    "refuse l'URL et toute nouvelle progression avec un accès %s",
    async (status) => {
      learningState.access = activeAccess({ status });
      const historicalRows = structuredClone(learningState.rows);
      renderLearningPath();

      expect(await screen.findByRole('heading', { level: 1, name: 'Introduction au Prompt Engineering' })).toBeVisible();
      expect(screen.getByRole('alert')).toHaveTextContent(/accès/i);
      expect(learningState.writes).toBe(0);
      expect(learningState.rows).toEqual(historicalRows);
    },
  );

  it("refuse un accès actif arrivé à échéance", async () => {
    learningState.access = activeAccess({ expires_at: '2020-01-01T00:00:00Z' });
    renderLearningPath();
    expect(await screen.findByRole('heading', { level: 1, name: 'Introduction au Prompt Engineering' })).toBeVisible();
    expect(learningState.writes).toBe(0);
  });

  it.each(['revoked', 'suspended'])(
    'retrouve la progression après le retour %s vers active',
    async (blockedStatus) => {
      learningState.access = activeAccess({ status: blockedStatus });
      const blockedView = renderLearningPath();
      expect(await screen.findByRole('heading', { level: 1, name: 'Introduction au Prompt Engineering' })).toBeVisible();
      expect(learningState.rows).toHaveLength(1);
      blockedView.unmount();

      learningState.access = activeAccess();
      renderLearningPath();
      expect(await screen.findByRole('heading', { level: 2, name: 'Définir un rôle' })).toBeVisible();
      expect(learningState.rows.some((row) => row.lesson_id === 'definir-un-role')).toBe(true);
    },
  );
});
