import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsBoundary from './AnalyticsBoundary';

const state = vi.hoisted(() => ({ loaded: false, auth: { loading: false, user: null }, update: vi.fn(), stop: vi.fn(), replace: vi.fn() }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('../lib/googleAnalytics', () => ({
  getPublicAnalyticsPage: (path) => ['/', '/formation-ia-act-conformite'].includes(path) ? { path } : null,
  isAnalyticsDocumentLoaded: () => state.loaded,
  stopAudienceMeasurement: state.stop, updateAnalyticsPage: state.update,
}));
vi.mock('../lib/audienceConsent', () => ({ subscribeAudienceConsent: () => () => {} }));
vi.mock('../lib/analyticsNavigationBoundary', () => ({ installAnalyticsNavigationBoundary: () => () => {}, replaceAnalyticsDocument: state.replace }));

describe('audience document boundary', () => {
  beforeEach(() => { cleanup(); state.loaded = false; state.auth = { loading: false, user: null }; vi.clearAllMocks(); });
  it('renders private pages normally when the SDK has never loaded', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><AnalyticsBoundary><div>Private fixture</div></AnalyticsBoundary></MemoryRouter>);
    expect(screen.getByText('Private fixture')).toBeInTheDocument();
  });
  it('passes an anonymous settled session to the engine', async () => {
    render(<MemoryRouter><AnalyticsBoundary><div>Public fixture</div></AnalyticsBoundary></MemoryRouter>);
    await waitFor(() => expect(state.update).toHaveBeenCalledWith('/', 'default', { loading: false, user: null }));
  });
  it('never renders a private tree in a document that already contains the SDK', () => {
    state.loaded = true;
    render(<MemoryRouter initialEntries={['/dashboard']}><AnalyticsBoundary><div>Private fixture</div></AnalyticsBoundary></MemoryRouter>);
    expect(screen.queryByText('Private fixture')).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith('/dashboard');
  });
  it('also hides account data when a user appears on a public route', () => {
    state.loaded = true;
    state.auth = { loading: false, user: { id: 'fixture' } };
    render(<MemoryRouter><AnalyticsBoundary><div>Account fixture</div></AnalyticsBoundary></MemoryRouter>);
    expect(screen.queryByText('Account fixture')).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
  });
  it.each(['/course/formation-ia-act', '/formateur/ai-act-challenge', '/dashboard',
    '/admin', '/course/formation-ia-act?attempt_id=fixture#score=9'])('hides Challenge/private data before unloading the audience document: %s', (path) => {
    state.loaded = true;
    render(<MemoryRouter initialEntries={[path]}><AnalyticsBoundary><div>Identity, answer and score fixture</div></AnalyticsBoundary></MemoryRouter>);
    expect(screen.queryByText('Identity, answer and score fixture')).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith(path);
  });
  it('keeps the anonymous public AI Act presentation eligible', () => {
    render(<MemoryRouter initialEntries={['/formation-ia-act-conformite']}><AnalyticsBoundary><div>Public AI Act</div></AnalyticsBoundary></MemoryRouter>);
    expect(screen.getByText('Public AI Act')).toBeInTheDocument();
    expect(state.update).toHaveBeenCalledWith('/formation-ia-act-conformite', 'default', { loading: false, user: null });
    expect(state.replace).not.toHaveBeenCalled();
  });
});
