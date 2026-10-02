import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccess from './PaymentSuccess';
import DiagnosticPaymentConfirmation from './DiagnosticPaymentConfirmation';
import { BUREAUTIQUE_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('../hooks/useGoogleAdsPurchase', () => ({ useGoogleAdsPurchase: track }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../components/BureautiquePurchaseConfirmation', () => ({ default: () => <p>Confirmation bureautique</p> }));

describe('branchement conversion des seules pages confirmation', () => {
  beforeEach(() => { track.mockClear(); });
  afterEach(cleanup);

  it('transmet la session même pour la branche bureautique au niveau parent', () => {
    const course = Object.keys(BUREAUTIQUE_PURCHASES)[0];
    render(<MemoryRouter initialEntries={[`/paiement-reussi?course=${course}&session_id=cs_live_office`]}><PaymentSuccess /></MemoryRouter>);
    expect(track).toHaveBeenCalledWith('cs_live_office');
  });

  it('transmet la session des formations existantes sans utiliser course_access', () => {
    render(<MemoryRouter initialEntries={['/paiement-reussi?session_id=cs_live_course']}><PaymentSuccess /></MemoryRouter>);
    expect(track).toHaveBeenCalledWith('cs_live_course');
  });

  it('transmet uniquement session_id pour le Diagnostic, pas order_id ni prix URL', () => {
    render(<MemoryRouter initialEntries={['/diagnostic-ia/confirmation?session_id=cs_live_diag&order_id=88000000-0000-4000-8000-000000000001&amount=119']}><DiagnosticPaymentConfirmation /></MemoryRouter>);
    expect(track).toHaveBeenCalledWith('cs_live_diag');
  });
});
