import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
import AdminUserRoleControl from './AdminUserRoleControl';

const learner = { userId: 'fake-id', email: 'fake@example.test', fullName: 'Compte fictif', role: 'user' };
afterEach(cleanup);
function selectAndConfirm(role) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: role } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le rôle' }));
}

describe('contrôle de rôle', () => {
  it('ne sauvegarde ni à la sélection ni avant confirmation ciblée, puis bloque un double clic', async () => {
    let resolve;
    const updateRole = vi.fn(() => new Promise((done) => { resolve = done; }));
    const onSaved = vi.fn();
    render(<AdminUserRoleControl learner={learner} updateRole={updateRole} onSaved={onSaved} />);
    selectAndConfirm('admin');
    expect(updateRole).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Compte fictif : Apprenant → Administrateur');
    const confirm = screen.getByRole('button', { name: 'Confirmer le rôle' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(updateRole).toHaveBeenCalledTimes(1);
    expect(updateRole).toHaveBeenCalledWith({ userId: 'fake-id', role: 'admin', expectedRole: 'user' });
    resolve({ userId: 'fake-id', role: 'admin', protected: false, changed: true });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('annule une rétrogradation sans écriture', () => {
    const updateRole = vi.fn();
    render(<AdminUserRoleControl learner={{ ...learner, role: 'admin' }} updateRole={updateRole} />);
    selectAndConfirm('employee');
    expect(screen.getByRole('dialog')).toHaveTextContent('perdra ses droits administrateur');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateRole).not.toHaveBeenCalled();
  });

  it.each([{ email: 'THIERRY227@GMAIL.COM' }, { protected: true }])('bloque le compte protégé %j', (protection) => {
    render(<AdminUserRoleControl learner={{ ...learner, ...protection }} />);
    expect(screen.getByText('Compte protégé')).toBeVisible();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enregistrer le rôle' })).toBeDisabled();
  });

  it.each([
    [{ code: '40001' }, 'Le rôle a changé'],
    [{ code: '42501' }, 'Le serveur refuse'],
    [new Error('offline'), 'Le changement de rôle n’a pas pu être confirmé'],
  ])('affiche le refus %j sans annoncer un succès', async (error, text) => {
    const onSaved = vi.fn();
    const onPermissionDenied = vi.fn();
    render(<AdminUserRoleControl learner={learner} updateRole={vi.fn().mockRejectedValue(error)} onSaved={onSaved} onPermissionDenied={onPermissionDenied} />);
    selectAndConfirm('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rôle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onPermissionDenied).toHaveBeenCalledTimes(error.code === '42501' ? 1 : 0);
  });

  it('un refus propriétaire protège seulement le compte ciblé', async () => {
    const onPermissionDenied = vi.fn();
    render(<AdminUserRoleControl learner={{ ...learner, role: 'admin' }} updateRole={vi.fn().mockRejectedValue({ code: '42501', message: 'Le compte proprietaire est protege.' })} onPermissionDenied={onPermissionDenied} />);
    selectAndConfirm('user');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rôle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('protégé par le serveur');
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(onPermissionDenied).not.toHaveBeenCalled();
  });

  it('un conflit bloque la nouvelle écriture jusqu’à actualisation', async () => {
    const updateRole = vi.fn().mockRejectedValue({ code: '40001' });
    const onRefresh = vi.fn();
    render(<AdminUserRoleControl learner={learner} updateRole={updateRole} onRefresh={onRefresh} />);
    selectAndConfirm('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rôle' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser l’annuaire' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(updateRole).toHaveBeenCalledTimes(1);
  });

  it('une réponse réseau perdue bloque toute seconde demande jusqu’à vérification de l’annuaire', async () => {
    const updateRole = vi.fn().mockRejectedValue(new Error('response lost'));
    const onRefresh = vi.fn();
    render(<AdminUserRoleControl learner={learner} updateRole={updateRole} onRefresh={onRefresh} />);
    selectAndConfirm('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rôle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le changement de rôle n’a pas pu être confirmé. Actualisez l’annuaire pour vérifier le rôle.');
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enregistrer le rôle' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le rôle' }));
    expect(updateRole).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser l’annuaire' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(updateRole).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 'trainer'])('refuse un rôle initial absent ou inconnu : %s', (role) => {
    const updateRole = vi.fn();
    render(<AdminUserRoleControl learner={{ ...learner, role }} updateRole={updateRole} />);
    expect(screen.getByRole('alert')).toHaveTextContent('rôle actuel est inconnu');
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le rôle' }));
    expect(updateRole).not.toHaveBeenCalled();
  });

  it('permet de modifier un autre compte dont l’adresse profil imite Thierry quand le serveur confirme protected=false', async () => {
    const updateRole = vi.fn().mockResolvedValue({ userId: 'fake-id', role: 'employee', protected: false, changed: true });
    render(<AdminUserRoleControl learner={{ ...learner, email: 'thierry227@gmail.com', protected: false }} updateRole={updateRole} />);
    expect(screen.getByRole('combobox')).toBeEnabled();
    selectAndConfirm('employee');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rôle' }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledWith({ userId: 'fake-id', role: 'employee', expectedRole: 'user' }));
  });
});
