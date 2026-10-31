import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({role:'admin',invoke:vi.fn()}));
vi.mock('../contexts/useAuth',()=>({useAuth:()=>({user:{id:'admin'},role:api.role})}));
vi.mock('../lib/supabaseClient',()=>({supabase:{functions:{invoke:api.invoke}}}));
import AdminEmailNotifications from './AdminEmailNotifications';
const row={id:'20000000-0000-4000-8000-000000000001',source_id:'30000000-0000-4000-8000-000000000001',kind:'contact_request',status:'failed',attempts:1,error_code:'smtp_timeout',created_at:'2026-10-31T10:00:00Z'};
describe('suivi administrateur des alertes',()=>{
  beforeEach(()=>{api.role='admin';api.invoke.mockReset().mockResolvedValue({data:{rows:[row]}});});
  afterEach(()=>{cleanup();vi.restoreAllMocks();});
  it('charge uniquement le suivi et ne renvoie aucun e-mail à l’ouverture',async()=>{
    render(<AdminEmailNotifications/>);await screen.findByText(/Échec — non envoyé/);
    expect(api.invoke).toHaveBeenCalledTimes(1);expect(api.invoke).toHaveBeenCalledWith('admin-email-notifications',{body:{action:'list'}});
  });
  it('exige une confirmation explicite avant chaque reprise ciblée',async()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);render(<AdminEmailNotifications/>);
    fireEvent.click(await screen.findByRole('button',{name:'Réessayer cette alerte',hidden:true}));expect(api.invoke).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Réessayer cette alerte',hidden:true}));
    await waitFor(()=>expect(api.invoke).toHaveBeenCalledWith('admin-email-notifications',{body:{action:'retry',id:row.id,acknowledgePossibleDuplicate:false}}));
  });
  it('avertit du risque de doublon si le résultat précédent est incertain',async()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);api.invoke.mockResolvedValue({data:{rows:[{...row,status:'uncertain'}]}});
    render(<AdminEmailNotifications/>);fireEvent.click(await screen.findByRole('button',{name:'Vérifier puis réessayer',hidden:true}));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('un doublon est possible'));
    await waitFor(()=>expect(api.invoke).toHaveBeenCalledWith('admin-email-notifications',{body:{action:'retry',id:row.id,acknowledgePossibleDuplicate:true}}));
  });
  it.each(['employee','user'])('ne demande aucune donnée pour le rôle %s',async(role)=>{
    api.role=role;const{container}=render(<AdminEmailNotifications/>);expect(container).toBeEmptyDOMElement();await new Promise((resolve)=>setTimeout(resolve,0));expect(api.invoke).not.toHaveBeenCalled();
  });
});
