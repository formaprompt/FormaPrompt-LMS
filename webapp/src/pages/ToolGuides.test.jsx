import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuidePage from './GuidePage';
import Guides from './Guides';

vi.mock('../components/SEO', () => ({ default: () => null }));
afterEach(cleanup);

function showGuide(slug) {
  return render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><Routes><Route path="/guides/:slug" element={<GuidePage />} /></Routes></MemoryRouter>);
}

describe('Nouveaux guides pratiques', () => {
  it.each(['claude', 'copilot'])('préserve la sélection existante de %s sans activer la réouverture réservée à Gemini', (tool) => {
    const { container } = showGuide(`${tool}-guide-pratique`);
    const choices = container.querySelectorAll('.gpt-choices button');
    fireEvent.click(choices[1]);
    const panel = container.querySelector(`#${tool}-case-1`);
    expect(panel.open).toBe(true);
    panel.open = false;
    fireEvent.click(choices[1]);
    expect(panel.open).toBe(false);
    fireEvent.click(choices[2]);
    fireEvent.click(choices[1]);
    expect(panel.open).toBe(true);
  });

  it.each([
    ['claude-guide-pratique', /guide claude ia/i, /comprendre un document/i, 'claude-case-1'],
    ['copilot-guide-pratique', /guide microsoft copilot/i, /comprendre excel/i, 'copilot-case-2'],
  ])('rend %s avec sommaire et cas accessibles sans masquer leurs consignes', (slug, title, choice, panelId) => {
    const { container } = showGuide(slug);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    const toc = screen.getByRole('navigation', { name: 'Dans ce guide' });
    within(toc).getAllByRole('link').forEach(link => expect(container.querySelector(link.getAttribute('href'))).not.toBeNull());
    const panels = [...container.querySelectorAll('.tool-guide-panels details')];
    expect(panels).toHaveLength(4);
    panels.forEach(panel => {
      expect(panel.querySelector('summary')).not.toBeNull();
      expect(panel.querySelector('.tool-guide-prompt').textContent).toContain('Contexte');
      expect(panel).not.toHaveAttribute('hidden');
    });
    fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(container.querySelector(`#${panelId}`)).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: choice })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /découvrir la formation ia générative/i })).toHaveAttribute('href', '/formation-ia-generative-elearning');
    const download = screen.getByRole('link', { name: /télécharger le guide .* en pdf/i });
    expect(download).toHaveAttribute('href', `/assets/guides/pdf/guide-${slug.split('-')[0]}-2026-11-01.pdf`);
    expect(download).toHaveAttribute('download');
  });

  it('copie la consigne affichée et confirme la copie sans envoi externe', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = showGuide('copilot-guide-pratique');
    fireEvent.click(within(container.querySelector('#copilot-case-0')).getByRole('button', { name: /copier la consigne/i }));
    expect(await screen.findByText(/consigne copiée/i)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Contexte : Je prépare un atelier fictif'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Précisions : Utilise uniquement le document.'));
  });

  it('préserve le guide Claude existant et relie les nouvelles pages depuis l’index', () => {
    render(<MemoryRouter><Guides /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /guide claude ia/i })).toHaveAttribute('href', '/guides/claude-guide-pratique');
    expect(screen.getByRole('link', { name: /guide microsoft copilot/i })).toHaveAttribute('href', '/guides/copilot-guide-pratique');
    expect(screen.getByRole('link', { name: /claude : préparer et vérifier/i })).toHaveAttribute('href', '/guides/claude-preparer-activite-bureautique');
  });

  it('sépare les prix personnels TTC, les compléments professionnels HT et les modes', () => {
    showGuide('copilot-guide-pratique');
    const personal = screen.getByRole('table', { name: /compte personnel.*prix, accès et limites/i });
    const business = screen.getByRole('table', { name: /compte professionnel.*prix, accès et limites/i });
    expect(within(personal).getByRole('columnheader', { name: 'Au mois TTC' })).toBeInTheDocument();
    expect(within(personal).getByRole('columnheader', { name: 'À l’année TTC' })).toBeInTheDocument();
    const pro = within(personal).getByRole('row', { name: /microsoft 365 pro \/ professionnel/i });
    expect(within(pro).getAllByRole('cell')[0]).toHaveTextContent('110 €');
    expect(within(pro).getAllByRole('cell')[1]).toHaveTextContent('Non proposée');
    const family = within(personal).getByRole('row', { name: /microsoft 365 famille/i });
    expect(family).toHaveTextContent('IA : le titulaire seulement.');
    const businessOffer = within(business).getByRole('row', { name: /microsoft 365 copilot business/i });
    expect(businessOffer).toHaveTextContent('21,84 € HT / mois');
    expect(businessOffer).toHaveTextContent('Licence socle en supplément.');
    expect(businessOffer).toHaveTextContent('Promo : première année annuelle');
    expect(screen.getByText(/offre affichée du/i)).toHaveTextContent('31 décembre 2026');
    expect(screen.getByText(/prix publics microsoft france vérifiés/i)).toHaveTextContent('1er novembre 2026');
    expect(screen.getByRole('table', { name: /un mode change le traitement/i })).toBeInTheDocument();
  });

  it('présente les offres Claude en USD hors taxes sans promettre un usage illimité', () => {
    showGuide('claude-guide-pratique');
    const table = screen.getByRole('table', { name: /pour une personne.*quatre formules claude/i });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByRole('columnheader', { name: /usd hors taxes/i })).toBeInTheDocument();
    const pro = within(table).getByRole('row', { name: /^pro /i });
    expect(pro).toHaveTextContent('20 $/mois');
    expect(pro).toHaveTextContent('200 $/an payés d’avance');
    const ultra = within(table).getByRole('row', { name: /^ultra /i });
    expect(ultra).toHaveTextContent('comptes vérifiés');
    expect(ultra).toHaveTextContent('plafond hebdomadaire');
    expect(screen.getByText(/aucune de ces formules n’est illimitée/i)).toBeInTheDocument();
  });
});
