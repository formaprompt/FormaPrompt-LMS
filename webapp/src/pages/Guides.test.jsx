import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Guides from './Guides';
import GuidePage from './GuidePage';

vi.mock('../components/SEO', () => ({ default: () => null }));

afterEach(cleanup);

describe('Guides', () => {
  it('présente les guides pratiques dont Claude', () => {
    render(<MemoryRouter><Guides /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /mieux utiliser l’ia/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ia générative pour débutants/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /prompt engineering professionnel/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /claude : préparer et vérifier/i })).toHaveAttribute('href', '/guides/claude-preparer-activite-bureautique');
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

  it('présente le parcours Claude lisible sans vidéo et ses médias accessibles', () => {
    const { container } = render(<MemoryRouter initialEntries={['/guides/claude-preparer-activite-bureautique']}><Routes><Route path="/guides/:slug" element={<GuidePage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: /claude : préparer et vérifier/i })).toBeInTheDocument();
    expect(screen.getByText(/cette activité a été relue/i)).toBeInTheDocument();
    expect(screen.getByText(/elle n’a pas été testée auprès d’apprenants/i)).toBeInTheDocument();
    expect(screen.getByText(/pas d’écart de total à corriger/i)).toBeInTheDocument();
    expect(container.querySelector('pre')).toHaveTextContent('Les durées doivent totaliser 20 minutes.');
    expect(container.querySelector('pre')).toHaveTextContent('Ne présente pas cette activité comme testée');
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(6);
    images.forEach(image => {
      expect(image).toHaveAttribute('width', '1680');
      expect(image).toHaveAttribute('height', '1120');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.getAttribute('alt').length).toBeGreaterThan(30);
    });
    const enlargements = screen.getAllByRole('link', { name: /agrandir la capture.*nouvel onglet/i });
    expect(enlargements).toHaveLength(6);
    enlargements.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    const toc = screen.getByRole('complementary', { name: 'Sommaire' });
    toc.querySelectorAll('a').forEach(link => expect(container.querySelector(link.getAttribute('href'))).not.toBeNull());
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('poster', '/assets/guides/claude/01-interface.jpg');
    expect(video.querySelector('source')).toHaveAttribute('src', '/assets/guides/claude/claude-activite-bureautique-v3.mp4');
    expect(video.querySelector('track')).toBeNull();
  });
});
