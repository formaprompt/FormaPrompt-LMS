import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiActChallengeTrainer from './AiActChallengeTrainer';
import { AuthContext } from '../contexts/auth-context';
afterEach(cleanup);
const overview={is_admin:false,learners:[{user_id:'u1',display_name:'Apprenant fictif',identity_status:'available',active:true,status:'passed',attempt_count:1,answered_count:0,best_score:9,last_score:9,last_finished_at:'2026-10-08T12:00:00Z'}],stats:{population:1,active:1,started:1,finished:1,not_started:0,in_progress:0,passed:1,failed:0,average_best_score:9,success_rate_population:100,success_rate_finished:100},themes:[{theme:'Thème fictif',errors:1,total:2,sample_size:1}],questions:[{code:'Q01',theme:'Thème fictif',errors:1,total:1}]};
it('formateur habilité : lecture seule, effectifs, recherche et absence gestion admin', async()=>{
  render(<AiActChallengeTrainer api={vi.fn().mockResolvedValue(overview)} />);
  await screen.findByText('Apprenant fictif');
  expect(screen.queryByText('Habilitations formateur')).not.toBeInTheDocument();
  expect(screen.getByText(/Population : 1 bénéficiaires/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Rechercher par nom'),{target:{value:'inconnu'}});
  expect(screen.queryByText('Apprenant fictif')).not.toBeInTheDocument();
});
it('retrait d’habilitation : consultation suivante refusée, données retirées', async()=>{
  let calls=0;const api=vi.fn(async()=>{if(++calls>1)throw new Error('ACCESS_DENIED');return overview;});
  render(<AiActChallengeTrainer api={api} />);await screen.findByText('Apprenant fictif');
  fireEvent.click(screen.getByRole('button',{name:'Actualiser les résultats'}));await screen.findByRole('alert');
  expect(screen.queryByText('Apprenant fictif')).not.toBeInTheDocument();
});
it('admin strict : habilitation UUID limitée au cours et acquittement', async()=>{
  const api=vi.fn(async(action)=>action==='grant'?{grants:[]}:({...overview,is_admin:true}));
  render(<AiActChallengeTrainer api={api} />);await screen.findByText('Habilitations formateur');
  fireEvent.change(screen.getByLabelText('Identifiant utilisateur (UUID)'),{target:{value:'00000000-0000-0000-0000-000000000001'}});
  fireEvent.click(screen.getByRole('button',{name:'Accorder l’habilitation AI Act'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Habilitation enregistrée'));
  expect(api.mock.calls.find(([action])=>action==='grant')[1]).toEqual({course_id:'formation-ia-act',user_id:'00000000-0000-0000-0000-000000000001',active:true});
});
it('changement de périmètre API retire les résultats et ignore les anciennes requêtes',async()=>{
  let resolveOld;const oldApi=vi.fn(()=>new Promise((resolve)=>{resolveOld=resolve;}));
  const newApi=vi.fn().mockRejectedValue(new Error('ACCESS_DENIED'));
  const {rerender}=render(<AiActChallengeTrainer api={oldApi} />);
  await waitFor(()=>expect(oldApi).toHaveBeenCalled());rerender(<AiActChallengeTrainer api={newApi} />);
  await screen.findByRole('alert');resolveOld({...overview,is_admin:true});
  await waitFor(()=>expect(screen.queryByText('Apprenant fictif')).not.toBeInTheDocument());
  expect(screen.queryByText('Habilitations formateur')).not.toBeInTheDocument();
});

it.each(['employee', 'trainer', 'user'])('le rôle %s ne peut pas formaliser une fin même avec un indicateur admin reçu', async (role) => {
  const api = vi.fn(async (action) => action === 'trainer_detail' ? { user_id:'u1',display_name:'Apprenant fictif',status:'passed',attempts:[],questions:[] } : { ...overview, is_admin:true });
  const trainingAdminApi = vi.fn();
  render(<AuthContext.Provider value={{ role }}><AiActChallengeTrainer api={api} trainingAdminApi={trainingAdminApi} /></AuthContext.Provider>);
  fireEvent.click(await screen.findByRole('button', { name: /Voir le détail/ }));
  await screen.findByText('Aucune tentative démarrée.');
  expect(screen.queryByRole('region', { name:'Vérification administrative de la fin' })).not.toBeInTheDocument();
  expect(trainingAdminApi).not.toHaveBeenCalled();
});

it('admin strict : consulter un apprenant ouvre ses justificatifs via la RPC dédiée', async () => {
  const api = vi.fn(async (action) => action === 'trainer_detail' ? { user_id:'u1',display_name:'Apprenant fictif',status:'passed',attempts:[],questions:[] } : { ...overview, is_admin:true });
  const trainingAdminApi = vi.fn().mockResolvedValue({ status:{state:'ongoing',revision:0},history:[],evidence_candidates:{attestations:[],documents:[]} });
  render(<AuthContext.Provider value={{ role:'admin' }}><AiActChallengeTrainer api={api} trainingAdminApi={trainingAdminApi} /></AuthContext.Provider>);
  fireEvent.click(await screen.findByRole('button', { name:/Voir le détail/ }));
  await screen.findByRole('region', { name:'Vérification administrative de la fin' });
  await waitFor(() => expect(trainingAdminApi).toHaveBeenCalledWith('analyse', {subject_user_id:'u1'}));
});
