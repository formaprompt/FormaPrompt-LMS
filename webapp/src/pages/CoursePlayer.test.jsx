import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoursePlayer from './CoursePlayer';

const playerState = vi.hoisted(() => ({
  user: { id: 'learner-course-player', email: 'learner@example.test' },
  access: null,
  accessError: null,
  beforeContent: null,
  purchaseExists: false,
  positioningExists: false,
  exercises: [],
  savedResponses: [],
  insertExerciseResponse: null,
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
    if (playerState.beforeContent) await playerState.beforeContent(playerState.user.id);
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
      exercises: playerState.exercises,
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
        insert: (payload) => ({
          select: () => ({ single: () => playerState.insertExerciseResponse(payload) }),
        }),
        then: (resolve) => {
          if (table === 'course_positioning_assessments') {
            return resolve({ data: playerState.positioningExists ? [{ id: 'positioning' }] : [], error: null });
          }
          if (table === 'course_exercise_latest_responses') {
            return resolve({ data: playerState.savedResponses, error: null });
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

function playerTree() {
  return (
    <MemoryRouter initialEntries={['/course/formation-prompt-level-1']}>
      <Routes>
        <Route path="/course/:id" element={<CoursePlayer />} />
        <Route path="/formation-prompt-engineering" element={<h1>Présentation de la formation</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderPlayer() {
  return render(playerTree());
}

describe('CoursePlayer fondé exclusivement sur course_access', () => {
  afterEach(cleanup);

  beforeEach(() => {
    playerState.user = { id: 'learner-course-player', email: 'learner@example.test' };
    playerState.access = activeAccess();
    playerState.accessError = null;
    playerState.beforeContent = null;
    playerState.purchaseExists = false;
    playerState.positioningExists = false;
    playerState.exercises = [];
    playerState.savedResponses = [];
    playerState.insertExerciseResponse = null;
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
    expect(playerState.queriedTables).not.toContain('course_positioning_assessments');
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

  it('ignore le refus tardif du compte précédent', async () => {
    let rejectPreviousAccess;
    playerState.beforeContent = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectPreviousAccess = reject;
    }));
    const view = renderPlayer();
    expect(playerState.beforeContent).toHaveBeenCalledWith('learner-course-player');

    playerState.user = { id: 'learner-course-player-b', email: 'learner-b@example.test' };
    playerState.access = activeAccess();
    view.rerender(playerTree());
    expect(await screen.findByRole('heading', { name: 'Quiz de positionnement sécurisé' })).toBeVisible();

    await act(async () => rejectPreviousAccess(Object.assign(new Error('Accès refusé.'), { status: 403 })));
    expect(screen.getByRole('heading', { name: 'Quiz de positionnement sécurisé' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Présentation de la formation' })).toBeNull();
    expect(playerState.beforeContent).toHaveBeenCalledWith('learner-course-player-b');
  });

  function enableExercise() {
    playerState.positioningExists = true;
    playerState.exercises = [{ id: 1, title: 'Écrire une consigne', prompt: 'Rédige une consigne.' }];
  }

  function savedResponse(payload, id) {
    return { data: { ...payload, id, saved_at: '2026-11-12T08:00:00Z' }, error: null };
  }

  it('conserve la saisie quand la session se renouvelle pour le même compte', async () => {
    enableExercise();
    const user = userEvent.setup();
    const view = renderPlayer();
    await user.click(await screen.findByRole('tab', { name: 'Exercices pratiques' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Votre réponse à l'exercice/ }), {
      target: { value: 'Saisie en cours' },
    });

    playerState.user = { ...playerState.user };
    await act(async () => view.rerender(playerTree()));
    expect(screen.getByRole('textbox', { name: /Votre réponse à l'exercice/ })).toHaveValue('Saisie en cours');
    expect(playerState.contentRequests).toEqual(['formation-prompt-level-1']);
    expect(playerState.queriedTables.filter((table) => table === 'course_exercise_latest_responses')).toHaveLength(1);
  });

  it.each([
    ['Enregistrer le brouillon', 'draft', 'Brouillon enregistré.'],
    ['Déclarer la réponse terminée', 'submitted', 'Réponse terminée enregistrée.'],
  ])('préserve la saisie et bloque un nouvel envoi pendant %s', async (buttonName, status, successMessage) => {
    enableExercise();
    let resolveSave;
    playerState.insertExerciseResponse = vi.fn().mockImplementationOnce((payload) => new Promise((resolve) => {
      resolveSave = () => resolve(savedResponse(payload, 'version-1'));
    })).mockImplementationOnce(async (payload) => savedResponse(payload, 'version-2'));
    const user = userEvent.setup();
    renderPlayer();
    await user.click(await screen.findByRole('tab', { name: 'Exercices pratiques' }));
    const field = screen.getByRole('textbox', { name: /Votre réponse à l'exercice/ });
    const draft = screen.getByRole('button', { name: 'Enregistrer le brouillon' });
    const submit = screen.getByRole('button', { name: 'Déclarer la réponse terminée' });

    fireEvent.change(field, { target: { value: ' Première version ' } });
    await user.dblClick(screen.getByRole('button', { name: buttonName }));
    expect(playerState.insertExerciseResponse).toHaveBeenCalledTimes(1);
    expect(playerState.insertExerciseResponse).toHaveBeenCalledWith(expect.objectContaining({
      response_text: 'Première version', status,
    }));
    expect(screen.getByText('Enregistrement en cours…')).toBeVisible();

    fireEvent.change(field, { target: { value: 'Deuxième version en cours de saisie' } });
    expect(field).toBeEnabled();
    expect(draft).toBeDisabled();
    expect(submit).toBeDisabled();
    await user.click(draft);
    await user.click(submit);
    expect(playerState.insertExerciseResponse).toHaveBeenCalledTimes(1);

    await act(async () => resolveSave());
    expect(field).toHaveValue('Deuxième version en cours de saisie');
    expect(screen.getByText(successMessage)).toBeVisible();
    expect(screen.getByText('Des modifications restent à enregistrer.')).toBeVisible();
    await user.click(draft);
    expect(playerState.insertExerciseResponse).toHaveBeenLastCalledWith(expect.objectContaining({
      response_text: 'Deuxième version en cours de saisie', status: 'draft',
    }));
    expect(screen.queryByText('Des modifications restent à enregistrer.')).toBeNull();
  });

  it('garde la saisie après une erreur et permet une nouvelle tentative', async () => {
    enableExercise();
    playerState.savedResponses = [savedResponse({ exercise_id: '1', response_text: 'Ancien brouillon', status: 'draft' }, 'version-0').data];
    playerState.insertExerciseResponse = vi.fn()
      .mockRejectedValueOnce(new Error('Connexion interrompue'))
      .mockImplementationOnce(async (payload) => savedResponse(payload, 'version-1'));
    const user = userEvent.setup();
    renderPlayer();
    await user.click(await screen.findByRole('tab', { name: 'Exercices pratiques' }));
    const field = screen.getByRole('textbox', { name: /Votre réponse à l'exercice/ });
    const draft = screen.getByRole('button', { name: 'Enregistrer le brouillon' });

    expect(field).toHaveValue('Ancien brouillon');
    fireEvent.change(field, { target: { value: ' Version à conserver ' } });
    await user.click(draft);
    expect(await screen.findByText(/La réponse n'a pas été enregistrée/)).toBeVisible();
    expect(field).toHaveValue(' Version à conserver ');
    expect(draft).toBeEnabled();
    await user.click(draft);
    expect(await screen.findByText('Brouillon enregistré.')).toBeVisible();
    expect(field).toHaveValue('Version à conserver');
    expect(playerState.insertExerciseResponse).toHaveBeenCalledTimes(2);
  });
});
