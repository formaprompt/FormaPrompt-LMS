import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminStripePostPayment from './AdminStripePostPayment';

const { rpc, invoke, tables } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  tables: {
    stripe_payment_transactions: [{ id: 'tx-1', status: 'paid', amount_total: 18700, amount_refunded: 0, currency: 'eur', course_id: 'formation-ia-act', created_at: '2026-08-22T10:00:00Z', stripe_payment_intent_id: 'pi_test_1' }],
    stripe_refunds: [],
    stripe_disputes: [],
    stripe_reconciliation_cases: [{ id: 'case-1', case_type: 'duplicate_payment', status: 'pending', severity: 'critical', summary: 'Un second paiement a été détecté.', occurrence_count: 1, detected_at: '2026-08-22T10:00:00Z' }],
    audit_log: [],
  },
}));

function builder(table) {
  return {
    select() { return this; },
    eq() { return this; },
    ilike() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: tables[table] || [], error: null }); },
    maybeSingle() {
      return Promise.resolve({ data: table === 'profiles' ? { role: 'admin' } : null, error: null });
    },
  };
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    from: vi.fn((table) => builder(table)),
    rpc,
    functions: { invoke },
  },
}));

describe('AdminStripePostPayment', () => {
  afterEach(() => {
    cleanup();
    rpc.mockReset();
    invoke.mockReset();
  });

  it('affiche les registres sans proposer de remboursement Stripe', async () => {
    render(<MemoryRouter><AdminStripePostPayment /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /stripe après paiement/i })).toBeVisible();
    expect(await screen.findByText('pi_test_1')).toBeVisible();
    expect(screen.getByText(/aucun remboursement ni changement stripe/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /rembourser/i })).not.toBeInTheDocument();
  });

  it('exige une décision motivée pour examiner un doublon', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    render(<MemoryRouter><AdminStripePostPayment /></MemoryRouter>);
    await screen.findByRole('heading', { name: /stripe après paiement/i });
    await userEvent.click(screen.getByRole('button', { name: /réconciliation/i }));
    await userEvent.click(await screen.findByRole('button', { name: /traiter ce cas/i }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.type(screen.getByRole('textbox', { name: /motif administratif/i }), 'Doublon contrôlé avec les références Stripe.');
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_update_stripe_reconciliation_case', {
      p_case_id: 'case-1',
      p_status: 'reviewed',
      p_reason: 'Doublon contrôlé avec les références Stripe.',
    }));
  });
});
