import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const api = vi.hoisted(() => ({ role: 'admin', invoke: vi.fn(), requests: [], blocked: [], unblock: vi.fn() }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-test' }, role: api.role }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {
  from: (table) => {
    let discarded;
    const query = {
      select: () => query, order: () => query, eq: () => query,
      is: () => { discarded = false; return query; },
      not: () => { discarded = true; return query; },
      delete: () => ({ eq: (...args) => ({ select: () => ({ maybeSingle: () => api.unblock(...args) }) }) }),
      then: (resolve) => {
        const rows = table === 'contact_requests' ? api.requests.filter((row) => Boolean(row.discarded_at) === discarded)
          : table === 'contact_email_blocks' ? api.blocked : [];
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
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
    api.blocked = [];
    api.unblock.mockReset().mockImplementation(async (_column, email) => ({ data: { email }, error: null }));
    api.requests = [
      { id: 'request-a', name: 'Client A', email: 'a@example.test', subject: 'Programme', message: 'Puis-je recevoir le programme ?', status: 'new', request_type: 'individual', created_at: '2026-10-31T09:00:00Z' },
      { id: 'request-b', name: 'Client B', email: 'b@example.test', subject: 'Déroulé', message: 'Quels horaires ?', status: 'processing', request_type: 'individual', created_at: '2026-10-31T08:00:00Z' },
    ];
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
    expect(screen.queryByText('Retirer cette demande')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corbeille' })).not.toBeInTheDocument();
    expect(api.invoke).not.toHaveBeenCalled();
  });

  function mockModeration() {
    api.invoke.mockImplementation(async (name, options) => {
      if (name === 'admin-commercial-cycle' && options.body.action === 'moderate_request') {
        const { requestId, operation } = options.body;
        const row = api.requests.find((item) => item.id === requestId);
        if (operation === 'delete') api.requests = api.requests.filter((item) => item.id !== requestId);
        else if (operation === 'restore') Object.assign(row, { discarded_at: null, discarded_reason: null });
        else Object.assign(row, { discarded_at: '2026-11-21T11:00:00Z', discarded_reason: operation });
      }
      return { data: {}, error: null };
    });
  }

  it('écarte un spam avec blocage choisi, puis restaure sa demande sans débloquer implicitement', async () => {
    mockModeration();
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Retirer cette demande'));
    fireEvent.change(screen.getByLabelText('Motif du retrait'), { target: { value: 'spam' } });
    const block = screen.getByRole('checkbox', { name: /Bloquer a@example.test/ });
    expect(block).not.toBeChecked();
    fireEvent.click(block);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à la corbeille' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'moderate_request', requestId: 'request-a', operation: 'spam', blockEmail: true } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Client A/ })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Corbeille' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurer la demande' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'moderate_request', requestId: 'request-a', operation: 'restore', blockEmail: false } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Demandes' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Demandes' }));
    expect(await screen.findByRole('button', { name: /Client A/ })).toBeVisible();
    expect(api.unblock).not.toHaveBeenCalled();
  });

  it('retire un test sans proposer de blocage et exige une confirmation pour le supprimer', async () => {
    mockModeration();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Retirer cette demande'));
    fireEvent.change(screen.getByLabelText('Motif du retrait'), { target: { value: 'test' } });
    expect(screen.queryByRole('checkbox', { name: /Bloquer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à la corbeille' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'moderate_request', requestId: 'request-a', operation: 'test', blockEmail: false } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Corbeille' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Corbeille' }));
    const purge = await screen.findByRole('button', { name: 'Supprimer définitivement' });
    expect(screen.queryByRole('button', { name: 'Répondre au client' })).not.toBeInTheDocument();
    fireEvent.click(purge);
    expect(api.invoke).not.toHaveBeenCalledWith('admin-commercial-cycle', expect.objectContaining({ body: expect.objectContaining({ operation: 'delete' }) }));
    fireEvent.click(purge);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Demande supprimée définitivement.')).toBeVisible();
  });

  it('permet de lever un blocage indépendamment de la corbeille', async () => {
    api.blocked = [{ email: 'spam@example.test', expires_at: '2099-12-01T12:00:00Z' }];
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(screen.getByText('Adresses bloquées sur le formulaire'));
    fireEvent.click(await screen.findByRole('button', { name: 'Débloquer spam@example.test' }));
    expect(api.unblock).toHaveBeenCalledWith('email', 'spam@example.test');
    expect(await screen.findByText('Aucune adresse bloquée.')).toBeVisible();
  });
});
