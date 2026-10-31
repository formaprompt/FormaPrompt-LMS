import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IagAssessmentPanel from './IagAssessmentPanel.jsx';
import IagAdminAssessments from './IagAdminAssessments.jsx';
const world = vi.hoisted(() => ({ api: null }));
vi.mock('../lib/iagAssessmentApi.js', () => ({ createIagAssessmentApi: () => world.api }));
const rubrics = label => Object.fromEntries(['1', '2', '3'].map(workId => [workId, {
  workId, version: 'v7-2026-10-21', observations: Array.from({ length: 20 }, (_, i) => ({ id: `${workId}.1.${i + 1}`, group: 'Fictif', label: `${label} fictif ${i + 1}` })),
  essentials: [{ id: 'E1', label: `${label} essentiel fictif` }],
}]));
beforeEach(() => { world.api = { loadHistory: vi.fn(async () => []), loadRubrics: vi.fn(async () => rubrics('API')) }; });
afterEach(cleanup);
it('learner displays loading, server error and retry without any embedded rubric fallback', async () => {
  world.api.loadRubrics.mockRejectedValueOnce(new Error('Grille privée indisponible.'));
  render(<IagAssessmentPanel supabase={{}} userId="A" />);
  expect((await screen.findByRole('alert')).textContent).toBe('Grille privée indisponible.');
  expect(screen.queryByText('Mes trois travaux et mes retours')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Recharger mes travaux' }));
  await screen.findByText('Mes trois travaux et mes retours'); expect(world.api.loadRubrics).toHaveBeenCalledTimes(2);
});
it('staff fetches the protected rubric before showing the correction form and can retry refusal', async () => {
  world.api.loadHistory.mockResolvedValue([{ user_id: 'A', work_id: '1', response_id: '1', ordinal: 1, due_at: '2026-10-26T09:00:00Z' }]);
  world.api.loadRubrics.mockRejectedValueOnce(new Error('Personnel non habilité.'));
  render(<IagAdminAssessments supabase={{}} viewerId="S" />);
  expect((await screen.findByRole('alert')).textContent).toBe('Personnel non habilité.');
  expect(screen.queryByRole('form')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Actualiser les remises' }));
  await screen.findByText(/1 version\(s\) affichée/);
  expect(world.api.loadRubrics).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Fictif — API fictif 1')).not.toBeNull();
});
it('changing learner immediately clears the previous account rubric while the next one loads', async () => {
  world.api.loadRubrics.mockResolvedValueOnce(rubrics('Ancien'));
  const client = {}; const view = render(<IagAssessmentPanel supabase={client} userId="A" />);
  await screen.findByText('Mes trois travaux et mes retours');
  let resolve; world.api.loadRubrics.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  view.rerender(<IagAssessmentPanel supabase={client} userId="B" />);
  expect(screen.queryByText('Mes trois travaux et mes retours')).toBeNull();
  await waitFor(() => expect(typeof resolve).toBe('function')); resolve(rubrics('Nouveau'));
  await screen.findByText('Mes trois travaux et mes retours');
  expect(world.api.loadHistory).toHaveBeenLastCalledWith('B');
});
