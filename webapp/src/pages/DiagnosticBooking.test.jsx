import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticBooking from './DiagnosticBooking'
import { useAuth } from '../contexts/useAuth'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
const ORDER_ID = '88000000-0000-4000-8000-000000000001'
const CANDIDATE = {
  id: 'candidate-1',
  slot_ids: [
    '88000000-0000-4000-8000-000000000011',
    '88000000-0000-4000-8000-000000000012',
    '88000000-0000-4000-8000-000000000013',
  ],
  starts_at: '2026-09-03T08:00:00.000Z',
  ends_at: '2026-09-03T09:30:00.000Z',
  requires_early_start_consents: false,
}

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }))
vi.mock('../components/SEO', () => ({ default: () => null }))

function renderPage() {
  return render(<MemoryRouter initialEntries={[`/diagnostic-ia/reserver?order_id=${ORDER_ID}`]}><DiagnosticBooking /></MemoryRouter>)
}

describe('réservation frontend du Diagnostic IA', () => {
  beforeEach(() => useAuth.mockReturnValue({ user: { id: 'user-test' } }))

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche le chargement puis un créneau de 90 minutes', async () => {
    invoke.mockResolvedValue({ data: { candidates: [CANDIDATE] }, error: null })
    renderPage()
    expect(screen.getByText(/Chargement des créneaux/i)).toBeVisible()
    expect(await screen.findByText('10:00 – 11:30')).toBeVisible()
    expect(screen.getByText(/90 minutes · visioconférence/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmer ce créneau' })).toBeDisabled()
  })

  it('gère l’absence de créneau et permet une actualisation', async () => {
    invoke.mockResolvedValue({ data: { candidates: [] }, error: null })
    renderPage()
    expect(await screen.findByRole('heading', { name: /Aucun créneau disponible/i })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Actualiser/i }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
  })

  it('affiche une erreur contrôlée sans faux succès', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'Service temporairement indisponible.' }) } } })
    renderPage()
    expect(await screen.findByText('Service temporairement indisponible.')).toBeVisible()
    expect(screen.queryByText(/réservation confirmée/i)).not.toBeInTheDocument()
  })

  it('exige les deux consentements B2C distincts et non précochés', async () => {
    invoke.mockResolvedValue({ data: { candidates: [{ ...CANDIDATE, requires_early_start_consents: true }] }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).not.toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    const confirm = screen.getByRole('button', { name: 'Confirmer ce créneau' })
    expect(confirm).toBeDisabled()
    fireEvent.click(checkboxes[0])
    expect(confirm).toBeDisabled()
    fireEvent.click(checkboxes[1])
    expect(confirm).toBeEnabled()
  })

  it('signale un conflit si le créneau disparaît lors de la nouvelle vérification', async () => {
    invoke
      .mockResolvedValueOnce({ data: { candidates: [CANDIDATE] }, error: null })
      .mockResolvedValueOnce({ data: { candidates: [] }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/vient de devenir indisponible/i)
  })

  it('ne simule aucune réservation avant l’intégration Google sécurisée', async () => {
    invoke.mockResolvedValue({ data: { candidates: [CANDIDATE] }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    expect(await screen.findByText(/enregistrement définitif sera activé/i)).toBeVisible()
    expect(screen.queryByText(/réservation confirmée/i)).not.toBeInTheDocument()
    expect(invoke.mock.calls.every(([name]) => name === 'get-diagnostic-availability')).toBe(true)
  })
})
