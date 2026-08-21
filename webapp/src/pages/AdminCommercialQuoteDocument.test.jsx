import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminCommercialQuoteDocument from './AdminCommercialQuoteDocument';

const quote = {
  id: '00000000-0000-4000-8000-000000000001', quote_number: 'FP-2026-000001', status: 'sent',
  sent_snapshot: { quoteNumber: 'FP-2026-000001', createdAt: '2026-08-21T10:00:00Z', validUntil: '2026-09-21', provider: { legalName: 'Thierry FREZARD EI', address: '6 rue Webster', siret: '511 151 615 00016', activityDeclaration: '32620346362', email: 'thierry@formaprompt.com' }, client: { name: 'Entreprise Exemple', email: 'contact@example.test', organizationName: null }, beneficiary: { name: null, email: null }, course: { title: 'IA générative' }, pricing: { quantity: 1, unitPriceCents: 49700, totalPriceCents: 49700, taxStatement: 'TVA non applicable - article 293 B du CGI' } },
};

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' }, role: 'admin' }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: quote, error: null }) }) }) }) } }));

describe('document de devis commercial', () => {
  afterEach(cleanup);
  it('rend la version figée envoyée et une action d impression', async () => {
    render(<MemoryRouter initialEntries={[`/admin/commercial/devis/${quote.id}`]}><Routes><Route path="/admin/commercial/devis/:quoteId" element={<AdminCommercialQuoteDocument />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /FP-2026-000001/ })).toBeVisible();
    expect(screen.getByText(/TVA non applicable/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeVisible();
  });
});
