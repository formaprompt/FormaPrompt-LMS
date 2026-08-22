import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EnrollmentLifecyclePanel from './EnrollmentLifecyclePanel';

const enrollment = {
  id: 'enrollment-1', user_id: 'user-1', course_id: 'formation-ia', status: 'validated',
  starts_at: '2026-09-01T08:00:00Z', ends_at: '2026-09-01T18:00:00Z',
  price_amount_cents: 49700, funding_status: 'partially_granted',
  funding_requested_cents: 49700, funding_granted_cents: 30000, funding_balance_cents: 19700,
  training_enrollment_events: [{ id: 'event-1', event_type: 'funding_updated', reason: 'Accord partiel reçu.', rights_impact: 'none', created_at: '2026-08-22T08:00:00Z' }],
  training_amendments: [{ id: 'amendment-1', amendment_number: 'FP-AV-2026-000001', reason: 'Report accepté.', created_at: '2026-08-22T09:00:00Z' }],
};

afterEach(cleanup);

describe('EnrollmentLifecyclePanel', () => {
  it('affiche le financement, les actions contrôlées et l historique figé', () => {
    render(<MemoryRouter><EnrollmentLifecyclePanel enrollment={enrollment} profiles={[]} running="" onAction={vi.fn()} /></MemoryRouter>);
    expect(screen.getAllByText('Accord partiel')).toHaveLength(2);
    expect(screen.getByText(/Reste : 197,00/)).toBeInTheDocument();
    expect(screen.getByText(/Aucun achat ni droit pédagogique/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir / imprimer' })).toHaveAttribute('href', '/admin/dossiers/avenants/amendment-1');
  });
});
