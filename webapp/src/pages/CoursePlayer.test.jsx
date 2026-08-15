import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoursePlayer from './CoursePlayer';

const playerState = vi.hoisted(() => ({
  user: { id: 'learner-course-player', email: 'learner@example.test' },
  access: null,
  accessError: null,
  purchaseExists: false,
  contentRequests: [],
  queriedTables: [],
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: playerState.user }),
}));

vi.mock('../data/courseCatalog', () => ({
  courseCatalog: {
    'formation-prompt-level-1': {
      title: 'Formation Prompt Engineering – Niveau 1',
      landingPath: '/formation-prompt-engineering',
      exercises: [],
    },
  },
}));

vi.mock('../lib/paidCourseContent', () => ({
  fetchPaidCourseContent: async (_supabase, courseId) => {
    playerState.contentRequests.push(courseId);
    if (playerState.accessError) throw playerState.accessError;
    const access = playerState.access;
    const open = access
      && access.course_id === courseId
      && access.user_id === playerState.user.id
      && access.status === 'active'
      && (!access.expires_at || new Date(access.expires_at) > new Date());
    if (!open) {
      const error = new Error('Accès à la formation refusé.');
      error.status = 403;
      throw error;
    }
    return {
      title: 'Formation Prompt Engineering – Niveau 1',
      landingPath: '/formation-prompt-engineering',
      quiz: [],
      positioningDomains: [],
      positioningLevels: [],
      exercises: [],
      glossary: [],
      resources: [],
    };
  },
}));

vi.mock('../components/PrerequisiteQuiz', () => ({
  default: () => <h1>Quiz de positionnement sécurisé</h1>,
}));

vi.mock('../components/CourseProgress', () => ({
  default: () => <div>Progression</div>,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      playerState.queriedTables.push(table);
      const filters = {};
      const builder = {
        select: () => builder,
        eq: (column, value) => {
          filters[column] = value;
          return builder;
        },
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve) => {
          if (table === 'course_positioning_assessments') {
            return resolve({ data: [], error: null });
          }
          if (table === 'purchases') {
            return resolve({ data: playerState.purchaseExists ? [{ id: 'purchase-only' }] : [], error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return builder;
    },
  },
}));

function activeAccess(overrides = {}) {
  return {
    id: 'access-prompt',
    user_id: playerState.user.id,
    course_id: 'formation-prompt-level-1',
    status: 'active',
    expires_at: null,
    ...overrides,
  };
}

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={['/course/formation-prompt-level-1']}>
      <Routes>
        <Route path="/course/:id" element={<CoursePlayer />} />
        <Route path="/formation-prompt-engineering" element={<h1>Présentation de la formation</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoursePlayer fondé exclusivement sur course_access', () => {
  afterEach(cleanup);

  beforeEach(() => {
    playerState.access = activeAccess();
    playerState.accessError = null;
    playerState.purchaseExists = false;
    playerState.contentRequests = [];
    playerState.queriedTables = [];
  });

  it('autorise la formation avec un accès active sans échéance', async () => {
    renderPlayer();
    expect(await screen.findByRole('heading', { name: 'Quiz de positionnement sécurisé' })).toBeVisible();
    expect(playerState.contentRequests).toEqual(['formation-prompt-level-1']);
    expect(playerState.queriedTables).not.toContain('course_access');
    expect(playerState.queriedTables).not.toContain('purchases');
  });

  it.each(['revoked', 'suspended', 'refunded', 'expired'])(
    'refuse la formation avec un accès %s',
    async (status) => {
      playerState.access = activeAccess({ status });
      renderPlayer();
      expect(await screen.findByRole('heading', { name: 'Présentation de la formation' })).toBeVisible();
      expect(playerState.queriedTables).not.toContain('purchases');
    },
  );

  it("n'autorise pas un achat sans course_access", async () => {
    playerState.access = null;
    playerState.purchaseExists = true;
    renderPlayer();
    expect(await screen.findByRole('heading', { name: 'Présentation de la formation' })).toBeVisible();
    expect(playerState.contentRequests).toEqual(['formation-prompt-level-1']);
    expect(playerState.queriedTables).toContain('course_positioning_assessments');
    expect(playerState.queriedTables).not.toContain('course_access');
    expect(playerState.queriedTables).not.toContain('purchases');
  });

  it("échoue de manière fermée si course_access est indisponible", async () => {
    playerState.accessError = Object.assign(
      new Error("Impossible de vérifier votre accès pour le moment."),
      { status: 409 },
    );
    playerState.purchaseExists = true;
    renderPlayer();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossible de vérifier votre accès/);
    expect(playerState.queriedTables).not.toContain('purchases');
  });

  it('retrouve la formation après revoked vers active', async () => {
    playerState.access = activeAccess({ status: 'revoked' });
    const blockedView = renderPlayer();
    expect(await screen.findByRole('heading', { name: 'Présentation de la formation' })).toBeVisible();
    blockedView.unmount();

    playerState.queriedTables = [];
    playerState.access = activeAccess();
    renderPlayer();
    expect(await screen.findByRole('heading', { name: 'Quiz de positionnement sécurisé' })).toBeVisible();
    expect(playerState.queriedTables).not.toContain('purchases');
  });
});
