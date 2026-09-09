import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormationExcel from './FormationExcel';

vi.mock('../components/SEO', () => ({
  default: ({ url }) => <span hidden data-testid="canonical" data-url={url} />,
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
afterEach(cleanup);

function renderPage() {
  return render(<MemoryRouter><FormationExcel /></MemoryRouter>);
}

it('affiche le catalogue validé avec une grille commune, sans tarif promotionnel ni paiement', () => {
  const { container } = renderPage();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByTestId('canonical')).toHaveAttribute('data-url', 'https://formaprompt.com/formation-excel');
  const prices = screen.getByRole('region', { name: 'Choisissez votre modalité de formation' });
  for (const [mode, price, unit] of [
    ['Inter-entreprises', '690 €', 'par participant'],
    ['Intra-entreprise', '1 590 €', 'par groupe jusqu’à 8 participants'],
    ['Accompagnement individuel', '990 €', 'pour une personne'],
  ]) {
    const card = within(prices).getByRole('heading', { name: mode }).closest('article');
    expect(card).toHaveTextContent(price);
    expect(card).toHaveTextContent(`${unit} · 14 h`);
  }
  expect(prices).toHaveTextContent('TVA non applicable - article 293 B du CGI');
  expect(screen.queryByText('590 €', { exact: true })).not.toBeInTheDocument();
  expect(container.querySelector('form')).toBeNull();
  for (const link of screen.getAllByRole('link', { name: 'Demander un devis', hidden: true })) {
    expect(link).toHaveAttribute('href', '/contact');
    expect(link.closest('.excel-intra')).toHaveTextContent('1 590 €');
  }
});

it('respecte les frontières des niveaux et conserve les recherches historiques', () => {
  renderPage();
  const initiation = screen.getByRole('article', { name: /Excel Initiation -/ });
  const intermediate = screen.getByRole('article', { name: /Excel Perfectionnement -/ });
  const advanced = screen.getByRole('article', { name: /Excel Avancé -/ });
  for (const course of [initiation, intermediate, advanced]) {
    expect(course).toHaveTextContent('14 h · 2 jours · ou 4 demi-journées');
    expect(course).toHaveTextContent('Prérequis');
    expect(course).toHaveTextContent('cas pratique final');
  }
  expect(initiation).toHaveTextContent('licences d’utilisation des images');
  expect(intermediate).toHaveTextContent('RECHERCHEV et RECHERCHEH pour les fichiers historiques et Excel 2016');
  expect(intermediate).toHaveTextContent('RECHERCHEX comme méthode moderne sur les versions compatibles');
  expect(advanced).toHaveTextContent('découverte courte de LAMBDA');
  expect(advanced).toHaveTextContent('Power BI et développement avancé avec LAMBDA sont exclus');
  const tosa = screen.getByRole('complementary', { name: 'Et la certification TOSA Excel ?' });
  expect(tosa).toHaveTextContent('distinct de la formation FormaPrompt');
  expect(tosa).toHaveTextContent('ne garantit aucun score');
  expect(tosa).not.toHaveTextContent('€');
});
