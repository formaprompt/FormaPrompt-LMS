import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WithdrawalRequest from './WithdrawalRequest'

const { invoke, select, mockState } = vi.hoisted(() => {
  const state = { purchaseResult: { data: [], error: null }, invokeResult: { data: null, error: null } }
  const hoistedInvoke = vi.fn(() => Promise.resolve(state.invokeResult))
  const hoistedOrder = vi.fn(() => Promise.resolve(state.purchaseResult))
  const hoistedEq = vi.fn(() => ({ order: hoistedOrder }))
  const hoistedSelect = vi.fn(() => ({ eq: hoistedEq }))
  return { invoke: hoistedInvoke, select: hoistedSelect, mockState: state }
})

vi.mock('../components/SEO', () => ({ default: () => null }))
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '61000000-0000-0000-0000-000000000001',
      email: 'marie@example.test',
      user_metadata: { first_name: 'Marie', last_name: 'Test' },
    },
  }),
}))
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({ select }),
    functions: { invoke },
  },
}))

describe('rétractation électronique', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('identifie le contrat et affiche l accusé durable sans promettre un remboursement', async () => {
    mockState.purchaseResult = {
      data: [{
        id: '63000000-0000-0000-0000-000000000001',
        course_id: 'formation-ia-act',
        purchased_at: '2026-08-12T10:00:00.000Z',
      }],
      error: null,
    }
    mockState.invokeResult = {
      data: {
        receipt: {
          id: '66000000-0000-0000-0000-000000000001',
          purchase_id: '63000000-0000-0000-0000-000000000001',
          course_id: 'formation-ia-act',
          claimant_first_name: 'Marie',
          claimant_last_name: 'Test',
          acknowledgement_email: 'marie@example.test',
          declaration: 'Je vous informe par la présente de ma décision de me rétracter.',
          status: 'received',
          received_at: '2026-08-12T10:05:00.000Z',
          acknowledgement_delivery_status: 'sent',
        },
      },
      error: null,
    }

    render(<MemoryRouter><WithdrawalRequest /></MemoryRouter>)
    await screen.findByRole('option', { name: /Formation IA Act/i })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la rétractation' }))

    await screen.findByRole('heading', { name: 'Demande enregistrée' })
    expect(screen.getByText(/Marie Test/)).toBeVisible()
    expect(screen.getByText(/63000000-0000-0000-0000-000000000001/)).toBeVisible()
    expect(screen.getByText(/ne vaut pas acceptation d’un remboursement/i)).toBeVisible()
    expect(screen.getByText(/accusé électronique a été envoyé/i)).toBeVisible()
    expect(invoke).toHaveBeenCalledWith('submit-withdrawal-request', expect.objectContaining({
      body: expect.objectContaining({
        purchase_id: '63000000-0000-0000-0000-000000000001',
        acknowledgement_email: 'marie@example.test',
      }),
    }))
  })

  it('conserve l accusé téléchargeable lorsque l email échoue après enregistrement', async () => {
    mockState.purchaseResult = {
      data: [{ id: '63000000-0000-0000-0000-000000000001', course_id: 'formation-ia', purchased_at: '2026-08-12' }],
      error: null,
    }
    mockState.invokeResult = {
      data: {
        receipt: {
          id: '66000000-0000-0000-0000-000000000002',
          purchase_id: '63000000-0000-0000-0000-000000000001',
          course_id: 'formation-ia',
          claimant_first_name: 'Marie',
          claimant_last_name: 'Test',
          acknowledgement_email: 'marie@example.test',
          declaration: 'Je vous informe par la présente de ma décision de me rétracter.',
          status: 'received',
          received_at: '2026-08-12T10:05:00.000Z',
          acknowledgement_delivery_status: 'failed',
        },
      },
      error: null,
    }
    render(<MemoryRouter><WithdrawalRequest /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmer la rétractation' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la rétractation' }))
    expect(await screen.findByText(/demande reste enregistrée/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /Télécharger l’accusé/i })).toBeVisible()
  })

  it('ne fabrique pas un succès lorsque la fonction serveur échoue', async () => {
    mockState.purchaseResult = { data: [{ id: 'p1', course_id: 'formation-ia', purchased_at: '2026-08-12' }], error: null }
    mockState.invokeResult = { data: null, error: new Error('indisponible') }
    render(<MemoryRouter><WithdrawalRequest /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmer la rétractation' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la rétractation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/n’a pas pu être enregistrée/i)
  })
})
