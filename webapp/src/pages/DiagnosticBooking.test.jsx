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
const BOOKING = {
  id: '88000000-0000-4000-8000-000000000021',
  status: 'booked',
  starts_at: CANDIDATE.starts_at,
  ends_at: CANDIDATE.ends_at,
  google_meet_url: 'https://meet.google.com/abc-defg-hij',
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

  it('transmet séparément les deux consentements requis lors de la réservation B2C', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { candidates: [{ ...CANDIDATE, requires_early_start_consents: true }] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { booking: BOOKING }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    await screen.findByText(/Réservation confirmée/i)
    expect(invoke).toHaveBeenLastCalledWith('confirm-diagnostic-booking', {
      body: expect.objectContaining({
        early_service_start_requested: true,
        full_performance_withdrawal_acknowledged: true,
        early_service_start_statement_version: 'DIAGNOSTIC-EARLY-START-2026-08-26',
        full_performance_acknowledgement_version: 'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26',
      }),
    })
  })

  it('signale un conflit si le créneau disparaît lors de la nouvelle vérification', async () => {
    invoke
      .mockResolvedValueOnce({ data: { candidates: [CANDIDATE] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ error: 'Ce créneau vient de devenir indisponible.' }) } } })
      .mockResolvedValueOnce({ data: { candidates: [] }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/vient de devenir indisponible/i)
  })

  it('confirme réellement la réservation et affiche le lien Google Meet', async () => {
    invoke
      .mockResolvedValueOnce({ data: { candidates: [CANDIDATE] }, error: null })
      .mockResolvedValueOnce({ data: { booking: BOOKING }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    expect(await screen.findByText(/Réservation confirmée/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /Ouvrir le lien Google Meet/i })).toHaveAttribute('href', BOOKING.google_meet_url)
    expect(screen.getByRole('link', { name: /Préparer mon diagnostic/i })).toHaveAttribute('href', `/diagnostic-ia/questionnaire?booking_id=${BOOKING.id}`)
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([
      'get-diagnostic-availability',
      'confirm-diagnostic-booking',
    ])
  })

  it('permet de reprendre une synchronisation Google interrompue sans perdre le créneau', async () => {
    invoke
      .mockResolvedValueOnce({ data: { candidates: [CANDIDATE] }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { context: { json: async () => ({ error: 'La synchronisation du rendez-vous est temporairement indisponible.' }) } },
      })
      .mockResolvedValueOnce({ data: { booking: BOOKING }, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ce créneau' }))
    const retry = await screen.findByRole('button', { name: 'Réessayer la confirmation' })
    expect(screen.getByRole('alert')).toHaveTextContent(/sans changer de créneau/i)
    fireEvent.click(retry)
    expect(await screen.findByText(/Réservation confirmée/i)).toBeVisible()
  })
})
