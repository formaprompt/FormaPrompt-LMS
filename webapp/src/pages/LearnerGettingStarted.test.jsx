import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnerGettingStarted from './LearnerGettingStarted';
import LearnerWelcome from '../components/LearnerWelcome';

const { auth, config, load, seen, mark } = vi.hoisted(() => ({
  auth: { user: { id: 'account-a' } },
  config: { enabled: true, version: '1', title: 'Bienvenue dans votre espace FormaPrompt', description: 'Retrouvez vos formations et vos ressources.', videoUrl: null, thumbnailUrl: null, captionsUrl: null, durationLabel: null },
  load: vi.fn(), seen: vi.fn(), mark: vi.fn(),
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../lib/learnerOnboarding', () => ({
  DEFAULT_ONBOARDING_CONFIG: config,
  loadLearnerOnboardingConfig: load,
  hasSeenOnboardingVideo: seen,
  markOnboardingVideoSeen: mark,
}));
const mountGuide = () => render(<MemoryRouter><LearnerGettingStarted /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); auth.user = { id: 'account-a' };
  Object.assign(config, { enabled: true, version: '1', videoUrl: null, thumbnailUrl: null, captionsUrl: null, captionsEmbedded: false, durationLabel: null });
  load.mockResolvedValue({ ...config }); seen.mockReturnValue(false); mark.mockReturnValue(true);
});
afterEach(cleanup);

describe('Guide apprenant et accueil', () => {
  it('A : guide écrit utilisable sans vidéo ni faux lecteur', async () => {
    const view = mountGuide();
    expect(await screen.findByText('Retrouvez les étapes dans le guide écrit ci-dessous.')).toBeVisible();
    expect(view.container.querySelector('video')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Enregistrer votre travail' })).toBeVisible();
    expect(mark).not.toHaveBeenCalled();
  });
  it('B : lecture déclenchée par l’apprenant uniquement et sous-titres réels', async () => {
    load.mockResolvedValue({ ...config, videoUrl: '/assets/demo.mp4', captionsUrl: '/assets/demo.vtt', thumbnailUrl: '/assets/demo.webp', durationLabel: '3 min' });
    const view = mountGuide();
    const video = await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt');
    expect(screen.getByText(config.description)).toBeVisible();
    expect(video).toHaveAttribute('controls'); expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('playsinline'); expect(video).not.toHaveAttribute('autoplay');
    expect(view.container.querySelector('track')).toHaveAttribute('src', '/assets/demo.vtt');
    expect(mark).not.toHaveBeenCalled(); fireEvent.play(video); expect(mark).not.toHaveBeenCalled();
    fireEvent.playing(video); expect(mark).toHaveBeenCalledWith('account-a', '1');
  });
  it('D : une erreur de média laisse le guide complet accessible', async () => {
    load.mockResolvedValue({ ...config, videoUrl: '/assets/demo.mp4' });
    const view = mountGuide();
    const video = await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt');
    expect(view.container.querySelector('track')).toBeNull();
    fireEvent.error(video);
    expect(screen.getByRole('status')).toHaveTextContent('La vidéo ne peut pas être chargée');
    expect(screen.getByRole('heading', { name: 'Revenir et poursuivre' })).toBeVisible();
    expect(mark).not.toHaveBeenCalled();
  });
  it('E : stockage indisponible sans bloquer la lecture ou le guide', async () => {
    load.mockResolvedValue({ ...config, videoUrl: '/assets/demo.mp4' }); mark.mockReturnValue(false);
    mountGuide(); fireEvent.playing(await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt'));
    expect(screen.getByRole('heading', { name: 'Les étapes pour bien démarrer' })).toBeVisible();
  });
  it('E : configuration indisponible conserve le guide sans lecteur', async () => {
    load.mockRejectedValue(new Error('offline'));
    const view = mountGuide();
    expect(await screen.findByText('Retrouvez les étapes dans le guide écrit ci-dessous.')).toBeVisible();
    expect(view.container.querySelector('video')).toBeNull();
  });
  it('D : erreur de source sans propagation laisse le guide accessible', async () => {
    load.mockResolvedValue({ ...config, videoUrl: '/media/onboarding/demo.webm' });
    const view = mountGuide();
    await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt');
    fireEvent.error(view.container.querySelector('source'));
    expect(screen.getByRole('status')).toHaveTextContent('La vidéo ne peut pas être chargée');
    expect(mark).not.toHaveBeenCalled();
  });
  it('F : accès au clavier avec un libellé explicite', async () => {
    const keyboard = userEvent.setup();
    render(<MemoryRouter><LearnerWelcome userId="account-a" progressState="new" /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Découvrir mon espace' });
    await keyboard.tab(); expect(link).toHaveFocus(); expect(link).toHaveAttribute('href', '/aide/bien-demarrer');
  });
  it.each(['unknown', 'active'])('C/E : accueil discret pour état %s', async (progressState) => {
    render(<MemoryRouter><LearnerWelcome userId="account-a" progressState={progressState} /></MemoryRouter>);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Bien démarrer' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Découvrir mon espace' })).toBeNull();
  });
  it('C : le compte B ne reprend ni la vue ni la requête tardive du compte A', async () => {
    let resolveA; load.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
    seen.mockImplementation((userId) => userId === 'account-a');
    const view = render(<MemoryRouter><LearnerWelcome userId="account-a" progressState="new" /></MemoryRouter>);
    view.rerender(<MemoryRouter><LearnerWelcome userId="account-b" progressState="new" /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Découvrir mon espace' })).toBeVisible();
    resolveA({ ...config, enabled: false });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Découvrir mon espace' })).toBeVisible());
    expect(seen).toHaveBeenLastCalledWith('account-b', '1');
  });
  it('recalcule le statut vidéo au retour vers l’espace', async () => {
    const keyboard = userEvent.setup();
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<LearnerWelcome userId="account-a" progressState="new" />} />
      <Route path="/aide/bien-demarrer" element={<LearnerGettingStarted />} />
    </Routes></MemoryRouter>);
    await keyboard.click(await screen.findByRole('link', { name: 'Découvrir mon espace' }));
    seen.mockReturnValue(true);
    await keyboard.click(screen.getByRole('link', { name: 'Retour à mon espace apprenant' }));
    expect(await screen.findByRole('link', { name: 'Bien démarrer' })).toBeVisible();
  });
  it('la découverte cible le lecteur et place le focus sur son titre sans démarrer', async () => {
    const keyboard = userEvent.setup();
    load.mockResolvedValue({ ...config, videoUrl: '/media/onboarding/guide.mp4', captionsEmbedded: true });
    const view = render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<LearnerWelcome userId="account-a" progressState="new" />} />
      <Route path="/aide/bien-demarrer" element={<LearnerGettingStarted />} />
    </Routes></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Découvrir mon espace' });
    expect(link).toHaveAttribute('href', '/aide/bien-demarrer#learner-intro-video');
    await keyboard.tab(); expect(link).toHaveFocus(); await keyboard.keyboard('{Enter}');
    const heading = await screen.findByRole('heading', { name: config.title });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Les sous-titres français sont intégrés à l’image de la vidéo.')).toBeVisible();
    expect(view.container.querySelector('track')).toBeNull();
    expect(view.container.querySelector('video')).not.toHaveAttribute('autoplay');
    expect(mark).not.toHaveBeenCalled();
  });
  it.each([
    ['URL', { videoUrl: '/media/onboarding/guide-v2.mp4' }],
    ['version', { version: '2' }],
  ])('récupère après une erreur quand la %s change, avec un nouveau lecteur', async (_, change) => {
    const keyboard = userEvent.setup();
    load.mockResolvedValue({ ...config, videoUrl: '/media/onboarding/guide.mp4' });
    function GuideWithReload() {
      return <><LearnerGettingStarted /><Link to="/aide/bien-demarrer#reload">Recharger la configuration</Link></>;
    }
    // Rechargement runtime sans démonter la page : l'ancienne erreur ne doit pas persister.
    const view = render(<MemoryRouter initialEntries={['/aide/bien-demarrer']}><Routes>
      <Route path="/dashboard" element={<LearnerWelcome userId="account-a" progressState="new" />} />
      <Route path="/aide/bien-demarrer" element={<GuideWithReload />} />
    </Routes></MemoryRouter>);
    const firstVideo = await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt');
    fireEvent.error(firstVideo); expect(screen.getByRole('status')).toBeVisible();
    load.mockResolvedValue({ ...config, videoUrl: '/media/onboarding/guide.mp4', ...change });
    await keyboard.click(screen.getByRole('link', { name: 'Recharger la configuration' }));
    const replacement = await screen.findByLabelText('Présentation de l’espace apprenant FormaPrompt');
    expect(replacement).not.toBe(firstVideo);
    expect(view.container.querySelector('source')).toHaveAttribute('src', change.videoUrl || '/media/onboarding/guide.mp4');
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.playing(replacement); expect(mark).toHaveBeenCalledWith('account-a', change.version || '1');
  });
});
