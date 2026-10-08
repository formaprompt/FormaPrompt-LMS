import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import userEvent from '@testing-library/user-event';
import FormationCreativite from './FormationCreativite';
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

afterEach(cleanup);
const mount = () => render(<HelmetProvider><MemoryRouter><FormationCreativite /></MemoryRouter></HelmetProvider>);

it('présente un parcours artistique adapté de quatre séances et 14 heures', () => {
  mount();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Explorer l’IA au service de la créativité');
  const summary = screen.getByRole('complementary', { name: 'En bref' });
  expect(summary).toHaveTextContent('14 heures · 4 séances de 3 h 30, pauses en plus');
  expect(summary).toHaveTextContent('aucun prérequis IA');
  expect(within(document.querySelector('#programme')).getAllByRole('heading', { level: 3 })).toHaveLength(4);
  expect(screen.getByText(/Aucun travail n’est imposé entre les séances/)).toBeInTheDocument();
  expect(screen.getByText(/questionnaire préalable/)).toHaveTextContent('votre discipline, votre rôle, votre niveau, votre projet, vos outils et vos limites');
  expect(screen.getByText(/Vidéo et cinéma, arts vivants/)).toHaveTextContent('Cette liste reste ouverte');
  expect(screen.getByText(/La démarche artistique humaine/)).toHaveTextContent('ne se limite pas à la génération d’images');
  expect(screen.getByText(/CROP : Contexte, Rôle, Objectif, Précisions/)).toBeInTheDocument();
});

it('affiche les prix, minimums, conditions et limites validés sans paiement', () => {
  const { container } = mount();
  const tariffs = screen.getByRole('region', { name: 'Choisir votre accompagnement' });
  expect(tariffs).toHaveTextContent('690 € par personne');
  expect(tariffs).toHaveTextContent('Seuil prévu de quatre participants');
  expect(tariffs).toHaveTextContent('à partir de deux participants');
  expect(tariffs).toHaveTextContent('900 € pour les 14 heures');
  expect(tariffs).toHaveTextContent('1 600 € pour le groupe');
  expect(within(tariffs).getByRole('heading', { name: 'École ou association' })).toBeInTheDocument();
  expect(tariffs).toHaveTextContent('Groupe constitué par votre école ou association');
  expect(tariffs).toHaveTextContent('jusqu’à 6 personnes');
  expect(tariffs).toHaveTextContent('TVA non applicable');
  expect(container.textContent).not.toMatch(/frais de déplacement/);
  expect(screen.getByText(/Elle ne juge pas la valeur artistique/)).toBeInTheDocument();
  expect(screen.getByText(/Le bilan de satisfaction est distinct/)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/devis|OPCO/);
  expect(screen.getAllByText(/Remboursement intégral si le groupe n’ouvre pas/)).toHaveLength(2);
  expect(tariffs).toHaveTextContent('Le paiement est encaissé dès l’inscription');
  expect(tariffs).toHaveTextContent('L’ouverture de la session reste conditionnelle');
  expect(container.querySelector('form')).toBeNull();
  expect(container.querySelector('a[href*="stripe"], a[href*="reservation"], a[href*="lab.formaprompt"]')).toBeNull();
  expect(screen.getByRole('link', { name: /besoin d’accessibilité/ })).toHaveAttribute('href', '/contact');
  expect(screen.getByText('Illustration générée avec l’IA')).toBeInTheDocument();
});

it('expose une canonical, une durée structurée et une image sans calendrier inventé', async () => {
  mount();
  await waitFor(() => expect(document.title).toBe('Formation IA et créativité · 14 h | FormaPrompt'));
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/formation-ia-creativite');
  expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://formaprompt.com/assets/formation-ia-creativite.webp');
  const data = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  expect(data.name).toBe('Explorer l’IA au service de la créativité');
  expect(data.timeRequired).toBe('PT14H');
  expect(data.offers).toBeUndefined();
  expect(data.startDate).toBeUndefined();
});

it('oriente la demande vers le circuit contact existant', async () => {
  render(<HelmetProvider><MemoryRouter><Routes>
    <Route path="/" element={<FormationCreativite />} />
    <Route path="/contact" element={<h1>Contact existant</h1>} />
  </Routes></MemoryRouter></HelmetProvider>);
  await userEvent.click(screen.getByRole('link', { name: 'Préparer l’organisation de ma formation' }));
  expect(screen.getByRole('heading', { name: 'Contact existant' })).toBeInTheDocument();
});
