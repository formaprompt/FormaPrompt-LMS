import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import CourseBooking from './CourseBooking'
const m=vi.hoisted(()=>({access:vi.fn(),invoke:vi.fn(),from:vi.fn(),refresh:vi.fn(),rpc:vi.fn()}))
vi.mock('../contexts/useAuth',()=>({useAuth:()=>({user:{id:'user'},role:'learner'})}))
vi.mock('../lib/courseAccess',()=>({fetchActiveCourseAccess:m.access}))
vi.mock('../components/SEO',()=>({default:()=>null}))
vi.mock('../components/SignaturePad',()=>({default:()=>null}))
vi.mock('../lib/supabaseClient',()=>({supabase:{rpc:m.rpc,from:m.from,functions:{invoke:m.invoke},auth:{refreshSession:m.refresh}}}))
const slots=Array.from({length:28},(_,i)=>{const day=Math.floor(i/7),half=i%7;const start=new Date(Date.UTC(2027,0,10+day,8,half*30));return{id:`slot-${i}`,starts_at:start.toISOString(),ends_at:new Date(+start+1800000).toISOString(),delivery_modes:['remote','in_person']}})
let availableSlots=slots
beforeEach(()=>{m.rpc.mockResolvedValue({data:true,error:null});availableSlots=slots;m.access.mockResolvedValue({data:{id:'access',access_source:'gift',purchase_id:null},error:null});m.refresh.mockResolvedValue({data:{session:{access_token:'token'}},error:null});m.invoke.mockResolvedValue({data:{booking_request_id:'booking'},error:null});m.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,in:()=>q,gt:()=>q,maybeSingle:()=>Promise.resolve({data:null,error:null}),order:()=>Promise.resolve({data:availableSlots,error:null})};return q})})
afterEach(()=>{cleanup();vi.clearAllMocks()})
const show=()=>render(<MemoryRouter initialEntries={['/reservation-formation?course=ia-creativite-individuel']}><CourseBooking/></MemoryRouter>)
it('cadeau actif : affiche les deux formats14h et présentiel Calais sans commune ni frais',async()=>{show();await screen.findByText('4 demi-journées de 3 h 30');expect(screen.getByText('2 journées de 2 × 3 h 30 avec pause')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:/Présentiel/}));expect(screen.getByText('À Calais')).toBeVisible();expect(screen.queryByLabelText('Code postal')).toBeNull();expect(screen.queryByText(/30 €/)).toBeNull()})
it('4 demi journées distinctes transmettent28slots au moteur existant',async()=>{show();await screen.findAllByRole('checkbox');for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);fireEvent.click(screen.getAllByRole('button',{name:'Confirmer mes séances'})[0]);await waitFor(()=>expect(m.invoke).toHaveBeenCalledWith('create-course-booking',expect.objectContaining({body:expect.objectContaining({course_id:'ia-creativite-individuel',schedule_format:'four_half_days_3h30',slot_ids:slots.map(s=>s.id)})})))})
it('achat actif payé autorise le calendrier',async()=>{m.access.mockResolvedValue({data:{id:'access',access_source:'purchase',purchase_id:'purchase'}});show();await screen.findByText('4 demi-journées de 3 h 30');expect(m.rpc).toHaveBeenCalledWith('has_creativity_booking_access',{p_course_id:'ia-creativite-individuel'});expect(m.from).not.toHaveBeenCalledWith('purchases')})
it('remboursement sans achat éligible refuse même si course_access reste actif',async()=>{m.rpc.mockResolvedValue({data:false,error:null});m.access.mockResolvedValue({data:{id:'access',access_source:'purchase',purchase_id:'purchase'}});show();await screen.findByText('Accès à la formation requis');expect(screen.queryByRole('checkbox')).toBeNull()})
it('droit absent bloque le calendrier',async()=>{m.access.mockResolvedValue({data:null,error:null});show();await screen.findByText('Accès à la formation requis');expect(m.from).not.toHaveBeenCalled()})

it('2 journées avec pause choisissent28slots au présentiel Calais',async()=>{
  availableSlots=slots.map((slot,i)=>{const group=Math.floor(i/7),start=new Date(Date.UTC(2027,0,10+Math.floor(group/2),group%2?13:8,(i%7)*30));return{...slot,starts_at:start.toISOString(),ends_at:new Date(+start+1800000).toISOString()}})
  show();await screen.findAllByRole('checkbox');fireEvent.click(screen.getByRole('button',{name:/Présentiel/}));fireEvent.click(screen.getByRole('button',{name:/2 journées/}));for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox)
  fireEvent.click(screen.getAllByRole('button',{name:'Confirmer mes séances à Calais'})[0]);await waitFor(()=>expect(m.invoke).toHaveBeenCalledWith('create-course-booking',expect.objectContaining({body:expect.objectContaining({delivery_mode:'in_person',schedule_format:'two_days_2x3h30',slot_ids:slots.map(s=>s.id)})})))
})

for (const source of ['manual', 'opco']) it(`dossier validé ${source} : le serveur autorise sans achat fictif`, async () => {
  m.access.mockResolvedValue({data:{id:'access',access_source:source,purchase_id:null},error:null})
  show()
  await screen.findByText('4 demi-journées de 3 h 30')
  expect(m.rpc).toHaveBeenCalledWith('has_creativity_booking_access', {p_course_id:'ia-creativite-individuel'})
  expect(m.rpc.mock.calls[0][1]).toEqual({p_course_id:'ia-creativite-individuel'})
  expect(m.from).not.toHaveBeenCalledWith('purchases')
})
it('dossier manuel non admissible : aucun créneau chargé', async () => {
  m.access.mockResolvedValue({data:{id:'access',access_source:'manual',purchase_id:null},error:null})
  m.rpc.mockResolvedValue({data:false,error:null})
  show()
  await screen.findByText('Accès à la formation requis')
  expect(m.from).not.toHaveBeenCalled()
})
it('erreur serveur : accès fermé sans charger de créneau', async () => {
  const log = vi.spyOn(console,'error').mockImplementation(()=>{})
  m.rpc.mockResolvedValue({data:null,error:{message:'RPC indisponible'}})
  show()
  await screen.findByText('Accès à la formation requis')
  expect(m.from).not.toHaveBeenCalled()
  log.mockRestore()
})
it('cadeau pour une autre formule refusé par le serveur', async () => {
  m.rpc.mockResolvedValue({data:false,error:null})
  show()
  await screen.findByText('Accès à la formation requis')
  expect(m.rpc).toHaveBeenCalledWith('has_creativity_booking_access',{p_course_id:'ia-creativite-individuel'})
  expect(m.from).not.toHaveBeenCalled()
})
it('offre bureautique individuelle conserve son contrôle existant', async () => {
  render(<MemoryRouter initialEntries={['/reservation-formation?course=excel-initiation-individuel']}><CourseBooking/></MemoryRouter>)
  await screen.findByText('4 demi-journées de 3 h 30')
  expect(m.rpc).not.toHaveBeenCalled()
})
