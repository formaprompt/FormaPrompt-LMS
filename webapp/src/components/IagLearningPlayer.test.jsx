// Synthetic API fixtures; the real session controller remains under test.
import {StrictMode} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IagLearningPlayer from './IagLearningPlayer.jsx';
const world=vi.hoisted(()=>({user:{id:'A'},api:null,navigate:vi.fn()}));
vi.mock('../contexts/useAuth',()=>({useAuth:()=>({user:world.user})}));
vi.mock('../lib/supabaseClient',()=>({supabase:{}}));
vi.mock('../lib/iagLearningApi.js',async importOriginal=>({...await importOriginal(),createIagLearningApi:()=>world.api}));
vi.mock('react-router-dom',()=>({useNavigate:()=>world.navigate}));
vi.mock('./IagAssessmentPanel.jsx',()=>({default:()=> <div>Trois travaux V7</div>}));
vi.mock('./IagCertificatePanel.jsx',()=>({default:()=> <div>Certificat privé</div>}));
vi.mock('./IagStructuredLesson.jsx',()=>({default:({document,onDocument,onAction,headingOffset})=> <article data-testid="private-document" data-heading-offset={headingOffset}><h2>{document.title}</h2><video data-testid="private-video"/><div id={`iag-${document.id}-demo`}>Démonstration fictive</div><button onClick={()=>onDocument(document.id,'demo')}>Regarder</button><button onClick={()=>onAction('iag-course-outline')}>Programme</button><button onClick={()=>onDocument('iag-d-aaaaaaaaaaaaaaaaaaa1','demo')}>Document lié</button><button onClick={()=>onDocument('iag-d-aaaaaaaaaaaaaaaaaaa1')}>Document sans ancre</button></article>}));
const ids='l11 l12 l13 l21 l22 l23 l24 l25 l26 l27 l31 l32 l33 l41 l42 l43 l51 l52 l61 l62 l71 l72'.split(' ');
const version='iag-v7-2026-10-21-with-explicit-v8-media';
function fakeApi(label='A',rows=[]){
 const docs=Object.fromEntries(ids.map((id,index)=>{const key=`iag-d-${String(index).padStart(20,'a')}`;return [key,{id:key,title:`Lecture privée ${label} ${id}`,lessonIds:[id],blocks:[]}];}));
 const course={id:'formation-ia-generative-elearning',contentVersion:version,title:'Cours fictif',durationLabel:'Durée estimée',
  modules:ids.map((id,index)=>({id,number:index+1,stage:Number(id[1]),title:`Leçon ${id}`,lesson:{contentDocumentId:Object.keys(docs)[index]}})),resources:[],structuredContent:{contract:'iag-structured-v1',documents:docs,externalLinks:[]}};
 const progress={courseId:course.id,contentVersion:version,lessons:rows,completedAt:null};
 return {loadCourse:vi.fn(async()=>course),progress:vi.fn(async()=>progress),document:vi.fn(async(_lesson,id)=>docs[id])};
}
async function showReader(label='A',lesson='l11'){
 const button=await screen.findByRole('button',{name:/Reprendre ma leçon/});await waitFor(()=>expect(button).not.toBeDisabled());await userEvent.setup().click(button);await screen.findByText(`Lecture privée ${label} ${lesson}`);
}
afterEach(cleanup);beforeEach(()=>{world.user={id:'A'};world.api=fakeApi();world.navigate.mockReset();Element.prototype.scrollIntoView=vi.fn();HTMLMediaElement.prototype.pause=vi.fn();});
describe('IAG account and course reader',()=>{
 it('direct anonymous access offers login without fetching private content',()=>{
  world.user=null;render(<IagLearningPlayer/>);expect(screen.getByRole('link',{name:'Se connecter'}).getAttribute('href')).toBe('/login');expect(world.api.loadCourse).not.toHaveBeenCalled();
 });
 it('loads private lesson, exact lesson count and existing assessment/certificate panels',async()=>{
  render(<IagLearningPlayer/>);await showReader();expect(document.querySelectorAll('.iag-player-lesson-list li')).toHaveLength(22);expect(document.querySelectorAll('.learning-module-list > details')).toHaveLength(7);
  expect(screen.getByText('Certificat privé')).not.toBeNull();await userEvent.setup().click(screen.getByRole('button',{name:'Mes trois travaux',exact:true}));expect(screen.getByText('Trois travaux V7')).toBeVisible();
 });
 it('refusal leaves no old lesson and supports explicit retry',async()=>{
  world.api.loadCourse.mockRejectedValueOnce(new Error('Droit remboursé'));render(<IagLearningPlayer/>);
  expect((await screen.findByRole('alert')).textContent).toBe('Droit remboursé');expect(screen.queryByText('Lecture privée A l11')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button',{name:'Réessayer le chargement'}));await showReader();
 });
 it('StrictMode cleanup/setup can still finish the active controller',async()=>{
  render(<StrictMode><IagLearningPlayer/></StrictMode>);await showReader();
 });
 it('account change immediately hides A while B is still loading',async()=>{
  const view=render(<IagLearningPlayer/>);await showReader();let resolve;
  const b=fakeApi('B'),original=b.loadCourse;b.loadCourse=()=>new Promise(r=>{resolve=()=>original().then(r);});
  world.user={id:'B'};world.api=b;view.rerender(<IagLearningPlayer/>);expect(screen.queryByText('Lecture privée A l11')).toBeNull();
  await waitFor(()=>expect(typeof resolve).toBe('function'));resolve();await showReader('B');
 });
 it('resumes from server progress without inventing zero or completing anything',async()=>{
  world.api=fakeApi('A',[{lessonId:'l11',status:'completed',lastViewedAt:'2026-10-01T00:00:00Z'},{lessonId:'l13',status:'in_progress',lastViewedAt:'2026-10-02T00:00:00Z'}]);render(<IagLearningPlayer/>);
  await screen.findByText('1 leçon terminée sur 22');await showReader('A','l13');expect(world.api.document).toHaveBeenCalledTimes(1);expect(world.api.progress.mock.calls.some(([action])=>action==='complete')).toBe(false);
 });
 it('sends complete only after the explicit button and keeps human assessment separate',async()=>{
  const base=world.api.progress;world.api.progress=vi.fn(async(action,lesson)=>{const value=await base(action,lesson);return action==='complete'?{...value,lessons:[{lessonId:lesson,status:'completed'}]}:value;});render(<IagLearningPlayer/>);await showReader();
  expect(world.api.progress.mock.calls.some(([action])=>action==='complete')).toBe(false);await userEvent.setup().click(screen.getByRole('button',{name:'J’ai terminé cette leçon'}));expect(await screen.findByRole('button',{name:'Leçon indiquée comme terminée'})).toBeDisabled();expect(world.api.progress.mock.calls.filter(([action])=>action==='complete')).toEqual([['complete','l11']]);expect(world.api.document).toHaveBeenCalledTimes(1);
 });
 it('scrolls in the current document without a fetch or another view',async()=>{
  render(<IagLearningPlayer/>);await showReader();const reads=world.api.document.mock.calls.length,views=world.api.progress.mock.calls.length;await userEvent.setup().click(screen.getByRole('button',{name:'Regarder',exact:true}));expect(world.api.document).toHaveBeenCalledTimes(reads);expect(world.api.progress).toHaveBeenCalledTimes(views);expect(screen.getAllByTestId('private-document')).toHaveLength(1);expect(Element.prototype.scrollIntoView).toHaveBeenCalled();expect(screen.getByTestId('private-document')).toHaveAttribute('data-heading-offset','1');
 });
 it('opens a different document through the unchanged controller',async()=>{
  render(<IagLearningPlayer/>);await showReader();await userEvent.setup().click(screen.getByRole('button',{name:'Document lié'}));await screen.findByText('Lecture privée A l12');expect(world.api.document).toHaveBeenLastCalledWith('l12','iag-d-aaaaaaaaaaaaaaaaaaa1');expect(world.api.progress).toHaveBeenLastCalledWith('view','l12');
 });
 it('returns Programme to the plan and selects the final actual lesson',async()=>{
  render(<IagLearningPlayer/>);await showReader();await userEvent.setup().click(screen.getByRole('button',{name:'Programme'}));expect(screen.getByRole('heading',{name:'22 leçons en 7 étapes'})).toBeVisible();await userEvent.setup().click(screen.getByText('Décomposer une tâche',{exact:true}));await userEvent.setup().click(screen.getByRole('button',{name:'Ouvrir la leçon : Leçon l72'}));await screen.findByText('Lecture privée A l72');expect(world.api.progress).toHaveBeenLastCalledWith('view','l72');expect(world.api.progress.mock.calls.some(([action])=>action==='complete')).toBe(false);
 });
 it('pauses the captured video on leaving the lesson even after its ref unmounts',async()=>{
  render(<IagLearningPlayer/>);await showReader();const video=screen.getByTestId('private-video');const pauses=HTMLMediaElement.prototype.pause.mock.calls.length;await userEvent.setup().click(screen.getByRole('button',{name:'Mes trois travaux',exact:true}));expect(video.isConnected).toBe(false);expect(HTMLMediaElement.prototype.pause.mock.calls.length).toBeGreaterThan(pauses);
 });
 it('positions the resumed lesson at the reader start using its sticky-header margin',async()=>{
  render(<IagLearningPlayer/>);await showReader();expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({block:'start'});
 });
 it('positions the loader immediately and the asynchronous lesson again when ready',async()=>{
  render(<IagLearningPlayer/>);const resume=await screen.findByRole('button',{name:/Reprendre ma leçon/});await waitFor(()=>expect(resume).not.toBeDisabled());
  const original=world.api.document.getMockImplementation();let resolve;world.api.document.mockImplementationOnce((lesson,id)=>new Promise(done=>{resolve=async()=>done(await original(lesson,id));}));
  await userEvent.setup().click(screen.getByText('Décomposer une tâche',{exact:true}));Element.prototype.scrollIntoView.mockClear();await userEvent.setup().click(screen.getByRole('button',{name:'Ouvrir la leçon : Leçon l72'}));
  expect(await screen.findByText('Chargement du document privé.')).toBeInTheDocument();expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));const loaderScrolls=Element.prototype.scrollIntoView.mock.calls.length;resolve();await screen.findByText('Lecture privée A l72');await waitFor(()=>expect(Element.prototype.scrollIntoView.mock.calls.length).toBeGreaterThan(loaderScrolls));expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));
 });
 it('positions the next and previous lesson at their reader start',async()=>{
  render(<IagLearningPlayer/>);await showReader();Element.prototype.scrollIntoView.mockClear();await userEvent.setup().click(screen.getByRole('button',{name:'Leçon suivante →'}));await screen.findByText('Lecture privée A l12');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));
  Element.prototype.scrollIntoView.mockClear();await userEvent.setup().click(screen.getByRole('button',{name:'← Leçon précédente'}));await screen.findByText('Lecture privée A l11');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));
 });
 it('positions a linked document without an anchor at the reader start',async()=>{
  render(<IagLearningPlayer/>);await showReader();Element.prototype.scrollIntoView.mockClear();await userEvent.setup().click(screen.getByRole('button',{name:'Document sans ancre'}));await screen.findByText('Lecture privée A l12');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader'));
 });
 it('keeps an explicit document anchor and does not jump again on complete',async()=>{
  render(<IagLearningPlayer/>);await showReader();await userEvent.setup().click(screen.getByRole('button',{name:'Document lié'}));await screen.findByText('Lecture privée A l12');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1).id).toBe('iag-iag-d-aaaaaaaaaaaaaaaaaaa1-demo');Element.prototype.scrollIntoView.mockClear();
  await userEvent.setup().click(screen.getByRole('button',{name:'J’ai terminé cette leçon'}));await waitFor(()=>expect(screen.getByRole('button',{name:'J’ai terminé cette leçon'})).not.toBeDisabled());expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
 });
 it('does not reposition an unchanged reader on an unrelated rerender',async()=>{
  const view=render(<IagLearningPlayer/>);await showReader();Element.prototype.scrollIntoView.mockClear();view.rerender(<IagLearningPlayer/>);expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();expect(world.api.document).toHaveBeenCalledTimes(1);
 });
 it('positions the initial secure loading message while course data is delayed',async()=>{
  let resolve;const original=world.api.loadCourse.getMockImplementation();world.api.loadCourse.mockImplementationOnce(()=>new Promise(done=>{resolve=async()=>done(await original());}));render(<IagLearningPlayer/>);await screen.findByText('Chargement sécurisé de vos leçons et de votre reprise.');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader-loading'));resolve();await showReader();
 });
 it('positions a delayed lesson error instead of leaving the footer at the top',async()=>{
  render(<IagLearningPlayer/>);await showReader();let reject;world.api.document.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));Element.prototype.scrollIntoView.mockClear();await userEvent.setup().click(screen.getByRole('button',{name:'Leçon suivante →'}));await screen.findByText('Chargement du document privé.');reject(new Error('Erreur de lecture fictive'));await screen.findByRole('alert');expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('iag-reader-error'));expect(screen.queryByTestId('private-document')).not.toBeInTheDocument();
 });
});

