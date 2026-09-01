import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticIA from './DiagnosticIA'
import { useAuth } from '../contexts/useAuth'

const { createCheckout, validatePromotion } = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  validatePromotion: vi.fn(),
}))

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../lib/diagnosticCheckout', () => ({
  createDiagnosticCheckout: createCheckout,
  validateDiagnosticPromotion: validatePromotion,
}))
vi.mock('../components/SEO', () => ({
  default: ({ title, description, url, jsonLd }) => (
    <div
      data-testid="diagnostic-seo"
      data-title={title}
      data-description={description}
      data-url={url}
      data-schema={jsonLd?.['@graph']?.find((item) => item['@type'] === 'Service')?.['@type']}
    />
  ),
}))

function renderPage() {
  return render(<MemoryRouter><DiagnosticIA /></MemoryRouter>)
}

describe('page commerciale Diagnostic IA Express', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: null, loading: false })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    createCheckout.mockReset()
    validatePromotion.mockReset()
  })

  it('présente l’offre gelée, son résultat et ses limites', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Diagnostic IA Express' })).toBeVisible()
    expect(screen.getByText(/Identifiez en 90 minutes où l'IA peut réellement vous faire gagner du temps/i)).toBeVisible()
    expect(screen.getAllByText('149 €').length).toBeGreaterThan(0)
    expect(screen.getByText('TVA non applicable - article 293 B du CGI')).toBeVisible()
    expect(screen.getAllByText(/trois opportunités/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /Tout ne doit pas être automatisé/i })).toBeVisible()
    expect(screen.getByText('Installation complète de n8n')).toBeVisible()
    expect(screen.getByText('Développement logiciel sur mesure')).toBeVisible()
    expect(screen.getByText('Après paiement, vous choisissez votre créneau parmi mes disponibilités.')).toBeVisible()
  })

  it('oriente un visiteur non connecté vers l’authentification sans checkout', () => {
    renderPage()

    const heroCta = within(document.querySelector('.diagnostic-ia-hero')).getByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })
    expect(heroCta).toHaveAttribute('href', '#reserver')

    const cta = within(document.querySelector('.diagnostic-ia-price-card')).getByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })
    expect(cta).toHaveAttribute('href', '/login?redirect=%2Fdiagnostic-ia%23reserver')
    expect(cta).toHaveAttribute('aria-describedby', 'diagnostic-payment-status')
    expect(screen.getByText(/Après connexion, une éventuelle remise validée/i)).toBeVisible()
    expect(document.querySelector('form')).not.toBeInTheDocument()
  })

  it('exige les CGV avant d’ouvrir le checkout pour une session connectée', async () => {
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    const button = priceCard.getByRole('button', { name: /Réserver mon Diagnostic IA Express - 149(?:,00)?\s€?/i })
    expect(button).toBeDisabled()
    expect(priceCard.getByRole('link', { name: /Conditions générales de vente/i })).toHaveAttribute(
      'href',
      '/cgv-particuliers?version=CGV-B2C-2026-08-26',
    )
    await userEvent.click(priceCard.getByRole('checkbox'))
    expect(button).toBeEnabled()
    expect(priceCard.queryByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })).not.toBeInTheDocument()
  })

  it('appelle le checkout dédié sans montant ni identité fournis par le frontend', async () => {
    createCheckout.mockResolvedValue({})
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    await userEvent.click(priceCard.getByRole('radio', { name: /cadre professionnel/i }))
    expect(priceCard.getByRole('link', { name: /Conditions générales de vente/i })).toHaveAttribute(
      'href',
      '/cgv-professionnels?version=CGV-B2B-2026-08-26',
    )
    await userEvent.click(priceCard.getByRole('checkbox'))
    await userEvent.click(priceCard.getByRole('button', { name: /Réserver mon Diagnostic IA Express - 149(?:,00)?\s€?/i }))

    expect(createCheckout).toHaveBeenCalledWith(expect.anything(), {
      sales_context: 'professional',
      cgv_accepted: true,
      cgv_version: 'CGV-B2B-2026-08-26',
    })
    const payload = createCheckout.mock.calls[0][1]
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('user_id')
  })

  it('valide un code côté serveur puis affiche le détail monétaire', async () => {
    validatePromotion.mockResolvedValue({
      valid: true,
      code: 'DIAG10',
      catalog_amount_cents: 14_900,
      discount_amount_cents: 1_490,
      final_amount_cents: 13_410,
      message: 'Code promotionnel appliqué.',
    })
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    await userEvent.type(priceCard.getByLabelText(/Code promotionnel/i), ' diag10 ')
    await userEvent.click(priceCard.getByRole('button', { name: 'Vérifier' }))

    expect(validatePromotion).toHaveBeenCalledWith(expect.anything(), ' diag10 ')
    expect(await priceCard.findByText('Code promotionnel appliqué.')).toBeVisible()
    expect(priceCard.getAllByText(/134,10/).length).toBeGreaterThan(0)
    expect(priceCard.getByText(/14,90/)).toBeVisible()
  })

  it('n envoie que le code validé et invalide l estimation lorsqu il change', async () => {
    validatePromotion.mockResolvedValue({
      valid: true,
      code: 'DIAG10',
      catalog_amount_cents: 14_900,
      discount_amount_cents: 1_490,
      final_amount_cents: 13_410,
      message: 'Code promotionnel appliqué.',
    })
    createCheckout.mockResolvedValue({})
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    const input = priceCard.getByLabelText(/Code promotionnel/i)
    await userEvent.type(input, 'DIAG10')
    await userEvent.click(priceCard.getByRole('button', { name: 'Vérifier' }))
    await userEvent.click(priceCard.getByRole('checkbox'))
    await userEvent.click(priceCard.getByRole('button', { name: /Réserver mon Diagnostic IA Express/i }))

    expect(createCheckout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ promo_code: 'DIAG10' }))
    const payload = createCheckout.mock.calls[0][1]
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('email')

    await userEvent.type(input, 'B')
    expect(priceCard.queryByText('Code promotionnel appliqué.')).not.toBeInTheDocument()
    expect(priceCard.getAllByText(/149,00/).length).toBeGreaterThan(0)
  })

  it('affiche le même refus générique pour un code indisponible', async () => {
    validatePromotion.mockResolvedValue({
      valid: false,
      code: null,
      catalog_amount_cents: 14_900,
      discount_amount_cents: 0,
      final_amount_cents: 14_900,
      message: "Ce code n'est pas valide ou n'est plus disponible.",
    })
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    await userEvent.type(priceCard.getByLabelText(/Code promotionnel/i), 'INCONNU')
    await userEvent.click(priceCard.getByRole('button', { name: 'Vérifier' }))
    expect(await priceCard.findByRole('alert')).toHaveTextContent("Ce code n'est pas valide ou n'est plus disponible.")
  })

  it('affiche un chargement puis une erreur contrôlée sans faux paiement', async () => {
    let rejectCheckout
    createCheckout.mockImplementation(() => new Promise((resolve, reject) => {
      rejectCheckout = reject
    }))
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    await userEvent.click(priceCard.getByRole('checkbox'))
    await userEvent.click(priceCard.getByRole('button', { name: /Réserver mon Diagnostic IA Express/i }))
    expect(priceCard.getByRole('button', { name: /Ouverture du paiement sécurisé/i })).toBeDisabled()

    rejectCheckout(new Error('Paiement test indisponible.'))
    expect(await priceCard.findByRole('alert')).toHaveTextContent('Paiement test indisponible.')
    expect(priceCard.queryByText(/Paiement confirmé/i)).not.toBeInTheDocument()
  })

  it('publie des métadonnées dédiées et un schéma Service', () => {
    renderPage()

    const seo = screen.getByTestId('diagnostic-seo')
    expect(seo).toHaveAttribute('data-url', 'https://formaprompt.com/diagnostic-ia')
    expect(seo).toHaveAttribute('data-title', expect.stringContaining('Diagnostic IA Express'))
    expect(seo).toHaveAttribute('data-description', expect.stringContaining('90 minutes'))
    expect(seo).toHaveAttribute('data-schema', 'Service')
  })
})
