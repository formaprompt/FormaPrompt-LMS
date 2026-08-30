import { HelmetProvider } from 'react-helmet-async';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiagnosticRestitution from './DiagnosticRestitution';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../contexts/useAuth';
import { fetchPublishedDiagnosticRestitution } from '../lib/diagnosticRestitution';

const BOOKING_ID = '82000000-0000-4000-8000-000000000001';

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { publicClientOnly: true } }));
vi.mock('../lib/diagnosticRestitution', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchPublishedDiagnosticRestitution: vi.fn() };
});

function publishedRestitution() {
  return {
    id: 'restitution-test',
    booking_id: BOOKING_ID,
    status: 'published',
    published_at: '2026-09-12T10:00:00Z',
    corrected_at: '2026-09-14T10:00:00Z',
    overall_summary: 'Synthèse métier publiée fidèlement.',
    observed_maturity_level: 3,
    maturity_assessment: 'Les pratiques commencent à être structurées.',
    current_uses: 'Préparation de documents et synthèses.',
    strengths: ['Expertise métier'],
    watch_points: ['Données confidentielles'],
    priority_opportunities: [{
      title: 'Comptes rendus', expected_benefit: 'Réduire le temps de rédaction',
      effort: 'Faible', indicative_cost: 'Limité', risk_or_watchpoint: 'Anonymiser les exemples',
      first_action: 'Tester sur un cas fictif',
    }],
    recommendations: ['Formaliser une charte d’usage'],
    short_term_actions: [
      { action: 'Choisir un cas pilote', horizon: 'immediate' },
      { action: 'Mesurer le gain', horizon: '30_days' },
      { action: 'Décider du déploiement', horizon: '90_days' },
    ],
    recommended_tool_families: ['Assistant conversationnel'],
    privacy_rgpd_considerations: 'Minimiser les données et contrôler les sous-traitants.',
    ai_act_considerations: 'Maintenir une supervision humaine.',
    next_steps: 'Lancer le cas pilote puis faire un bilan.',
    booking: { id: BOOKING_ID, starts_at: '2026-09-10T08:00:00Z' },
  };
}

function renderPage(path = `/diagnostic-ia/restitution?booking_id=${BOOKING_ID}`) {
  return render(<HelmetProvider><MemoryRouter initialEntries={[path]}><DiagnosticRestitution /></MemoryRouter></HelmetProvider>);
}

describe('consultation client de la restitution Diagnostic IA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'user-client' } });
    fetchPublishedDiagnosticRestitution.mockResolvedValue(publishedRestitution());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
  });

  it('affiche un chargement sobre pendant la lecture sous RLS', () => {
    fetchPublishedDiagnosticRestitution.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre restitution');
  });

  it('reste inaccessible sans session authentifiée', () => {
    useAuth.mockReturnValue({ user: null });
    render(<MemoryRouter initialEntries={[`/diagnostic-ia/restitution?booking_id=${BOOKING_ID}`]}><Routes>
      <Route path="/login" element={<p>Connexion requise</p>} />
      <Route path="/diagnostic-ia/restitution" element={<RequireAuth><DiagnosticRestitution /></RequireAuth>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Connexion requise')).toBeVisible();
    expect(fetchPublishedDiagnosticRestitution).not.toHaveBeenCalled();
  });

  it('restitue fidèlement le document publié, ses opportunités et ses actions groupées', async () => {
    renderPage();
    expect(await screen.findByText('Synthèse métier publiée fidèlement.')).toBeVisible();
    expect(screen.getByText('3. Structuration')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Comptes rendus' })).toBeVisible();
    expect(screen.getByText('Tester sur un cas fictif')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Immédiat' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '30 jours' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '90 jours' })).toBeVisible();
    expect(screen.getByText('Minimiser les données et contrôler les sous-traitants.')).toBeVisible();
    expect(screen.getByText('Maintenir une supervision humaine.')).toBeVisible();
    expect(screen.getByText(/Restitution mise à jour le/)).toBeVisible();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow'));
  });

  it('affiche le même état générique lorsque RLS ne retourne aucune ligne', async () => {
    fetchPublishedDiagnosticRestitution.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Cette restitution n’est pas disponible.' })).toBeVisible();
    expect(screen.queryByText('Synthèse métier publiée fidèlement.')).not.toBeInTheDocument();
    expect(screen.queryByText(/autre utilisateur|appartient/i)).not.toBeInTheDocument();
  });

  it('ne lance aucune lecture avec un identifiant invalide', () => {
    renderPage('/diagnostic-ia/restitution?booking_id=../autre-client');
    expect(screen.getByRole('heading', { name: 'Cette restitution n’est pas disponible.' })).toBeVisible();
    expect(fetchPublishedDiagnosticRestitution).not.toHaveBeenCalled();
  });

  it('masque le détail Supabase lors d’une erreur technique et permet de réessayer', async () => {
    fetchPublishedDiagnosticRestitution.mockRejectedValueOnce(new Error('PGRST116 SQL relation secrète'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('problème technique');
    expect(screen.queryByText(/PGRST116|relation secrète/i)).not.toBeInTheDocument();
    fetchPublishedDiagnosticRestitution.mockResolvedValueOnce(publishedRestitution());
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Synthèse métier publiée fidèlement.')).toBeVisible();
  });

  it('déclenche uniquement l’impression native du navigateur', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimer ou enregistrer en PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
