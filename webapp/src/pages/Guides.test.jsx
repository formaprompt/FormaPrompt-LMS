import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Guides from './Guides';
import GuidePage from './GuidePage';

vi.mock('../components/SEO', () => ({ default: () => null }));

afterEach(cleanup);

describe('Guides', () => {
  it('présente les trois guides pratiques', () => {
    render(<MemoryRouter><Guides /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /mieux utiliser l’ia/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ia générative pour débutants/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /prompt engineering professionnel/i }).length).toBeGreaterThan(0);
  });

  it('affiche le guide demandé sans masquer une URL inconnue', () => {
    render(<MemoryRouter initialEntries={['/guides/prompt-engineering-professionnel-methode']}><Routes><Route path="/guides/:slug" element={<GuidePage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: /prompt engineering professionnel/i })).toBeInTheDocument();
    expect(screen.getByText('La méthode CROP : contexte, rôle, objectif, précisions')).toBeInTheDocument();
  });

  it('affiche la page introuvable pour un slug inconnu', () => {
    render(<MemoryRouter initialEntries={['/guides/introuvable']}><Routes><Route path="/guides/:slug" element={<GuidePage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /cette page est introuvable/i })).toBeInTheDocument();
    expect(screen.queryByText('La méthode CROP : contexte, rôle, objectif, précisions')).not.toBeInTheDocument();
  });
});
