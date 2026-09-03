import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticQuestionnaire from './DiagnosticQuestionnaire'
import { useAuth } from '../contexts/useAuth'

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }))
const BOOKING_ID = '88000000-0000-4000-8000-000000000021'

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { from, functions: { invoke } } }))
vi.mock('../components/SEO', () => ({ default: () => null }))

function setupQueries({ booking = { id: BOOKING_ID, status: 'booked' }, questionnaire = null } = {}) {
  from.mockImplementation((table) => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query) }
    query.maybeSingle = vi.fn().mockResolvedValue({ data: table === 'diagnostic_ia_bookings' ? booking : questionnaire, error: null })
    return query
  })
}

function renderPage(path = `/diagnostic-ia/questionnaire?booking_id=${BOOKING_ID}`) {
  return render(<MemoryRouter initialEntries={[path]}><DiagnosticQuestionnaire /></MemoryRouter>)
}

function fillForm() {
  const text = { 'Prénom': 'Camille', 'Nom': 'Martin', 'Organisation': 'Atelier Exemple', 'Métier / fonction': 'Responsable', 'Secteur d’activité': 'Services', 'Outils utilisés': 'Google Workspace', 'Tâches répétitives ou chronophages': 'Comptes rendus', 'Documents manipulés': 'Documents génériques', 'Difficulté principale': 'Temps', 'Objectif du diagnostic': 'Prioriser', 'Si vous pouviez supprimer une seule tâche pénible de votre semaine, laquelle choisiriez-vous ?': 'Relances' }
  Object.entries(text).forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }))
  fireEvent.change(screen.getByLabelText('Taille de structure'), { target: { value: '1_9' } })
  fireEvent.change(screen.getByLabelText('Niveau IA'), { target: { value: 'beginner' } })
}

describe('questionnaire préalable Diagnostic IA', () => {
  beforeEach(() => { useAuth.mockReturnValue({ user: { id: 'user-test' } }); setupQueries() })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('affiche la prévention RGPD et bloque une réservation non confirmée', async () => {
    setupQueries({ booking: { id: BOOKING_ID, status: 'booking_pending' } })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(/uniquement après confirmation/i)
    expect(screen.getByText(/ne saisissez pas de données personnelles ou confidentielles inutiles/i)).toBeVisible()
  })

  it('valide puis envoie uniquement booking_id et réponses bornées', async () => {
    invoke.mockResolvedValue({ data: { questionnaire: { submitted_at: '2026-08-29T10:00:00Z' } }, error: null })
    renderPage()
    await screen.findByRole('button', { name: 'Envoyer ma préparation' })
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma préparation' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('submit-diagnostic-questionnaire', {
      body: expect.objectContaining({ booking_id: BOOKING_ID, answers: expect.objectContaining({ questionnaire_version: 'DIAGNOSTIC-IA-PREPARATION-2026-08-29' }) }),
    }))
    expect(await screen.findByText(/préparation est enregistrée/i)).toBeVisible()
  })

  it('n offre aucune seconde soumission après transmission', async () => {
    setupQueries({ questionnaire: { id: 'questionnaire-test', submitted_at: '2026-08-29T10:00:00Z' } })
    renderPage()
    expect(await screen.findByText(/préparation est enregistrée/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Envoyer ma préparation' })).not.toBeInTheDocument()
  })
})
