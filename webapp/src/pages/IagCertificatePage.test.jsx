// Coordinator campaign source, NOT executed by producer (runtime dependencies unavailable).
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {IagCertificatePageContent} from './IagCertificatePage.jsx';
import IagCertificateDocument from '../components/IagCertificateDocument.jsx';
import IagCertificatePanel from '../components/IagCertificatePanel.jsx';
const mocks=vi.hoisted(()=>({api:null}));
vi.mock('../lib/iagCertificateApi.js',async importOriginal=>({...await importOriginal(),createIagCertificateApi:()=>mocks.api}));
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function row(name='Éva Exemple',type='iag_completion',id='9007199254740993',ownerId='A'){
 return {id,user_id:ownerId,course_id:'formation-ia-generative-elearning',document_type:type,
  reference:`FP-IAG-TEST-${id}`,issued_at:'2026-10-22T13:00:00Z',content_snapshot:{version:'iag-1',
   contentVersion:'iag-v7-2026-10-21-with-explicit-v8-media',learnerName:name,courseTitle:'Cours fictif',
   completedAt:'2026-10-22T12:00:00Z',objectives:['Préparer et vérifier.'],organization:{brandName:'FormaPrompt',legalName:'Thierry FREZARD EI'},
   traceability:{userId:ownerId,courseId:'formation-ia-generative-elearning',identitySource:'self_declared'},initialReference:type==='iag_success'?'FP-IAG-INITIAL':null}};
}
function page(props={}){return <MemoryRouter><IagCertificatePageContent userId="A" issuanceId="9007199254740993" supabase={{}} {...props}/></MemoryRouter>;}
afterEach(cleanup);beforeEach(()=>{mocks.api={readCertificate:vi.fn(async()=>row()),readIdentity:vi.fn(async()=>null),listCertificates:vi.fn(async()=>[]),declareIdentity:vi.fn(),issueCertificate:vi.fn()};});
describe('IAG private certificate rendering and session isolation',()=>{
 it('direct anonymous request shows no document or printing control',()=>{
  render(page({userId:null}));expect(screen.getByText(/Connectez-vous/)).not.toBeNull();expect(mocks.api.readCertificate).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Imprimer/})).toBeNull();
 });
 it('loading blocks print until authorized current result is rendered',async()=>{
  const d=defer();mocks.api.readCertificate.mockReturnValue(d.promise);render(page());
  expect(screen.getByRole('button',{name:/Imprimer/}).disabled).toBe(true);d.resolve(row());
  await screen.findByText('Éva Exemple');expect(screen.getByRole('button',{name:/Imprimer/}).disabled).toBe(false);
 });
 it('refusal displays contact and retry without a printable document',async()=>{
  mocks.api.readCertificate.mockRejectedValueOnce(new Error('REFUSED'));render(page());await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:/Imprimer/}).disabled).toBe(true);expect(screen.getByRole('link',{name:'Contacter FormaPrompt'}).getAttribute('href')).toBe('/contact');
  await userEvent.setup().click(screen.getByRole('button',{name:'Recharger'}));await screen.findByText('Éva Exemple');
 });
 it('changing account clears visible A before B completes and ignores late A',async()=>{
  const a=defer(),b=defer();mocks.api.readCertificate.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const view=render(page());view.rerender(page({userId:'B'}));expect(screen.queryByText('Éva Exemple')).toBeNull();
  a.resolve(row('Ancien nom A'));await Promise.resolve();expect(screen.queryByText('Ancien nom A')).toBeNull();
  b.resolve(row('Nom B','iag_completion','9007199254740993','B'));await screen.findByText('Nom B');
 });
 it('changing document ID hides previous snapshot and print while next read waits',async()=>{
  const view=render(page());await screen.findByText('Éva Exemple');const d=defer();mocks.api.readCertificate.mockReturnValueOnce(d.promise);
  view.rerender(page({issuanceId:'9007199254740994'}));expect(screen.queryByText('Éva Exemple')).toBeNull();expect(screen.getByRole('button',{name:/Imprimer/}).disabled).toBe(true);
  d.resolve(row('Nouveau document','iag_completion','9007199254740994'));await screen.findByText('Nouveau document');
 });
 it('staff may render a row authorized by server without a global client owner equality filter',async()=>{
  mocks.api.readCertificate.mockResolvedValue(row('Nom apprenant A'));render(page({userId:'staff',authorizationKey:'admin'}));await screen.findByText('Nom apprenant A');
  expect(screen.getByRole('button',{name:/Imprimer/}).disabled).toBe(false);
 });
 it('display differentiates completion and later success without exposing evidence or false attendance',()=>{
  const r=row('Nom fictif','iag_success');r.content_snapshot.traceability.workSources=[{points:20,real_trials_evidence:'SECRET-FIXTURE'}];
  render(<IagCertificateDocument issuance={r}/>);expect(screen.getByRole('heading',{name:/mention Réussite/})).not.toBeNull();expect(screen.queryByText('SECRET-FIXTURE')).toBeNull();
  expect(screen.queryByText(/777 minutes/)).toBeNull();expect(screen.getByText(/ne constitue pas une certification professionnelle reconnue/)).not.toBeNull();
 });
 it('nominal form requires explicit declaration before submitting minimal names',async()=>{
  render(<MemoryRouter><IagCertificatePanel userId="A" supabase={{}}/></MemoryRouter>);await screen.findByRole('textbox',{name:'Prénom'});
  const user=userEvent.setup();const save=screen.getByRole('button',{name:'Enregistrer ma déclaration'});expect(save.disabled).toBe(true);
  await user.type(screen.getByRole('textbox',{name:'Prénom'}),'Éva');await user.type(screen.getByRole('textbox',{name:'Nom'}),'Exemple');expect(mocks.api.declareIdentity).not.toHaveBeenCalled();
  await user.click(screen.getByRole('checkbox'));await user.click(save);
  await waitFor(()=>expect(mocks.api.declareIdentity).toHaveBeenCalledWith({firstName:'Éva',lastName:'Exemple',expectedIdentityId:null}));
 });
});
