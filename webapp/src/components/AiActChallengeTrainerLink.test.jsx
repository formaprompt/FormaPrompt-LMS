import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiActChallengeTrainerLink from './AiActChallengeTrainerLink';

afterEach(cleanup);
describe('Accès au tableau Challenge depuis le dashboard', () => {
  it('propose le suivi au compte habilité par le serveur', async () => {
    const api = vi.fn().mockResolvedValue({ can_train: true });
    render(<MemoryRouter><AiActChallengeTrainerLink userId="fixture-trainer" api={api} /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Suivi formateur AI ACT CHALLENGE' })).toHaveAttribute('href', '/formateur/ai-act-challenge');
    expect(api).toHaveBeenCalledWith('permissions', { course_id: 'formation-ia-act' });
  });
  it('ne propose aucun accès en cas de refus ou indisponibilité', async () => {
    const api = vi.fn().mockRejectedValue(new Error('ACCESS_DENIED'));
    render(<MemoryRouter><AiActChallengeTrainerLink userId="fixture-user" api={api} /></MemoryRouter>);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('retire le lien quand le compte connecté change', async () => {
    const api = vi.fn().mockImplementation((_action, payload) => Promise.resolve({ can_train: payload.course_id === 'formation-ia-act' }));
    const view = render(<MemoryRouter><AiActChallengeTrainerLink userId="fixture-trainer" api={api} /></MemoryRouter>);
    await screen.findByRole('link');
    view.rerender(<MemoryRouter><AiActChallengeTrainerLink userId={null} api={api} /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
