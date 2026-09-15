import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import userEvent from '@testing-library/user-event';
import FormationAgentsIA from './FormationAgentsIA';

afterEach(cleanup);
const mount = () => render(<HelmetProvider><MemoryRouter><FormationAgentsIA /></MemoryRouter></HelmetProvider>);

it('présente les quatre journées incluses et les prérequis approuvés', () => {
  mount();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agents IA & Workflows - De l’assistant à l’automatisation professionnelle');
  const summary = screen.getByRole('complementary', { name: 'En bref' });
  expect(within(summary).getByText('28 heures · 4 journées de 7 heures, hors pauses')).toBeInTheDocument();
  expect(within(summary).getByText('Individuel, inter, groupe constitué ou intra · exonéré de TVA')).toBeInTheDocument();
  expect(within(document.querySelector('#programme')).getAllByRole('heading', { level: 3 })).toHaveLength(4);
  expect(screen.getByText(/J1 fait partie de la formation complète/)).toBeInTheDocument();
  expect(screen.getByText(/Aucune compétence en programmation n’est requise/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Thierry FREZARD' })).toHaveAttribute('href', '/a-propos');
});

it('préserve l’évaluation, les livrables et une demande sans paiement', () => {
  const { container } = mount();
  expect(screen.getByText(/70\/100/)).toHaveTextContent('correction obligatoire de toute erreur critique');
  expect(screen.getByText(/Dossier CADRES individuel de 5 à 8 pages/)).toBeInTheDocument();
  expect(screen.getByText(/Une demande de devis ne vaut pas inscription/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /besoin d’accessibilité/ })).toHaveAttribute('href', '/contact');
  expect(container.querySelector('form')).toBeNull();
  expect(container.querySelector('a[href*="stripe"], a[href*="lab.formaprompt"], a[href*="reservation"]')).toBeNull();
  expect(container.textContent).not.toMatch(/testeurs|pilote|V0\.|V1\./);
});

it('affiche les quatre formules précisées avec le forfait total de groupe et les minimums', () => {
  mount();
  const tariffs = screen.getByRole('region', { name: 'Les formules en distanciel' });
  expect(within(tariffs).getByText('1 370 €')).toBeInTheDocument();
  expect(within(tariffs).getByText('990 € par personne')).toBeInTheDocument();
  expect(within(tariffs).getByText('Deux participants minimum par session.')).toBeInTheDocument();
  expect(within(tariffs).getByText('Deux participants minimum.')).toBeInTheDocument();
  expect(within(tariffs).getByText('Sur devis')).toBeInTheDocument();
  expect(tariffs).toHaveTextContent('Exonéré de TVA');
  expect(within(tariffs).getByText('1 790 € pour le groupe')).toBeInTheDocument();
  expect(tariffs).toHaveTextContent('Forfait total pour les 28 heures, de 2 à 8 participants. Une société ou un particulier peut constituer son groupe.');
  expect(within(tariffs).getAllByRole('heading', { level: 3 })).toHaveLength(4);
});

it('publie des métadonnées cohérentes sans prix ou calendrier inventé', async () => {
  mount();
  await waitFor(() => expect(document.title).toBe('Formation Agents IA & Workflows · 28 h à distance | FormaPrompt'));
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/formation-agents-ia-workflows');
  const data = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  expect(data['@type']).toBe('Course');
  expect(data.timeRequired).toBe('PT28H');
  expect(data.offers).toBeUndefined();
  expect(data.startDate).toBeUndefined();
});

it('le CTA mène au contact sans inscription ni envoi', async () => {
  render(<HelmetProvider><MemoryRouter><Routes>
    <Route path="/" element={<FormationAgentsIA />} />
    <Route path="/contact" element={<h1>Contact existant</h1>} />
  </Routes></MemoryRouter></HelmetProvider>);
  await userEvent.click(screen.getByRole('link', { name: 'Demander un devis', exact: true }));
  expect(screen.getByRole('heading', { name: 'Contact existant' })).toBeInTheDocument();
});
