import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPromotions from './AdminPromotions';

const { rpcMock, authState } = vi.hoisted(() => ({ rpcMock: vi.fn(), authState: { role: 'admin' } }));

vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc: rpcMock } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' }, role: authState.role }) }));

const percentPromotion = {
  id: 'promo-1', code: 'PROMO10', description: 'Campagne formation', discount_type: 'percent',
  discount_value: 10, active: true, starts_at: null, ends_at: null, max_uses: 10,
  max_uses_per_user: 1, restricted_email: null, restricted_email_present: false,
  minimum_final_amount_cents: 0, targets: [{ target_type: 'course', target_key: 'formation-ia' }],
  consumed_uses: 2, active_reservations: 1, released_uses: 1, remaining_uses: 7,
};

function renderPage() { return render(<AdminPromotions />); }

describe('AdminPromotions', () => {
  beforeEach(() => {
    authState.role = 'admin';
    rpcMock.mockResolvedValue({ data: [percentPromotion], error: null });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup(); rpcMock.mockReset(); vi.restoreAllMocks();
  });

  it('affiche le chargement, la liste, les remises et les utilisations', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    expect(await screen.findByText('PROMO10')).toBeVisible();
    const row = screen.getByText('PROMO10').closest('tr');
    expect(within(row).getByText('10 %')).toBeVisible();
    expect(row).toHaveTextContent('course / formation-ia');
    expect(row).toHaveTextContent('2 consommée');
    expect(row).toHaveTextContent('Active');
  });

  it('présente une erreur de chargement récupérable', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('permission denied');
    expect(within(alert).getByRole('button', { name: 'Réessayer' })).toBeEnabled();
  });

  it('affiche une remise fixe en euros', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{
      ...percentPromotion, id: 'promo-fixed', code: 'FIXE20', discount_type: 'fixed_amount', discount_value: 2000,
    }], error: null });
    renderPage();
    const row = (await screen.findByText('FIXE20')).closest('tr');
    expect(row).toHaveTextContent('20,00 €');
  });

  it('crée une promotion fixe multi-cible via une seule RPC', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: { id: 'promo-new' }, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    renderPage();
    await screen.findByText('Aucune promotion enregistrée.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer une promotion' }));
    expect(screen.queryByLabelText(/Diagnostic IA Express/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Code'), ' fixe20 ');
    await userEvent.selectOptions(screen.getByLabelText('Type de remise'), 'fixed_amount');
    await userEvent.type(screen.getByLabelText('Montant fixe (€)'), '20,00');
    await userEvent.click(screen.getByLabelText(/Formation IA générative/));
    await userEvent.click(screen.getByLabelText(/Formation IA Act/));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la promotion' }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('admin_create_promotion', expect.objectContaining({
      p_code: 'FIXE20', p_discount_type: 'fixed_amount', p_discount_value: 2000,
      p_targets: [
        { target_type: 'course', target_key: 'formation-ia' },
        { target_type: 'course', target_key: 'formation-ia-act' },
      ],
    })));
  });

  it('bloque localement les champs invalides avant le RPC serveur', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    renderPage();
    await screen.findByText('Aucune promotion enregistrée.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer une promotion' }));
    await userEvent.type(screen.getByLabelText('Code'), '***');
    await userEvent.type(screen.getByLabelText('Pourcentage'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la promotion' }));
    expect(await screen.findByText(/Saisissez un code stable/)).toBeVisible();
    expect(screen.getByText(/Sélectionnez au moins une cible/)).toBeVisible();
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('rend le code immuable en modification et confirme la désactivation', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [percentPromotion], error: null })
      .mockResolvedValueOnce({ data: { ...percentPromotion, active: false }, error: null })
      .mockResolvedValueOnce({ data: [{ ...percentPromotion, active: false }], error: null });
    renderPage();
    await screen.findByText('PROMO10');
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByLabelText(/^Code/)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('admin_set_promotion_active', {
      p_promo_code_id: 'promo-1', p_active: false,
    }));
  });

  it('modifie les paramètres et les cibles sans renvoyer le code ni l activation', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [percentPromotion], error: null })
      .mockResolvedValueOnce({ data: percentPromotion, error: null })
      .mockResolvedValueOnce({ data: [percentPromotion], error: null });
    renderPage();
    await screen.findByText('PROMO10');
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const description = screen.getByLabelText('Description');
    await userEvent.clear(description);
    await userEvent.type(description, 'Nouveau paramétrage');
    await userEvent.click(screen.getByLabelText(/Formation IA Act/));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la promotion' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('admin_update_promotion', expect.objectContaining({
      p_promo_code_id: 'promo-1', p_description: 'Nouveau paramétrage',
      p_targets: [
        { target_type: 'course', target_key: 'formation-ia' },
        { target_type: 'course', target_key: 'formation-ia-act' },
      ],
    })));
    const updateCall = rpcMock.mock.calls.find(([name]) => name === 'admin_update_promotion');
    expect(updateCall[1]).not.toHaveProperty('p_code');
    expect(updateCall[1]).not.toHaveProperty('p_active');
  });

  it('refuse l’interface à un utilisateur non administrateur', () => {
    authState.role = 'learner';
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('administrateur strict');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
