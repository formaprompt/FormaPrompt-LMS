import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';

const state = vi.hoisted(() => ({ loaded: false, callback: null,
  stop: vi.fn(), reload: vi.fn(), profile: vi.fn() }));
vi.mock('../lib/googleAnalytics', () => ({ isAnalyticsDocumentLoaded: () => state.loaded, stopAudienceMeasurement: state.stop }));
vi.mock('../lib/analyticsNavigationBoundary', () => ({ replaceAnalyticsDocument: state.reload }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: (callback) => { state.callback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: () => ({ select: () => ({ eq: () => ({ single: state.profile }) }) }),
} }));

describe('synchronous audience stop on account arrival', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); state.loaded = false; state.callback = null;
    state.profile.mockResolvedValue({ data: { role: 'user' }, error: null }); });
  it('stops and reloads before a deferred profile request when the SDK is present', () => {
    render(<AuthProvider><div /></AuthProvider>);
    state.loaded = true;
    state.callback('SIGNED_IN', { user: { id: 'fixture' } });
    expect(state.stop).toHaveBeenCalledTimes(1);
    expect(state.reload).toHaveBeenCalledTimes(1);
    expect(state.profile).not.toHaveBeenCalled();
  });
  it('preserves the existing profile lookup when audience never loaded', async () => {
    render(<AuthProvider><div /></AuthProvider>);
    state.callback('SIGNED_IN', { user: { id: 'fixture' } });
    await waitFor(() => expect(state.profile).toHaveBeenCalledTimes(1));
    expect(state.stop).not.toHaveBeenCalled();
    expect(state.reload).not.toHaveBeenCalled();
  });
});
