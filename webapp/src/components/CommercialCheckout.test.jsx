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
        checkout_request_id: expect.any(String),
        promo_code: null,
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

  it('valide un code côté serveur sans réserver puis affiche les montants retournés', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        valid: true,
        code: 'COURSE20',
        catalog_amount_cents: 18_700,
        discount_amount_cents: 3_740,
        final_amount_cents: 14_960,
        message: 'Code promotionnel appliqué.',
      },
      error: null,
    })
    renderCheckout()
    await userEvent.type(screen.getByRole('textbox', { name: /code promotionnel/i }), ' course20 ')
    await userEvent.click(screen.getByRole('button', { name: /vérifier/i }))
    expect(invoke).toHaveBeenCalledWith('validate-course-promotion', {
      body: { course_id: AI_ACT_PURCHASE.courseId, promo_code: ' course20 ' },
    })
    expect(await screen.findByText('Code promotionnel appliqué.')).toBeVisible()
    expect(screen.getByText('149,60 €')).toBeVisible()
    expect(screen.getByText('− 37,40 €')).toBeVisible()
  })

  it('ne transmet au checkout que le code validé et verrouille la configuration après la tentative', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    invoke
      .mockResolvedValueOnce({
        data: {
          valid: true,
          code: 'COURSE20',
          catalog_amount_cents: 18_700,
          discount_amount_cents: 3_740,
          final_amount_cents: 14_960,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { url: 'invalid-for-test' }, error: null })
    renderCheckout()
    const promoInput = screen.getByRole('textbox', { name: /code promotionnel/i })
    await userEvent.type(promoInput, 'course20')
    await userEvent.click(screen.getByRole('button', { name: /vérifier/i }))
    await acceptAllVisibleConsents()
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(invoke).toHaveBeenLastCalledWith('create-checkout', {
      body: expect.objectContaining({
        checkout_request_id: expect.any(String),
        promo_code: 'COURSE20',
      }),
    })
    expect(promoInput).toBeDisabled()
  })

  it('revient à un état modifiable si le code devient indisponible au moment du checkout', async () => {
    invoke
      .mockResolvedValueOnce({
        data: {
          valid: true,
          code: 'LASTONE',
          catalog_amount_cents: 18_700,
          discount_amount_cents: 1_870,
          final_amount_cents: 16_830,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          promotion_invalid: true,
          message: "Ce code n'est pas valide ou n'est plus disponible.",
        },
        error: null,
      })
    renderCheckout()
    const input = screen.getByRole('textbox', { name: /code promotionnel/i })
    await userEvent.type(input, 'LASTONE')
    await userEvent.click(screen.getByRole('button', { name: /vérifier/i }))
    await acceptAllVisibleConsents()
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(await screen.findByText("Ce code n'est pas valide ou n'est plus disponible.")).toBeVisible()
    expect(input).not.toBeDisabled()
  })

  it('déverrouille une nouvelle intention après un échec Stripe terminal contrôlé', async () => {
    const response = new Response(JSON.stringify({
      error: 'Cette tentative de paiement a échoué. Vous pouvez en démarrer une nouvelle.',
      checkout_context_reset: true,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    invoke.mockResolvedValueOnce({ data: null, error: { context: response } })
    renderCheckout()
    await acceptAllVisibleConsents()
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/démarrer une nouvelle/i)
    expect(screen.getByRole('textbox', { name: /code promotionnel/i })).not.toBeDisabled()
  })

  it('refuse de traiter un code saisi mais non validé', async () => {
    renderCheckout()
    await userEvent.type(screen.getByRole('textbox', { name: /code promotionnel/i }), 'COURSE20')
    await acceptAllVisibleConsents()
    await userEvent.click(screen.getByRole('button', { name: /commander et payer/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/vérifiez le code promotionnel/i)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('retourne au prix catalogue et invalide la validation quand le code change avant checkout', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        valid: true,
        code: 'COURSE20',
        catalog_amount_cents: 18_700,
        discount_amount_cents: 3_740,
        final_amount_cents: 14_960,
      },
      error: null,
    })
    renderCheckout()
    const input = screen.getByRole('textbox', { name: /code promotionnel/i })
    await userEvent.type(input, 'COURSE20')
    await userEvent.click(screen.getByRole('button', { name: /vérifier/i }))
    expect(await screen.findByText('149,60 €')).toBeVisible()
    await userEvent.type(input, 'B')
    expect(screen.queryByText('149,60 €')).not.toBeInTheDocument()
    expect(screen.getAllByText('187,00 €').length).toBeGreaterThan(0)
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
