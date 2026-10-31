import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const api = vi.hoisted(() => ({ role: 'admin', invoke: vi.fn(), requests: [] }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-test' }, role: api.role }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {
  from: (table) => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      then: (resolve) => Promise.resolve({ data: table === 'contact_requests' ? api.requests : [], error: null }).then(resolve),
    };
    return query;
  },
  functions: { invoke: api.invoke },
} }));
import AdminCommercial from './AdminCommercial';

describe('réponse client indépendante du devis dans le cycle commercial', () => {
  beforeEach(() => {
    api.role = 'admin';
    api.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
    api.requests = [
      { id: 'request-a', name: 'Client A', email: 'a@example.test', subject: 'Programme', message: 'Puis-je recevoir le programme ?', status: 'new', request_type: 'individual', created_at: '2026-10-31T09:00:00Z' },
      { id: 'request-b', name: 'Client B', email: 'b@example.test', subject: 'Déroulé', message: 'Quels horaires ?', status: 'processing', request_type: 'individual', created_at: '2026-10-31T08:00:00Z' },
    ];
  });
  afterEach(cleanup);

  it('ouvre la composition pour la demande choisie sans appeler une fonction d’envoi', async () => {
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Répondre au client' }));
    expect(screen.getByLabelText('Destinataire')).toHaveValue('a@example.test');
    fireEvent.click(screen.getByRole('button', { name: /Client B/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Répondre au client' }));
    expect(screen.getByLabelText('Destinataire')).toHaveValue('b@example.test');
    expect(screen.getByLabelText('Votre message')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Créer le devis' })).toBeEnabled();
    expect(api.invoke.mock.calls.every(([name])=>name==='admin-email-notifications')).toBe(true);
  });

  it('conserve l’action de création du devis et son destinataire', async () => {
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Créer le devis' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', expect.objectContaining({ body: expect.objectContaining({ action: 'create_quote', requestId: 'request-a', quote: expect.objectContaining({ clientEmail: 'a@example.test' }) }) }));
    await screen.findByRole('button', { name: 'Répondre au client' });
    expect(api.requests[0].status).toBe('new');
  });

  it('ne présente pas l’action au personnel sans rôle administrateur', async () => {
    api.role = 'employee';
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    await screen.findByText('Puis-je recevoir le programme ?');
    expect(screen.queryByRole('button', { name: 'Répondre au client' })).not.toBeInTheDocument();
    expect(api.invoke).not.toHaveBeenCalled();
  });
});
