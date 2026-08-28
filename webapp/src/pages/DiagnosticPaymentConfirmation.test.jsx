import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticPaymentConfirmation from './DiagnosticPaymentConfirmation'
import { useAuth } from '../contexts/useAuth'

const { fetchOrder } = vi.hoisted(() => ({ fetchOrder: vi.fn() }))

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../lib/diagnosticCheckout', () => ({ fetchDiagnosticOrder: fetchOrder }))
vi.mock('../components/SEO', () => ({ default: () => null }))

function renderPage(path = '/diagnostic-ia/confirmation?session_id=cs_test_diagnostic') {
  return render(<MemoryRouter initialEntries={[path]}><DiagnosticPaymentConfirmation /></MemoryRouter>)
}

describe('retour Stripe du Diagnostic IA', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: 'user-test' } })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche le succès uniquement pour une commande payée côté serveur', async () => {
    fetchOrder.mockResolvedValue({ data: { id: '88000000-0000-4000-8000-000000000001', status: 'paid' }, error: null })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Paiement confirmé' })).toBeVisible()
    expect(screen.getByText(/La réservation de votre créneau sera disponible à l’étape suivante/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /Choisir mon créneau/i })).toHaveAttribute(
      'href',
      '/diagnostic-ia/reserver?order_id=88000000-0000-4000-8000-000000000001',
    )
  })

  it('ne transforme pas le retour navigateur en preuve de paiement', () => {
    fetchOrder.mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('heading', { name: /Confirmation du paiement en cours/i })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Paiement confirmé' })).not.toBeInTheDocument()
  })

  it('accepte une référence Checkout LIVE sans la transformer en preuve de paiement', () => {
    fetchOrder.mockImplementation(() => new Promise(() => {}))
    renderPage('/diagnostic-ia/confirmation?session_id=cs_live_diagnostic')
    expect(screen.getByRole('heading', { name: /Confirmation du paiement en cours/i })).toBeVisible()
    expect(fetchOrder).toHaveBeenCalledWith({}, { orderId: null, sessionId: 'cs_live_diagnostic' })
    expect(screen.queryByRole('heading', { name: 'Paiement confirmé' })).not.toBeInTheDocument()
  })

  it('refuse une référence Checkout qui n’est ni TEST ni LIVE', () => {
    renderPage('/diagnostic-ia/confirmation?session_id=cs_fake_diagnostic')
    expect(screen.getByRole('heading', { name: 'Référence de paiement absente' })).toBeVisible()
    expect(fetchOrder).not.toHaveBeenCalled()
  })

  it('n’affiche aucun succès pour une commande annulée', async () => {
    fetchOrder.mockResolvedValue({ data: { status: 'cancelled' }, error: null })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Paiement non confirmé' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Paiement confirmé' })).not.toBeInTheDocument()
  })

  it('demande une connexion avant toute lecture de commande', () => {
    useAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Connexion requise' })).toBeVisible()
    expect(fetchOrder).not.toHaveBeenCalled()
  })

  it('reste neutre pendant la restauration de la session utilisateur', () => {
    useAuth.mockReturnValue({ user: null, loading: true })
    renderPage()
    expect(screen.getByRole('heading', { name: /Confirmation du paiement en cours/i })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Connexion requise' })).not.toBeInTheDocument()
    expect(fetchOrder).not.toHaveBeenCalled()
  })
})
