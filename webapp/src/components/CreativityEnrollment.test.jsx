import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import CreativityEnrollment from './CreativityEnrollment';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), auth: { user: { id: 'local-user' } } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
afterEach(() => { cleanup(); mocks.invoke.mockReset(); mocks.auth.user = { id: 'local-user' }; vi.restoreAllMocks(); });
const mount = () => render(<MemoryRouter><CreativityEnrollment /></MemoryRouter>);
it('préserve le retour à la formation après connexion', () => {
  mocks.auth.user = null;
  mount();
  expect(screen.getAllByRole('link', { name: /Se connecter pour acheter/ })).toHaveLength(3);
  for (const link of screen.getAllByRole('link', { name: /Se connecter pour acheter/ })) {
    expect(link).toHaveAttribute('href', '/login?redirect=%2Fformation-ia-creativite%23inscription');
  }
});

it('propose trois paiements fixes et précise l’ouverture conditionnelle du groupe avec remboursement intégral', () => {
  const { container } = mount();
  expect(screen.getByText(/Remboursement intégral si le groupe n’ouvre pas/)).toHaveTextContent('six maximum');
  expect(screen.getAllByRole('button', { name: /Commander et payer/ })).toHaveLength(3);
  const group = screen.getByRole('heading', { name: 'Groupe ouvert' }).closest('article');
  expect(within(group).getByRole('button', { name: /Commander et payer.*690/ })).toBeInTheDocument();
  expect(within(group).getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.getAllByLabelText('Code promotionnel')).toHaveLength(3);
  expect(container.textContent).not.toMatch(/devis|OPCO|composante numérique/);
  expect(mocks.invoke).not.toHaveBeenCalled();
});


it('vérifie un code côté serveur et affiche la remise du groupe au montant exact', async () => {
  mocks.invoke.mockResolvedValue({ data: {
    valid: true, code: 'ATELIER20', catalog_amount_cents: 69000,
    discount_amount_cents: 13800, final_amount_cents: 55200,
    message: 'Code promotionnel appliqué.',
  }, error: null });
  mount();
  const group = within(screen.getByRole('heading', { name: 'Groupe ouvert' }).closest('article'));
  await userEvent.type(group.getByRole('textbox', { name: 'Code promotionnel' }), 'ATELIER20');
  await userEvent.click(group.getByRole('button', { name: 'Vérifier' }));
  expect(await group.findByText('Code promotionnel appliqué.')).toBeVisible();
  expect(group.getByText('690,00 €')).toBeVisible();
  expect(group.getByText('− 138,00 €')).toBeVisible();
  expect(group.getByText('552,00 €')).toBeVisible();
  expect(mocks.invoke).toHaveBeenCalledWith('validate-course-promotion', {
    body: { course_id: 'ia-creativite-groupe', promo_code: 'ATELIER20' },
  });
});

it('envoie une commande groupe après CGV et commencement du service, sans contenu numérique', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.invoke.mockResolvedValue({ data: { url: 'invalid-for-test' }, error: null });
  mount();
  const view = within(screen.getByRole('heading', { name: 'Groupe ouvert' }).closest('article'));
  for (const checkbox of view.getAllByRole('checkbox')) await userEvent.click(checkbox);
  await userEvent.click(view.getByRole('button', { name: /Commander et payer.*690/ }));
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(mocks.invoke).toHaveBeenCalledWith('create-checkout', { body: expect.objectContaining({
    course_id: 'ia-creativite-groupe', promo_code: null,
    checkout_context: expect.objectContaining({ sales_context: 'personal', access_start_choice: 'immediate' }),
    consents: expect.objectContaining({ cgv_acceptance: true, early_service_start: true, digital_content_start: false, digital_content_withdrawal_acknowledgement: false }),
  }) });
});

it('exige l’organisation du forfait collectif et envoie une seule commande de service', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.invoke.mockResolvedValue({ data: { url: 'invalid-for-test' }, error: null });
  mount();
  const collective = screen.getByRole('heading', { name: 'École ou association' }).closest('article');
  const view = within(collective);
  expect(view.queryByLabelText('Adresse e-mail du bénéficiaire')).not.toBeInTheDocument();
  await userEvent.click(view.getByRole('checkbox'));
  await userEvent.click(view.getByRole('button', { name: /Commander et payer/ }));
  expect(view.getByRole('alert')).toHaveTextContent('organisation acheteuse');
  expect(mocks.invoke).not.toHaveBeenCalled();
  await userEvent.type(view.getByLabelText('Organisation acheteuse'), 'École de création');
  await userEvent.click(view.getByRole('button', { name: /Commander et payer/ }));
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(mocks.invoke).toHaveBeenCalledWith('create-checkout', { body: expect.objectContaining({
    course_id: 'ia-creativite-ecole-association', promo_code: null,
    checkout_context: { sales_context: 'professional_self', access_start_choice: null, beneficiary_email: null, buyer_organization_name: 'École de création' },
    consents: expect.objectContaining({ cgv_acceptance: true, early_service_start: false, digital_content_start: false, digital_content_withdrawal_acknowledgement: false }),
  }) });
});

it('explique les trois organisations de service et respecte l’activation différée', () => {
  mount();
  expect(screen.getByText(/Choisissez ensuite une session de groupe publiée/)).toBeInTheDocument();
  expect(screen.getByText(/calendrier des 14 heures individuelles/)).toBeInTheDocument();
  expect(screen.getByText(/Les dates et les participants sont convenus ensuite avec votre école/)).toBeInTheDocument();
  expect(screen.getByText(/dès l’activation de votre droit/)).toBeInTheDocument();
});
