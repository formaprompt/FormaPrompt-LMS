import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const api = vi.hoisted(() => ({ role: 'admin', invoke: vi.fn(), requests: [], blocked: [], communications: [], followUps: [], unblock: vi.fn() }));
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
          : table === 'contact_email_blocks' ? api.blocked
            : table === 'commercial_communications' ? api.communications
              : table === 'commercial_follow_ups' ? api.followUps : [];
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
    api.communications = [];
    api.followUps = [];
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

  it('annule la relance sans envoyer de mail et permet de retirer le test après confirmation', async () => {
    const relance = { id: 'follow-1', contact_request_id: 'request-a', status: 'scheduled', subject: 'Relance de test', scheduled_for: '2026-12-01T09:00:00Z' };
    api.followUps = [relance];
    api.invoke.mockImplementation(async (_, { body }) => {
      if (body.action === 'cancel_follow_up') relance.status = 'cancelled';
      if (body.action === 'delete_test_follow_up') api.followUps = [];
      return { data: {}, error: null };
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Communications et relances'));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la relance' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'cancel_follow_up', requestId: 'request-a', itemId: 'follow-1' } });
    const remove = await screen.findByRole('button', { name: 'Supprimer le test' });
    expect(screen.getByText('Relance annulée', { exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Déclencher l’envoi' })).not.toBeInTheDocument();
    fireEvent.click(remove);
    expect(api.invoke.mock.calls.some(([, options]) => options.body.action === 'delete_test_follow_up')).toBe(false);
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Relance de test supprimée.')).toBeVisible();
    expect(api.invoke.mock.calls.some(([, options]) => options.body.action === 'send_follow_up')).toBe(false);
  });

  it('propose le retrait des tests quel que soit le type de communication et protège les envois', async () => {
    const common = { contact_request_id: 'request-a', direction: 'outbound', prepared_at: '2026-11-20T09:00:00Z' };
    api.communications = [
      { ...common, id: 'sent', subject: 'Envoi confirmé du devis', communication_type: 'quote', delivery_status: 'sent' },
      { ...common, id: 'ambiguous', subject: 'Relance à vérifier', communication_type: 'follow_up', delivery_status: 'failed', error_code: 'smtp_delivery_uncertain' },
      { ...common, id: 'failed', subject: 'Devis de test', communication_type: 'quote', delivery_status: 'failed', error_code: 'smtp_rejected_550' },
      { ...common, id: 'draft', subject: 'Réponse de test', communication_type: 'information', delivery_status: 'prepared' },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.invoke.mockImplementation(async (_, { body }) => {
      if (body.action === 'delete_test_communication') api.communications = api.communications.filter((mail) => mail.id !== body.itemId);
      return { data: {}, error: null };
    });
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Communications et relances'));
    const mail = (subject) => within(screen.getByText(new RegExp(subject)).closest('article'));
    expect(mail('Envoi confirmé du devis').queryByRole('button', { name: 'Supprimer le test' })).not.toBeInTheDocument();
    expect(mail('Relance à vérifier').queryByRole('button', { name: 'Supprimer le test' })).not.toBeInTheDocument();
    expect(mail('Réponse de test').getByRole('button', { name: 'Supprimer le test' })).toBeEnabled();
    fireEvent.click(mail('Devis de test').getByRole('button', { name: 'Supprimer le test' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'delete_test_communication', requestId: 'request-a', itemId: 'failed' } });
    await waitFor(() => expect(screen.queryByText(/Devis de test/)).not.toBeInTheDocument());
    expect(screen.getByText(/Envoi confirmé du devis/)).toBeVisible();
  });

  it('supprime un spam déjà bloqué et affiche son e-mail envoyé dans l’historique', async () => {
    Object.assign(api.requests[0], { discarded_at: '2026-11-21T11:00:00Z', discarded_reason: 'spam' });
    Object.assign(api.requests[1], { discarded_at: '2026-11-21T10:00:00Z', discarded_reason: 'spam' });
    api.blocked = [{ email: 'a@example.test', expires_at: '2099-12-01T12:00:00Z' }];
    const sent = { id: 'mail-a', contact_request_id: 'request-a', recipient_email: 'a@example.test', subject: 'Mail conservé', communication_type: 'information', delivery_status: 'sent', prepared_at: '2026-11-20T09:00:00Z' };
    api.communications = [sent];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.invoke.mockImplementation(async (_, { body }) => {
      if (body.action === 'purge_blocked_spam') {
        api.requests = api.requests.filter((row) => row.id !== body.requestId);
        sent.contact_request_id = null;
      }
      return { data: {}, error: null };
    });
    render(<MemoryRouter><AdminCommercial /></MemoryRouter>);
    await screen.findByText('Aucune demande.');
    fireEvent.click(screen.getByRole('button', { name: 'Corbeille' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le spam bloqué' }));
    expect(api.invoke).toHaveBeenCalledWith('admin-commercial-cycle', { body: { action: 'purge_blocked_spam', requestId: 'request-a' } });
    fireEvent.click(await screen.findByText('Historique des e-mails des spams supprimés'));
    expect(screen.getByText('Mail conservé')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Client A/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le spam bloqué' })).not.toBeInTheDocument();
  });
});
