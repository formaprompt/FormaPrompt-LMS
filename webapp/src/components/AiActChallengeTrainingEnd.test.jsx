import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiActChallengeTrainingEnd, { AiActChallengeTrainingEndAdmin } from './AiActChallengeTrainingEnd';

afterEach(cleanup);
const ongoing = { revision: 0, state: 'ongoing', declared_ended_at: null, ended_at: null, due_at: null };
const analysis = { status: ongoing, closure: null, history: [], evidence_candidates: { attestations: [{ id: 'piece-fictive', title: 'Justificatif fictif', content_snapshot: { learner: 'Fictif' } }], documents: [] } };

it('déclaration distincte : confirmation humaine, acquittement serveur et aucun délai', async () => {
  const api = vi.fn(async (action, payload) => action === 'declare' ? { ...ongoing, revision: 1, state: 'declared', declared_ended_at: payload.declared_ended_at } : ongoing);
  render(<AiActChallengeTrainingEnd api={api} />);
  const button = await screen.findByRole('button', { name: 'Déclarer la fin de ma formation' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Date de fin déclarée'), { target: { value: '2026-10-08T12:00' } });
  fireEvent.click(screen.getByLabelText(/Je déclare avoir terminé/));
  fireEvent.click(button);
  await screen.findByText('Fin déclarée · vérification en attente');
  expect(screen.getByText(/Aucun délai de conservation ne démarre/)).toBeVisible();
  expect(screen.queryByText(/Échéance de conservation/)).not.toBeInTheDocument();
  expect(api.mock.calls[1][1]).toMatchObject({ expected_revision: 0, confirmed: true });
});

it('échec réseau : réessaie la même déclaration sans confirmation inventée', async () => {
  let calls = 0;
  const api = vi.fn(async (action) => { if (action === 'declare' && ++calls === 1) throw new Error('network'); return action === 'declare' ? { ...ongoing, state: 'declared', revision: 1 } : ongoing; });
  render(<AiActChallengeTrainingEnd api={api} />);
  await screen.findByRole('button', { name: 'Déclarer la fin de ma formation' });
  fireEvent.change(screen.getByLabelText('Date de fin déclarée'), { target: { value: '2026-10-08T12:00' } });
  fireEvent.click(screen.getByLabelText(/Je déclare avoir terminé/));
  fireEvent.click(screen.getByRole('button', { name: 'Déclarer la fin de ma formation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Réessayer la même demande' }));
  await screen.findByText('Fin déclarée · vérification en attente');
  const mutations = api.mock.calls.filter(([action]) => action === 'declare');
  expect(mutations[0][1]).toEqual(mutations[1][1]);
});

it('la date effective affichée provient de la vérification, jamais de completed_at', async () => {
  render(<AiActChallengeTrainingEnd api={vi.fn().mockResolvedValue({ ...ongoing, state: 'verified', ended_at: '2026-10-01T12:00:00Z', verified_at: '2026-10-09T12:00:00Z', completed_at: '2030-01-01T12:00:00Z', due_at: '2027-10-01T12:00:00Z' })} />);
  await screen.findByText(/Fin effective vérifiée :/);
  expect(screen.getByText(/Échéance de conservation/)).toBeVisible();
  expect(screen.queryByText(/2030/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Déclarer la fin de ma formation' })).not.toBeInTheDocument();
});

it('admin : examen des pièces et double confirmation avant décision effective', async () => {
  const api = vi.fn(async (action) => action === 'verify' ? { ...analysis, status: { ...ongoing, state: 'verified', revision: 1, ended_at: '2026-10-01T12:00:00Z' } } : analysis);
  render(<AiActChallengeTrainingEndAdmin subjectUserId="apprenant-fictif" api={api} />);
  const button = await screen.findByRole('button', { name: 'Enregistrer la fin effective vérifiée' });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByText('Examiner les justificatifs disponibles'));
  expect(screen.getByText('Fictif')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Date de fin effective vérifiée'), { target: { value: '2026-10-01T12:00' } });
  fireEvent.change(screen.getByLabelText(/Motif de décision/), { target: { value: 'fin_fictive' } });
  fireEvent.change(screen.getByLabelText('Justificatif examiné'), { target: { value: 'attestation:piece-fictive' } });
  fireEvent.click(screen.getByLabelText(/J’ai consulté le justificatif/));
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Je confirme cette décision/));
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Enregistrer la fin effective vérifiée' })).not.toBeInTheDocument());
  expect(api.mock.calls.find(([action]) => action === 'verify')[1]).toMatchObject({ subject_user_id: 'apprenant-fictif', expected_revision: 0, reason_code: 'FIN_FICTIVE', evidence_kind: 'attestation', evidence_id: 'piece-fictive', evidence_reviewed: true, confirmed: true });
});

it('retrait admin : retire le dossier sur un nouveau périmètre refusé', async () => {
  let reads = 0;
  const api = vi.fn(async () => { if (++reads > 1) throw new Error('ACCESS_DENIED'); return analysis; });
  const { rerender } = render(<AiActChallengeTrainingEndAdmin subjectUserId="u1" api={api} />);
  await screen.findByLabelText('Justificatif examiné');
  rerender(<AiActChallengeTrainingEndAdmin subjectUserId="u2" api={api} />);
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('Justificatif examiné')).not.toBeInTheDocument();
});

it('révision motivée : conflit impose une recharge sans rejouer la décision', async () => {
  const verified = { ...analysis, closure:{revision:1,verified_by:'admin-fictif'},status:{...ongoing,state:'verified',revision:1,ended_at:'2026-10-01T12:00:00Z'} };
  const api = vi.fn(async (action) => { if (action === 'reopen') throw new Error('REVISION_CONFLICT'); return verified; });
  render(<AiActChallengeTrainingEndAdmin subjectUserId="u1" api={api} />);
  await screen.findByLabelText('Décision de révision');
  fireEvent.change(screen.getByLabelText('Décision de révision'), {target:{value:'reopen'}});
  fireEvent.change(screen.getByLabelText(/Motif de révision/), {target:{value:'reprise_fictive'}});
  fireEvent.click(screen.getByLabelText(/Je confirme la décision sélectionnée/));
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer la révision motivée'}));
  fireEvent.click(await screen.findByRole('button',{name:'Recharger la fin de formation'}));
  await waitFor(() => expect(api.mock.calls.filter(([action])=>action==='analyse')).toHaveLength(2));
  expect(api.mock.calls.filter(([action])=>action==='reopen')).toHaveLength(1);
  expect(api.mock.calls.find(([action])=>action==='reopen')[1]).toMatchObject({expected_revision:1,confirmed:true,reason_code:'REPRISE_FICTIVE'});
});

it('réexamen admin : une erreur réseau réessaie la demande identique et retire l’échéance après acquittement', async () => {
  const verified = { ...analysis, closure:{revision:1},status:{...ongoing,state:'verified',revision:1,ended_at:'2026-10-01T12:00:00Z',due_at:'2027-10-01T12:00:00Z'} };
  let mutations = 0;
  const api = vi.fn(async (action) => { if (action === 'review') { if (++mutations === 1) throw new Error('network'); return {...analysis,status:{...ongoing,state:'review_required',revision:2}}; } return verified; });
  render(<AiActChallengeTrainingEndAdmin subjectUserId="u1" api={api} />);
  await screen.findByLabelText('Décision de révision');
  fireEvent.change(screen.getByLabelText(/Motif de révision/), {target:{value:'revision_fictive'}});
  fireEvent.click(screen.getByLabelText(/Je confirme la décision sélectionnée/));
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer la révision motivée'}));
  fireEvent.click(await screen.findByRole('button',{name:'Réessayer la même demande'}));
  await screen.findByText('Dossier à examiner');
  const calls = api.mock.calls.filter(([action])=>action==='review');
  expect(calls[0][1]).toEqual(calls[1][1]);
  expect(screen.queryByText(/Échéance de conservation/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/J’ai consulté le justificatif/)).not.toBeChecked();
});
