import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FormationIA from './FormationIA'
import FormationPrompt from './FormationPrompt'
import FormationAIAct from './FormationAIAct'

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: vi.fn() }))
vi.mock('../components/SEO', () => ({
  default: ({ url }) => <meta data-testid="canonical" content={url} />,
}))
vi.mock('../components/CommercialCheckout', () => ({
  default: ({ courseId }) => <div data-testid="commercial-checkout" data-course-id={courseId}>Inscription directe</div>,
}))

afterEach(cleanup)

const formations = [
  {
    Page: FormationIA,
    h1: 'IA générative : comprendre, pratiquer et sécuriser ses usages',
    duration: '10 heures accompagnées',
    price: '497 € par apprenant',
    groupQuote: true,
    courseId: 'formation-ia',
    canonical: 'https://formaprompt.com/formation-ia-generative',
  },
  {
    Page: FormationPrompt,
    h1: 'Formation Prompt Engineering – Niveau 1',
    duration: '7 heures accompagnées',
    price: '343 € par apprenant',
    groupQuote: true,
    courseId: 'formation-prompt-level-1',
    canonical: 'https://formaprompt.com/formation-prompt-engineering',
  },
  {
    Page: FormationAIAct,
    h1: 'IA : acculturation et préparation à la conformité AI Act',
    duration: '4 h 45 estimées, dont 4 heures guidées',
    price: '187 € par apprenant, tarif promotionnel',
    guidedDuration: '4 heures guidées',
    groupQuote: false,
    courseId: 'formation-ia-act',
    canonical: 'https://formaprompt.com/formation-ia-act-conformite',
  },
]

it.each(formations)('présente les informations et parcours commerciaux de $h1', ({ Page, h1, duration, price, guidedDuration, groupQuote, courseId, canonical }) => {
  render(<MemoryRouter><Page /></MemoryRouter>)

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument()
  const summary = screen.getByRole('complementary', { name: 'En bref' })
  expect(within(summary).getByText('Durée')).toBeInTheDocument()
  expect(within(summary).getByText(duration)).toBeInTheDocument()
  expect(within(summary).getByText(price)).toBeInTheDocument()
  if (groupQuote) {
    expect(within(summary).getByText('Programme et tarif adaptés sur devis')).toBeInTheDocument()
  } else {
    expect(within(summary).queryByText('Programme et tarif adaptés sur devis')).not.toBeInTheDocument()
  }
  if (guidedDuration) expect(within(summary).getByText(new RegExp(guidedDuration))).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /voir le tarif et s.inscrire/i })).toHaveAttribute('href', '#inscription')
  expect(screen.getByRole('link', { name: 'Consulter le programme' })).toHaveAttribute('href', '#programme')
  expect(screen.getByTestId('commercial-checkout')).toHaveAttribute('data-course-id', courseId)
  expect(screen.queryByText(/Diagnostic IA Express/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/FormaPrompt Studio/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Training Lab/i)).not.toBeInTheDocument()
  expect(document.querySelector('meta[data-testid="canonical"]')).toHaveAttribute('content', canonical)
})
