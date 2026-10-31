// Synthetic fixtures only: no real Auth, Storage writes or signed URLs.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IagStructuredLesson from './IagStructuredLesson.jsx';

afterEach(cleanup);
const text=value=>({type:'text',text:value});
const node=(tag,children=[],extra={})=>({type:'element',tag,children,...extra});
const doc=(blocks,id='iag-d-aaaaaaaaaaaaaaaaaaaa')=>({id,title:'Leçon fictive',blocks});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function mount(document,extra={}){
 const props={document,lessonId:'l11',api:{resource:vi.fn()},externalLinks:[],onDocument:vi.fn(),onAction:vi.fn(),...extra};
 return {...render(<IagStructuredLesson {...props}/>),props};
}
describe('IAG structured reader - synthetic fixtures',()=>{
 it('places source headings below the course H1 without changing text, nodes or anchors',()=>{
  const document=doc([node('h1',[text('Titre original')],{attributes:{id:'source'}}),node('h2',[text('Exercice')]),node('h6',[text('Détail')]),node('p',[text('Texte intégral — l’essai reste fidèle.')])]);
  const before=JSON.stringify(document);const {container}=mount(document);
  expect(container.querySelector('h1')).toBeNull();expect(container.querySelector('h2').textContent).toBe('Titre original');
  expect(container.querySelector('h2').id).toBe('iag-iag-d-aaaaaaaaaaaaaaaaaaaa-source');expect(container.querySelector('h3').textContent).toBe('Exercice');
  expect(container.querySelector('h6').textContent).toBe('Détail');expect(container.textContent).toContain('Texte intégral — l’essai reste fidèle.');expect(JSON.stringify(document)).toBe(before);
 });
 it('can keep original headings for a standalone document',()=>{
  const {container}=mount(doc([node('h1',[text('Autonome')])]),{headingOffset:0});expect(container.querySelector('h1').textContent).toBe('Autonome');
 });
 it('preserves table cells, details and literal pre text without interpreting HTML',()=>{
  const {container}=mount(doc([node('table',[node('tbody',[node('tr',[node('th',[text('Avant')]),node('td',[text('Après')])])])]),
   node('details',[node('summary',[text('Détail')]),node('pre',[text('<script>test</script>')])])]));
  expect(container.querySelectorAll('th,td').length).toBe(2);expect(container.querySelector('details')).not.toBeNull();
  expect(container.querySelector('pre').textContent).toBe('<script>test</script>');expect(container.querySelector('script')).toBeNull();
 });
 it('drops executable tags and attributes while retaining namespaced source anchors',()=>{
  const {container}=mount(doc([node('script',[text('evil')]),node('p',[text('Texte')],{attributes:{id:'source',onclick:'evil',style:'evil'}})]));
  const p=container.querySelector('p');expect(p.id).toBe('iag-iag-d-aaaaaaaaaaaaaaaaaaaa-source');
  expect(p.hasAttribute('onclick')).toBe(false);expect(p.hasAttribute('style')).toBe(false);expect(container.querySelector('script')).toBeNull();
 });
 it('internal document references invoke IDs and anchors rather than a physical path',async()=>{
  const user=userEvent.setup();const opened=vi.fn();mount(doc([node('a',[text('Corrigé')],{reference:{documentId:'iag-d-bbbbbbbbbbbbbbbbbbbb',anchorId:'source'}})]),{onDocument:opened});
  await user.click(screen.getByRole('button',{name:'Corrigé'}));expect(opened).toHaveBeenCalledWith('iag-d-bbbbbbbbbbbbbbbbbbbb','source');
 });
 it('external references resolve only allowlisted HTTPS IDs',()=>{
  mount(doc([node('a',[text('Source valide')],{reference:{externalLinkId:'good'}}),node('a',[text('Source refusée')],{reference:{externalLinkId:'bad'}})]),
   {externalLinks:[{id:'good',url:'https://example.invalid/source'},{id:'bad',url:'javascript:alert(1)'}]});
  expect(screen.getByRole('link',{name:'Source valide'}).href).toBe('https://example.invalid/source');expect(screen.queryByRole('link',{name:/Source refusée/})).toBeNull();
 });
 it('unknown resource stays visible as an accessible unavailable state, then can retry',async()=>{
  const api={resource:vi.fn().mockRejectedValue(Object.assign(new Error('non importé'),{code:'IAG_RESOURCE_NOT_IMPORTED'}))};
  mount(doc([node('img',[],{reference:{resourceId:'res-'+'a'.repeat(24)},attributes:{alt:'Image fictive'}})]),{api});
  await waitFor(()=>expect(screen.getByRole('status').textContent).toMatch(/pas encore disponible/));
  expect(screen.queryByRole('img')).toBeNull();await userEvent.setup().click(screen.getByRole('button',{name:/Réessayer/}));
  await waitFor(()=>expect(api.resource.mock.calls.length).toBe(2));
 });
 it('two lesson videos never reuse an old URL while the new grant is pending',async()=>{
  const second=deferred();const api={resource:vi.fn((lesson)=>lesson==='l11'?Promise.resolve({mime:'video/mp4',url:'https://memory.invalid/A',expiresAt:new Date(Date.now()+120000).toISOString()}):second.promise)};
  const video=()=>node('video',[node('source',[],{reference:{resourceId:'res-'+'a'.repeat(24)}})]);
  const view=mount(doc([video()]),{api});await waitFor(()=>expect(view.container.querySelector('video')?.src).toBe('https://memory.invalid/A'));
  view.rerender(<IagStructuredLesson {...view.props} lessonId="l12" document={doc([video()],'iag-d-bbbbbbbbbbbbbbbbbbbb')}/>);
  expect(view.container.querySelector('video')).toBeNull();second.resolve({mime:'video/mp4',url:'https://memory.invalid/B',expiresAt:new Date(Date.now()+120000).toISOString()});
  await waitFor(()=>expect(view.container.querySelector('video')?.src).toBe('https://memory.invalid/B'));
 });
 it('VTT track is emitted only when synchronized verification is explicit',async()=>{
  const api={resource:vi.fn((_lesson,id)=>Promise.resolve(id.endsWith('b'.repeat(24))
   ?{mime:'text/vtt',url:'https://memory.invalid/captions',captionStatus:'verified-synchronized',expiresAt:new Date(Date.now()+120000).toISOString()}
   :{mime:'video/mp4',url:'https://memory.invalid/video',expiresAt:new Date(Date.now()+120000).toISOString()}))};
  const {container}=mount(doc([node('video',[node('source',[],{reference:{resourceId:'res-'+'a'.repeat(24)}}),node('track',[],{reference:{resourceId:'res-'+'b'.repeat(24)}})])]),{api});
  await waitFor(()=>expect(container.querySelector('track')?.getAttribute('src')).toBe('https://memory.invalid/captions'));
 });
});
