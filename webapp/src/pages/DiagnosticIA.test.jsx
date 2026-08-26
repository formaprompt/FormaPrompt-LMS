import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticIA from './DiagnosticIA'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
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
    expect(screen.getByText(/aucun paiement n'est déclenché à cette étape/i)).toBeVisible()
    expect(document.querySelector('form')).not.toBeInTheDocument()
  })

  it('n’invente pas de paiement pour une session déjà connectée', () => {
    useAuth.mockReturnValue({ user: { id: 'client-test' }, loading: false })
    renderPage()

    const priceCard = within(document.querySelector('.diagnostic-ia-price-card'))
    expect(priceCard.getByRole('button', { name: /Réserver mon Diagnostic IA Express - 149 €/i })).toBeDisabled()
    expect(priceCard.queryByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })).not.toBeInTheDocument()
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
