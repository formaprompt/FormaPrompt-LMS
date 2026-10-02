import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoogleAdsPurchase } from '../hooks/useGoogleAdsPurchase';

const state = vi.hoisted(() => ({
  consent: 'granted', listeners: new Set(), user: { id: 'user-one' }, loading: false,
  invoke: vi.fn(), send: vi.fn(), enabled: true,
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: state.loading }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock('../lib/googleAdsPurchase', () => ({
  isGoogleAdsPurchaseEnabled: () => state.enabled, sendGoogleAdsPurchase: state.send,
}));
vi.mock('../lib/advertisingConsent', () => ({
  getAdvertisingConsent: () => state.consent,
  subscribeAdvertisingConsent: (listener) => { state.listeners.add(listener); return () => state.listeners.delete(listener); },
}));

const receipt = { verified: true, livemode: true, transaction_id: '88000000-0000-4000-8000-000000000001', amount_total_cents: 11900, currency: 'EUR' };
function Probe({ sessionId = 'cs_live_purchase' }) { useGoogleAdsPurchase(sessionId); return <p>Confirmation conservée</p>; }
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function consent(value) { act(() => { state.consent = value; state.listeners.forEach((listener) => listener()); }); }

describe('conversion achat fondée exclusivement sur un reçu serveur', () => {
  beforeEach(() => {
    vi.useFakeTimers(); state.consent = 'granted'; state.user = { id: 'user-one' }; state.loading = false;
    state.enabled = true; state.invoke.mockReset(); state.send.mockReset();
    state.invoke.mockResolvedValue({ data: { receipt }, error: null }); state.send.mockResolvedValue({ status: 'handoff' });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('transmet exactement le reçu live, montant et identifiant stables', async () => {
    render(<Probe />); await tick();
    expect(state.invoke).toHaveBeenCalledWith('get-purchase-conversion-receipt', expect.objectContaining({ body: { session_id: 'cs_live_purchase' }, signal: expect.any(AbortSignal) }));
    expect(state.send).toHaveBeenCalledOnce(); expect(state.send).toHaveBeenCalledWith(receipt);
  });

  it.each(['unknown', 'denied'])('ne lit aucun paiement si consentement %s, même avec ancien cookie', async (value) => {
    document.cookie = 'FormaPromptCookieConsent=true'; state.consent = value;
    render(<Probe />); await tick(20000);
    expect(state.invoke).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
    document.cookie = 'FormaPromptCookieConsent=; Max-Age=0';
  });

  it.each(['cs_test_purchase', null, 'cs_live_', 'cs_live_bad?status=paid'])('rejette session %s avant toute lecture', async (sessionId) => {
    render(<Probe sessionId={sessionId} />); await tick(); expect(state.invoke).not.toHaveBeenCalled();
  });

  it.each(['missing', 'anonymous', 'loading', 'disabled'])('attend les préconditions %s', async (condition) => {
    if (condition === 'missing') state.user = null;
    if (condition === 'anonymous') state.user = { id: 'anonymous', is_anonymous: true };
    if (condition === 'loading') state.loading = true;
    if (condition === 'disabled') state.enabled = false;
    render(<Probe />); await tick(); expect(state.invoke).not.toHaveBeenCalled();
  });

  it('commence uniquement après accord explicite et restauration auth', async () => {
    state.consent = 'unknown'; state.loading = true; const view = render(<Probe />);
    consent('granted'); await tick(); expect(state.invoke).not.toHaveBeenCalled();
    state.loading = false; view.rerender(<Probe />); await tick(); expect(state.send).toHaveBeenCalledOnce();
  });

  it('borne les reçus pending à dix lectures sans conversion', async () => {
    state.invoke.mockResolvedValue({ data: { receipt: null }, error: null });
    render(<Probe />); await tick(30000);
    expect(state.invoke).toHaveBeenCalledTimes(10); expect(state.send).not.toHaveBeenCalled();
  });

  it('ne transmet aucun reçu pour une session d’autrui refusée par le serveur', async () => {
    state.invoke.mockResolvedValue({ data: { receipt: null }, error: null });
    render(<Probe sessionId="cs_live_other_owner" />); await tick(30000);
    expect(state.send).not.toHaveBeenCalled();
  });

  it.each(['handoff', 'unavailable', 'duplicate', 'cancelled'])('un résultat transport %s ne modifie pas la confirmation', async (status) => {
    state.send.mockResolvedValue({ status }); const view = render(<Probe />); await tick(20000);
    expect(view.getByText('Confirmation conservée')).toBeVisible(); expect(state.invoke).toHaveBeenCalledOnce();
  });

  it('poll uniquement pending puis transmet le montant du reçu sans prix fixe', async () => {
    state.invoke.mockResolvedValueOnce({ data: { receipt: null }, error: null })
      .mockResolvedValueOnce({ data: { receipt: { ...receipt, amount_total_cents: 4900 } }, error: null });
    render(<Probe />); await tick(1500);
    expect(state.send).toHaveBeenCalledWith({ ...receipt, amount_total_cents: 4900 });
  });

  it.each([{ ...receipt, livemode: false }, { ...receipt, amount_total_cents: '11900' }, { status: 'cancelled' }, undefined])('rejette un reçu invalide sans refetch', async (invalid) => {
    state.invoke.mockResolvedValue({ data: { receipt: invalid }, error: null });
    render(<Probe />); await tick(20000); expect(state.invoke).toHaveBeenCalledOnce(); expect(state.send).not.toHaveBeenCalled();
  });

  it('StrictMode ne double pas une demande en attente', async () => {
    state.invoke.mockImplementation(() => new Promise(() => {}));
    render(<StrictMode><Probe /></StrictMode>); await tick(); expect(state.invoke).toHaveBeenCalledOnce();
  });

  it.each(['unmount', 'consent', 'user', 'session'])('annule la demande obsolète après %s', async (change) => {
    let resolve; state.invoke.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(<Probe />); await tick(); const signal = state.invoke.mock.calls[0][1].signal;
    if (change === 'unmount') view.unmount();
    if (change === 'consent') consent('denied');
    if (change === 'user') { state.user = { id: 'user-two' }; view.rerender(<Probe />); }
    if (change === 'session') view.rerender(<Probe sessionId="cs_live_other" />);
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ data: { receipt }, error: null }); });
    expect(state.send).not.toHaveBeenCalled(); view.unmount(); await tick(20000);
    expect(state.invoke).toHaveBeenCalledOnce();
  });

  it('abandonne une demande trop longue sans conversion tardive', async () => {
    let resolve; state.invoke.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<Probe />); await tick(5000); expect(state.invoke.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolve({ data: { receipt }, error: null }); }); expect(state.send).not.toHaveBeenCalled();
  });

  it.each(['error', 'reject', 'send-reject'])('garde les erreurs %s non bloquantes', async (kind) => {
    if (kind === 'error') state.invoke.mockResolvedValue({ data: null, error: new Error('unavailable') });
    if (kind === 'reject') state.invoke.mockRejectedValue(new Error('unavailable'));
    if (kind === 'send-reject') state.send.mockRejectedValue(new Error('unavailable'));
    const view = render(<Probe />); await tick(20000);
    expect(view.getByText('Confirmation conservée')).toBeVisible(); expect(state.invoke).toHaveBeenCalledOnce();
  });
});
