import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuideGeminiPratique from './GuideGeminiPratique';
import Guides from './Guides';
import { getPracticalGuide } from '../data/practicalGuides';
vi.mock('../components/SEO', () => ({ default: () => null }));
afterEach(cleanup);

describe('Guide Gemini multimodal', () => {
  it('relie Gemini depuis le catalogue et conserve le sommaire du guide débutant', () => {
    render(<MemoryRouter><Guides /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /guide gemini : utiliser le texte/i })).toHaveAttribute('href', '/guides/gemini-guide-pratique');
    expect(getPracticalGuide('gemini-guide-pratique')).toBeDefined();
    expect(getPracticalGuide('ia-generative-debutants').sections).toContainEqual({ id: 'verifier-reponse', label: 'Vérifier une réponse' });
  });
  it('conserve cinq consignes lisibles, leurs contrôles et les limites françaises', () => {
    const { container } = render(<MemoryRouter><GuideGeminiPratique /></MemoryRouter>);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const panels = [...container.querySelectorAll('.tool-guide-panels details')];
    expect(panels).toHaveLength(5);
    panels.forEach(panel => {
      ['Contexte', 'Rôle', 'Objectif', 'Précisions'].forEach(label => expect(panel.querySelector('.tool-guide-prompt')).toHaveTextContent(label));
      expect(panel).toHaveTextContent('Contrôle humain');
    });
    within(screen.getByRole('navigation', { name: 'Dans ce guide' })).getAllByRole('link').forEach(link => expect(container.querySelector(link.getAttribute('href'))).not.toBeNull());
    expect(screen.getByRole('table', { name: /comptes personnels/i })).toHaveTextContent('219,99 €');
    expect(screen.getByText(/L’import d’une vidéo pour le montage n’est pas disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /télécharger le guide gemini en pdf/i })).toHaveAttribute('download');
  });
  it('rouvre le même choix après fermeture native et copie le CROP complet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<MemoryRouter><GuideGeminiPratique /></MemoryRouter>);
    const choice = screen.getByRole('button', { name: /structurer une note vocale/i });
    fireEvent.click(choice);
    const panel = container.querySelector('#gemini-case-1');
    panel.open = false;
    fireEvent.click(choice);
    expect(panel.open).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Copier la consigne' }));
    expect(await within(panel).findByText(/Consigne copiée/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Précisions : Dans le tableau'));
  });
});
