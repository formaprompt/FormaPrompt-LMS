import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FormationOF from './FormationOF'
import FormationIA from './FormationIA'
import FormationPrompt from './FormationPrompt'
import FormationAIAct from './FormationAIAct'

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: vi.fn() }))
vi.mock('../components/SEO', () => ({
  default: ({ title, description, url }) => (
    <meta data-testid="seo" data-title={title} data-description={description} content={url} />
  ),
}))
vi.mock('../components/CommercialCheckout', () => ({
  default: () => <div>Inscription directe</div>,
}))

afterEach(cleanup)

const pages = [
  {
    Page: FormationOF,
    title: 'Formation IA pour formateurs et équipes pédagogiques | FormaPrompt',
    description: 'Formation IA générative de 21 h pour formateurs et équipes pédagogiques : concevoir, réviser et sécuriser des contenus avec l’IA.',
    link: 'formation Prompt Engineering – Niveau 1',
    href: '/formation-prompt-engineering',
  },
  {
    Page: FormationIA,
    title: 'Formation IA à Calais et à distance · 10 h | FormaPrompt',
    description: 'Formation IA générative de 10 heures avec Thierry FREZARD : usages professionnels, prompts, vérification et confidentialité. À Calais ou en classe virtuelle.',
    link: 'formation Prompt Engineering – Niveau 1',
    href: '/formation-prompt-engineering',
  },
  {
    Page: FormationPrompt,
    title: 'Formation Prompt Engineering 7 h à Calais ou à distance | FormaPrompt',
    description: 'Formation Prompt Engineering de 7 h pour concevoir, tester et améliorer des prompts professionnels, en présentiel à Calais ou à distance.',
    link: 'formation IA générative',
    href: '/formation-ia-generative',
  },
  {
    Page: FormationAIAct,
    title: 'Formation AI Act : acculturation IA pour les équipes | FormaPrompt',
    description: 'Formation AI Act : comprendre le cadre européen, repérer les usages à encadrer et préparer un premier plan d’action adapté à l’organisation.',
    link: 'formation IA générative',
    href: '/formation-ia-generative',
  },
]

it.each(pages)('présente la meta SEO et le lien interne attendu pour $title', ({ Page, title, description, link, href }) => {
  render(<MemoryRouter><Page /></MemoryRouter>)

  const seo = document.querySelector('meta[data-testid="seo"]')
  expect(seo).toHaveAttribute('data-title', title)
  expect(seo).toHaveAttribute('data-description', description)
  expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', href)
})
