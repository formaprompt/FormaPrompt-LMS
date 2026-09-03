import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CGVConsumer from './CGVConsumer';
import CGVProfessional from './CGVProfessional';
import InternalRules from './InternalRules';
import Legal from './Legal';
import PrecontractualInformation from './PrecontractualInformation';
import Privacy from './Privacy';
import Footer from '../components/Footer';

vi.mock('../components/SEO', () => ({ default: () => null }));

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>);
}

describe('documents juridiques publiables', () => {
  afterEach(() => cleanup());

  it('sépare clairement les CGV particuliers et professionnels', () => {
    renderPage(CGVConsumer);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('particuliers');
    expect(screen.getByText(/dix jours à compter de la signature/i)).toBeVisible();
    expect(screen.getByText(/quatorze jours à compter de la conclusion/i)).toBeVisible();
    expect(screen.getByText(/21 juillet 2028/i)).toBeVisible();
    expect(screen.queryByText(/document préparatoire/i)).not.toBeInTheDocument();
    cleanup();

    renderPage(CGVProfessional);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('professionnels');
    expect(screen.queryByText(/droit de rétractation de quatorze jours/i)).not.toBeInTheDocument();
  });

  it('identifie les versions stables sans avertissement préparatoire', () => {
    renderPage(CGVConsumer);
    expect(screen.getByText('CGV B2C — version 2026-08-26')).toBeVisible();
    expect(screen.queryByText(/publication après validation/i)).not.toBeInTheDocument();
    cleanup();
    renderPage(CGVProfessional);
    expect(screen.getByText('CGV B2B — version 2026-08-26')).toBeVisible();
  });

  it('affiche la règle LMS de référence sans garantie perpétuelle', () => {
    renderPage(PrecontractualInformation);
    expect(screen.getByText(/sans limitation de durée prédéfinie/i)).toBeVisible();
    expect(screen.getByText(/tant que le service FormaPrompt et cette formation demeurent exploités/i)).toBeVisible();
  });

  it('décrit les traitements actuels et les prestataires réels', () => {
    renderPage(Privacy);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('confidentialité');
    expect(screen.getByText(/journal d’audit conserve les actions administratives sensibles/i)).toBeVisible();
    expect(screen.getAllByText(/Google Meet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Microsoft Teams/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/aucun tag Google Analytics/i)).toBeVisible();
  });

  it('présente CM2C dans les mentions légales', () => {
    renderPage(Legal);
    expect(screen.getByText(/Centre de la Médiation de la Consommation/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'www.cm2c.net' })).toHaveAttribute('href', 'https://www.cm2c.net/');
  });

  it('conserve la franchise en base sans inventer de TVA applicable', () => {
    for (const Page of [Legal, CGVConsumer, CGVProfessional, PrecontractualInformation]) {
      const { unmount } = renderPage(Page);
      const taxMentions = screen.getAllByText('TVA non applicable - article 293 B du CGI');
      expect(taxMentions).toHaveLength(Page === CGVProfessional ? 2 : 1);
      taxMentions.forEach((mention) => expect(mention).toBeVisible());
      expect(screen.queryByText(/^TVA applicable$/i)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('articule le règlement avec le workflow disciplinaire du Sprint 1', () => {
    renderPage(InternalRules);
    expect(screen.getByText(/mesure conservatoire/i)).toBeVisible();
    expect(screen.getByText(/décision disciplinaire est humaine/i)).toBeVisible();
    expect(screen.getByText(/conséquence technique éventuelle/i)).toBeVisible();
  });

  it('rend tous les documents prioritaires accessibles depuis le Footer', () => {
    renderPage(Footer);
    expect(screen.getByRole('link', { name: 'CGV particuliers' })).toHaveAttribute('href', '/cgv-particuliers');
    expect(screen.getByRole('link', { name: 'CGV professionnels' })).toHaveAttribute('href', '/cgv-professionnels');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/politique-confidentialite');
    expect(screen.getByRole('link', { name: 'Règlement intérieur' })).toHaveAttribute('href', '/reglement-interieur');
    expect(screen.getByRole('link', { name: 'Informations précontractuelles' })).toHaveAttribute('href', '/informations-precontractuelles');
    expect(screen.getByRole('link', { name: 'Renoncer au contrat ici' })).toHaveAttribute('href', '/retractation');
  });
});
