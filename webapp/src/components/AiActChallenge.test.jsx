import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiActChallenge from './AiActChallenge';

vi.mock('../lib/aiActChallenge', async (importOriginal) => ({
  ...await importOriginal(),
  challengeTrainingApi: vi.fn().mockResolvedValue({ state:'ongoing', revision:0, declared_ended_at:null, ended_at:null, due_at:null }),
}));

afterEach(cleanup);
const questions = Array.from({length:12},(_,i) => ({code:`Q${String(i+1).padStart(2,'0')}`,theme:'Thème fictif',scenario:`Situation fictive ${i+1}`,options:[{code:'A',text:'Choix alpha'},{code:'B',text:'Choix beta'},{code:'C',text:'Choix gamma'}]}));
const open = (answers = {}) => ({course_id:'formation-ia-act',status:'in_progress',can_start:false,questions,attempts:[{id:'t1',number:1,status:'in_progress',revision:1,answers,answered_count:Object.keys(answers).length,results:null}],best_score:null,last_score:null});
const welcome = { ...open(),status:'not_started',can_start:true,attempts:[] };
async function resume(api) { render(<AiActChallenge api={api} />); fireEvent.click(await screen.findByRole('button',{name:'Reprendre ma tentative 1'})); fireEvent.click(screen.getByRole('button',{name:'Reprendre les questions'})); }

describe('AI ACT CHALLENGE apprenant', () => {
  it('informe dès l’accueil sur les données, la conservation et les droits sans appel de mutation', async () => {
    const api = vi.fn().mockResolvedValue(welcome);
    render(<AiActChallenge api={api} />);
    await screen.findByRole('button', { name: 'Commencer', exact: true });
    expect(screen.getByRole('complementary', { name: 'Confidentialité du Challenge' })).toBeVisible();
    expect(screen.getByText(/12 mois après sa fin effective vérifiée/i)).toBeVisible();
    fireEvent.click(screen.getByText('Conservation et droits', { exact: true }));
    expect(screen.getByText(/compteur de tentatives et les traces techniques du jeu/i)).toBeVisible();
    expect(screen.getByText(/simple connexion ou le maintien de votre accès ne valent pas reprise/i)).toBeVisible();
    expect(screen.getByText(/ne sont transmis ni à un fournisseur d’IA ni à Google Analytics/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'thierry@formaprompt.com' })).toHaveAttribute('href', 'mailto:thierry@formaprompt.com');
    expect(screen.getByRole('link', { name: /politique de confidentialité du Challenge/i })).toHaveAttribute('href', '/politique-confidentialite#ai-act-challenge');
    expect(screen.getByText(/Aucune suppression automatique de données réelles n’est activée/i)).toBeVisible();
    expect(api.mock.calls.map(([action]) => action)).toEqual(['state']);
  });
  it('ne révèle ni score ni correction avant clôture et ne clôture pas une tentative incomplète', async () => {
    await resume(vi.fn().mockResolvedValue(open()));
    expect(screen.getByRole('button',{name:'Terminer ma tentative'})).toBeDisabled();
    expect(screen.queryByText(/Réponse attendue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Meilleur score/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Situation fictive 1'})).toBeInTheDocument();
  });
  it('confirme une réponse uniquement après acquittement serveur', async () => {
    let resolveSave;
    const api = vi.fn((action) => action === 'save' ? new Promise((resolve) => {resolveSave=resolve;}) : Promise.resolve(open()));
    await resume(api); fireEvent.click(screen.getByLabelText(/Choix alpha/));
    expect(screen.getByRole('status')).toHaveTextContent('Enregistrement en cours');
    expect(screen.getByRole('button',{name:'Question suivante →'})).toBeDisabled();
    resolveSave(open({Q01:'A'}));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('confirmée par le serveur'));
    expect(screen.getByLabelText(/Choix alpha/)).toBeChecked();
  });
  it('réessaie le même enregistrement réseau sans inventer une sauvegarde', async () => {
    let saves=0;
    const api = vi.fn(async (action) => {if(action==='save' && ++saves===1) throw new Error('network'); return action==='save' ? open({Q01:'B'}) : open();});
    await resume(api); fireEvent.click(screen.getByLabelText(/Choix beta/));
    await screen.findByRole('alert');
    expect(screen.getByRole('button',{name:'Question suivante →'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));
    await waitFor(() => expect(screen.getByLabelText(/Choix beta/)).toBeChecked());
    const mutations=api.mock.calls.filter(([action]) => action==='save');
    expect(mutations[0][1]).toEqual(mutations[1][1]);
  });
  it('sur conflit recharge le serveur sans rejouer la réponse locale', async () => {
    let reads=0;
    const api=vi.fn(async (action) => {if(action==='save') throw new Error('REVISION_CONFLICT'); return ++reads===1 ? open() : open({Q01:'C'});});
    await resume(api); fireEvent.click(screen.getByLabelText(/Choix alpha/));
    fireEvent.click(await screen.findByRole('button',{name:'Recharger les réponses'}));
    fireEvent.click(await screen.findByRole('button',{name:'Reprendre ma tentative 1'}));
    fireEvent.click(screen.getByRole('button',{name:'Reprendre les questions'}));
    expect(api.mock.calls.filter(([action])=>action==='save')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'← Question précédente'}));
    expect(screen.getByLabelText(/Choix gamma/)).toBeChecked();
  });
  it('exige une confirmation humaine puis affiche les corrections exactes serveur', async () => {
    const answers=Object.fromEntries(questions.map((q) => [q.code,'A']));
    const finished={...open(answers),status:'passed',can_start:true,best_score:9,last_score:9,attempts:[{...open(answers).attempts[0],status:'passed',score:9,percentage:75,finished_at:'2026-10-08T12:00:00Z',results:[{question_code:'Q01',selected_option:'A',correct_option:'C',is_correct:false,explanation:'Texte exact fictif du serveur.',remediation:'Conseil exact fictif.',example:'Exemple exact fictif.',takeaway:'Message exact fictif.',legal_reference:'Référence exacte fictive.'}]}]};
    const api=vi.fn(async(action)=>action==='finish'?finished:open(answers));
    await resume(api); fireEvent.click(screen.getByRole('button',{name:'Terminer ma tentative'}));
    expect(api.mock.calls.some(([action])=>action==='finish')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Confirmer la clôture définitive'}));
    fireEvent.click(await screen.findByRole('button',{name:'Voir toutes les corrections'}));
    expect(screen.getByRole('complementary', { name: 'Confidentialité du Challenge' })).toBeVisible();
    expect(screen.getByRole('link', { name: /politique de confidentialité du Challenge/i })).toBeVisible();
    expect(screen.getByText('Texte exact fictif du serveur.')).toBeInTheDocument();
    expect(screen.getByText('Conseil exact fictif.')).toBeInTheDocument();
    expect(screen.getByText('Exemple exact fictif.')).toBeInTheDocument();
    expect(screen.getByText('Message exact fictif.')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Commencer la tentative 2'})).toBeInTheDocument();
    expect(api.mock.calls.find(([action])=>action==='finish')[1].confirmed).toBe(true);
  });
  it('un refus serveur retire le questionnaire et ses réponses', async () => {
    const api=vi.fn(async(action)=>{if(action==='save') throw new Error('ACCESS_DENIED');return open();});
    await resume(api);fireEvent.click(screen.getByLabelText(/Choix alpha/));
    await screen.findByRole('alert');expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
  it('commence sans calcul de score local et en transmettant le cours', async () => {
    const api=vi.fn(async(action)=>action==='start'?open():welcome);
    render(<AiActChallenge api={api} />); fireEvent.click(await screen.findByRole('button',{name:'Commencer'}));
    await screen.findByRole('heading',{name:'Situation fictive 1'});
    expect(api.mock.calls.find(([action])=>action==='start')[1].course_id).toBe('formation-ia-act');
  });
  it('réessaie une création avec le même UUID et reprend le questionnaire après acquittement',async()=>{
    let calls=0;const api=vi.fn(async(action)=>{if(action==='start' && ++calls===1)throw new Error('network');return action==='start'?open():welcome;});
    render(<AiActChallenge api={api} />);fireEvent.click(await screen.findByRole('button',{name:'Commencer'}));
    fireEvent.click(await screen.findByRole('button',{name:'Réessayer'}));
    await screen.findByRole('heading',{name:'Situation fictive 1'});
    const mutations=api.mock.calls.filter(([action])=>action==='start');
    expect(mutations[0][1].request_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(mutations[0][1]).toEqual(mutations[1][1]);
  });
  it('ignore une réponse obsolète après changement de périmètre API',async()=>{
    let oldResolve;const oldApi=vi.fn(()=>new Promise((resolve)=>{oldResolve=resolve;}));
    const newApi=vi.fn().mockRejectedValue(new Error('ACCESS_DENIED'));
    const {rerender}=render(<AiActChallenge api={oldApi} />);
    await waitFor(()=>expect(oldApi).toHaveBeenCalled());rerender(<AiActChallenge api={newApi} />);
    await screen.findByRole('alert');oldResolve(welcome);
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Commencer'})).not.toBeInTheDocument());
  });
});
