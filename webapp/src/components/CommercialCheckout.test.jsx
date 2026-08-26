import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CommercialCheckout from './CommercialCheckout'
import { AI_ACT_PURCHASE, SALES_CONTEXTS } from '../../supabase/functions/_shared/purchaseConfig.js'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke } },
}))

function renderCheckout(access = {}, user = { id: 'user-test' }) {
  return render(
    <MemoryRouter>
      <CommercialCheckout
        courseId={AI_ACT_PURCHASE.courseId}
        user={user}
        accessLoading={access.accessLoading ?? false}
        hasActiveAccess={access.hasActiveAccess ?? false}
        activeAccessActions={<span>Accès actif</span>}
        priceLabel="187 €"
      />
    </MemoryRouter>,
  )
}

async function acceptAllVisibleConsents() {
  for (const checkbox of screen.getAllByRole('checkbox')) await userEvent.click(checkbox)
}

describe('CommercialCheckout', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    invoke.mockReset()
  })

  it('affiche la qualification et conserve une action d’achat pour un visiteur', () => {
    renderCheckout({}, null)
    expect(screen.getByRole('group', { name: /vous achetez cette formation/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /se connecter pour acheter.*187 €/i })).toBeVisible()
    expect(screen.queryByText(/temporairement indisponible/i)).not.toBeInTheDocument()
  })

  it('conserve les actions pédagogiques d un apprenant déjà autorisé', () => {
    renderCheckout({ hasActiveAccess: true })
    expect(screen.getByText('Accès actif')).toBeVisible()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('exige séparément les CGV B2C et les consentements de commencement immédiat', async () => {
    renderCheckout()
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /conditions générales de vente/i })).toHaveAttribute(
      'href',
      '/cgv-particuliers?version=CGV-B2C-2026-08-26',
    )
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cgv_acceptance/)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('envoie à create-checkout le contexte particulier validé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    invoke.mockResolvedValue({ data: { url: 'invalid-for-test' }, error: null })
    renderCheckout()
    await acceptAllVisibleConsents()
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(invoke).toHaveBeenCalledWith('create-checkout', {
      body: expect.objectContaining({
        course_id: AI_ACT_PURCHASE.courseId,
        checkout_context: expect.objectContaining({
          sales_context: SALES_CONTEXTS.PERSONAL,
          access_start_choice: 'immediate',
        }),
        consents: expect.objectContaining({
          cgv_version: 'CGV-B2C-2026-08-26',
          cgv_acceptance: true,
          early_service_start: true,
          digital_content_start: true,
          digital_content_withdrawal_acknowledgement: true,
        }),
      }),
    })
  })

  it('utilise les CGV B2B sans consentement B2C inutile pour le professionnel', async () => {
    renderCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /cadre professionnel/i }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /conditions générales de vente/i })).toHaveAttribute(
      'href',
      '/cgv-professionnels?version=CGV-B2B-2026-08-26',
    )
    expect(screen.queryByText(/perte du droit de rétractation/i)).not.toBeInTheDocument()
  })

  it('permet le paiement bénéficiaire après les informations obligatoires sans attribuer immédiatement l’accès', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    invoke.mockResolvedValue({ data: { url: 'invalid-for-test' }, error: null })
    renderCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /salarié ou un autre bénéficiaire/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /organisation acheteuse/i }), 'Entreprise Test')
    await userEvent.type(screen.getByRole('textbox', { name: /adresse e-mail du bénéficiaire/i }), 'test@example.com')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(invoke).toHaveBeenCalledWith('create-checkout', {
      body: expect.objectContaining({
        checkout_context: expect.objectContaining({
          sales_context: SALES_CONTEXTS.BENEFICIARY,
          beneficiary_email: 'test@example.com',
          buyer_organization_name: 'Entreprise Test',
        }),
      }),
    })
  })

  it('oriente uniquement le parcours OPCO vers devis et convention', async () => {
    renderCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /financement opco/i }))
    expect(screen.getByRole('link', { name: /demander un devis/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /commander et payer/i })).not.toBeInTheDocument()
  })

  it('permet au particulier de payer en différant l’accès sans consentements de démarrage', async () => {
    renderCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /différer l’accès pédagogique/i }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /commander et payer/i })).toBeVisible()
  })
})
