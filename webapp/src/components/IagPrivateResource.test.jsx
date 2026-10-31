import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as BinaryBlob } from 'node:buffer';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IagPrivateResourceLink, IagPrivateVideo } from './IagPrivateResource.jsx';
const bridge=vi.hoisted(()=>({activate:vi.fn(async()=> 'https://formaprompt.com/iag-video.php?lesson=l11&resource=fictive')}));
vi.mock('../lib/iagIonVideo.js',()=>({activateIagVideoGrant:bridge.activate}));
const NativeURL=globalThis.URL;
beforeEach(()=>{
 bridge.activate.mockResolvedValue('https://formaprompt.com/iag-video.php?lesson=l11&resource=fictive');
 let counter=0;
 vi.stubGlobal('Blob',BinaryBlob);
 vi.stubGlobal('URL',class extends NativeURL {});
 Object.assign(URL,{createObjectURL:vi.fn(()=>`blob:https://memory.invalid/${++counter}`),revokeObjectURL:vi.fn()});
});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('does not activate a grant resolved after the previous account was removed',async()=>{
 let resolve;const oldApi={resource:()=>new Promise(r=>{resolve=r;})};const nextApi={resource:()=>new Promise(()=>{})};
 const view=render(<IagPrivateVideo api={oldApi} lessonId="l11" resourceId="fixture"/>);
 view.rerender(<IagPrivateVideo api={nextApi} lessonId="l11" resourceId="fixture"/>);
 resolve({mime:'video/mp4',videoGrant:{},expiresAt:new Date(Date.now()+100000).toISOString()});await Promise.resolve();await Promise.resolve();
 expect(bridge.activate).not.toHaveBeenCalled();expect(view.container.querySelector('video')).toBeNull();
});
const freshVideo=()=>({mime:'video/mp4',videoGrant:{},expiresAt:new Date(Date.now()+120000).toISOString()});
it('keeps the same video element and position throughout the 105-second renewal',async()=>{
 vi.useFakeTimers();let resolve;
 const api={resource:vi.fn().mockImplementationOnce(async()=>freshVideo()).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}))};
 const view=render(<IagPrivateVideo api={api} lessonId="l11" resourceId="fixture"/>);
 await act(async()=>{});const original=view.container.querySelector('video');expect(original).not.toBeNull();original.currentTime=37;
 await act(async()=>{vi.advanceTimersByTime(105000);});
 expect(api.resource).toHaveBeenCalledTimes(2);expect(view.container.querySelector('video')).toBe(original);expect(original.currentTime).toBe(37);
 await act(async()=>{resolve(freshVideo());});
 expect(view.container.querySelector('video')).toBe(original);expect(original.currentTime).toBe(37);
});
it('removes the retained player as soon as renewal is refused and aborts on cleanup',async()=>{
 vi.useFakeTimers();let reject;
 const api={resource:vi.fn().mockImplementationOnce(async()=>freshVideo()).mockImplementationOnce(()=>new Promise((resolve,r)=>{reject=r;}))};
 const view=render(<IagPrivateVideo api={api} lessonId="l11" resourceId="fixture"/>);
 await act(async()=>{});expect(view.container.querySelector('video')).not.toBeNull();
 await act(async()=>{vi.advanceTimersByTime(105000);});expect(view.container.querySelector('video')).not.toBeNull();
 await act(async()=>{reject(Object.assign(new Error('Accès refusé.'),{status:403}));});
 expect(view.container.querySelector('video')).toBeNull();expect(view.container.textContent).toContain('Accès refusé.');
 const signal=bridge.activate.mock.calls[0][1].signal;view.unmount();expect(signal.aborted).toBe(true);
});
it.each(['api','lesson','resource'])('isolates a changed %s and ignores the old pending renewal',async change=>{
 vi.useFakeTimers();let resolve;
 const api={resource:vi.fn().mockImplementationOnce(async()=>freshVideo()).mockImplementation(()=>new Promise(r=>{resolve=r;}))};
 const props={api,lessonId:'l11',resourceId:'fixture'};const view=render(<IagPrivateVideo {...props}/>);
 await act(async()=>{});const original=view.container.querySelector('video');expect(original).not.toBeNull();
 await act(async()=>{vi.advanceTimersByTime(105000);});const oldResolve=resolve;
 const next={...props,...(change==='api'?{api:{resource:()=>new Promise(()=>{})}}:change==='lesson'?{lessonId:'l12'}:{resourceId:'other'})};
 view.rerender(<IagPrivateVideo {...next}/>);expect(view.container.querySelector('video')).toBeNull();
 await act(async()=>{oldResolve(freshVideo());});
 expect(view.container.querySelector('video')).toBeNull();expect(bridge.activate).toHaveBeenCalledTimes(1);
});

const lessons=['l11','l12','l13','l21','l22','l23','l24','l25','l26','l27','l31','l32','l33','l41','l42','l43','l51','l52','l61','l62','l71','l72'];
const privateText=(extra={})=>({mime:'text/plain',url:'https://memory.invalid/private-text',expiresAt:new Date(Date.now()+120000).toISOString(),...extra});
const encoded=text=>new TextEncoder().encode(text).buffer;
const response=(text='Texte privé — l’essai à vérifier.')=>({ok:true,redirected:false,arrayBuffer:async()=>encoded(text)});
async function openText(props={}) {
 const api=props.api || {resource:vi.fn(async()=>privateText())};const values={api,lessonId:'l13',resourceId:'res-text',...props};
 const view=render(<IagPrivateResourceLink {...values}>Fiche personnelle</IagPrivateResourceLink>);
 fireEvent.click(screen.getByRole('button',{name:'Fiche personnelle'}));await act(async()=>{});return {...view,props:values};
}
it.each(lessons)('reads a validated UTF-8 sheet for %s without relying on the response charset',async lessonId=>{
 const fetcher=vi.fn(async()=>response());vi.stubGlobal('fetch',fetcher);const view=await openText({lessonId});
 expect(screen.getByLabelText('Contenu du support privé').textContent).toBe('Texte privé — l’essai à vérifier.');
 expect(view.props.api.resource).toHaveBeenCalledWith(lessonId,'res-text');expect(fetcher).toHaveBeenCalledWith('https://memory.invalid/private-text',expect.objectContaining({credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:expect.any(AbortSignal)}));
 expect(screen.getByRole('link',{name:/lire la fiche/}).getAttribute('href')).toBe('blob:https://memory.invalid/1');
 expect(screen.getByRole('link',{name:'Lien d’origine'}).getAttribute('href')).toBe('https://memory.invalid/private-text');
});
it('shows CSV and literal HTML as escaped pre-wrapped text, retaining the original signed link',async()=>{
 const source='\ufeffcolonne;valeur\n<script>aucune exécution</script>;é';vi.stubGlobal('fetch',vi.fn(async()=>response(source)));
 const api={resource:async()=>privateText({mime:'text/csv'})};const view=await openText({api});
 const content=screen.getByLabelText('Contenu du support privé');expect(content.textContent).toContain('<script>aucune exécution</script>;é');expect(content.style.whiteSpace).toBe('pre-wrap');
 expect(view.container.querySelector('script')).toBeNull();expect(screen.getByRole('link',{name:/lire la fiche/}).getAttribute('referrerpolicy')).toBe('no-referrer');
 expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/plain;charset=utf-8');expect(URL.createObjectURL.mock.calls[1][0].type).toBe('text/csv;charset=utf-8');
 expect(new Uint8Array(await URL.createObjectURL.mock.calls[1][0].arrayBuffer())).toEqual(new Uint8Array(encoded(source)));
 expect(screen.getByRole('link',{name:'Télécharger le fichier'}).getAttribute('download')).toBe('support-prive.csv');
});
it('refuses invalid UTF-8 without a guessed alternative encoding or leaked response details',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([0xc3,0x28]).buffer})));await openText();
 expect(screen.queryByLabelText('Contenu du support privé')).toBeNull();expect(screen.getByRole('status').textContent).toContain('ne peut pas être lu');
 expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it.each(['network','http','redirect'])('hides the text after a %s failure and keeps only the original link',async failure=>{
 const read=vi.fn(async()=>encoded('secret body'));vi.stubGlobal('fetch',vi.fn(async()=>{if(failure==='network')throw new Error('https://private.invalid/?token=SECRET');return {ok:failure!=='http',redirected:failure==='redirect',arrayBuffer:read};}));
 const view=await openText();expect(screen.queryByLabelText('Contenu du support privé')).toBeNull();expect(view.container.textContent).not.toContain('SECRET');expect(view.container.textContent).not.toContain('secret body');expect(read).not.toHaveBeenCalled();
});
it('aborts an in-flight text read on unmount and ignores its late bytes',async()=>{
 let resolve;const fetcher=vi.fn(()=>new Promise(r=>{resolve=r;}));vi.stubGlobal('fetch',fetcher);const view=await openText();const signal=fetcher.mock.calls[0][1].signal;
 view.unmount();expect(signal.aborted).toBe(true);await act(async()=>{resolve(response('late private text'));});expect(view.container.textContent).not.toContain('late private text');
 expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it.each(['api','lesson','resource'])('never exposes an old text when %s changes',async change=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response('Texte du premier compte')));const api={resource:vi.fn().mockResolvedValueOnce(privateText()).mockImplementation(()=>new Promise(()=>{}))};const view=await openText({api});
 expect(view.container.textContent).toContain('Texte du premier compte');const next={...view.props,...(change==='api'?{api:{resource:()=>new Promise(()=>{})}}:change==='lesson'?{lessonId:'l21'}:{resourceId:'res-other'})};
 view.rerender(<IagPrivateResourceLink {...next}>Fiche personnelle</IagPrivateResourceLink>);expect(view.container.textContent).not.toContain('Texte du premier compte');
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://memory.invalid/1');expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://memory.invalid/2');
 expect(view.container.querySelector('a[href^="blob:"]')).toBeNull();
});
it('hides old text at expiry while renewal is pending',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>response('Texte avant expiration')));const api={resource:vi.fn().mockResolvedValueOnce(privateText()).mockImplementation(()=>new Promise(()=>{}))};const view=await openText({api});
 expect(view.container.textContent).toContain('Texte avant expiration');await act(async()=>{vi.advanceTimersByTime(120001);});expect(view.container.textContent).not.toContain('Texte avant expiration');expect(view.container.textContent).toContain('expiré');
 expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);expect(view.container.querySelector('a[href^="blob:"]')).toBeNull();
});
it('removes the text immediately when the renewed API authorization is refused',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>response('Texte avant révocation')));const api={resource:vi.fn().mockResolvedValueOnce(privateText()).mockRejectedValue(new Error('Accès refusé.'))};const view=await openText({api});
 expect(view.container.textContent).toContain('Texte avant révocation');await act(async()=>{vi.advanceTimersByTime(105000);});expect(view.container.textContent).not.toContain('Texte avant révocation');expect(view.container.textContent).toContain('Accès refusé.');
 expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it('does not fetch a resource that is already expired',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await openText({api:{resource:async()=>privateText({expiresAt:new Date(Date.now()-1).toISOString()})}});expect(fetcher).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('expiré');
});
it('preserves original TXT bytes and uses a safe explicit filename when metadata is missing',async()=>{
 const original='Écrire — l’essai\r\nSans conversion.';vi.stubGlobal('fetch',vi.fn(async()=>response(original)));const view=await openText();
 for(const [blob] of URL.createObjectURL.mock.calls){expect(blob.type).toBe('text/plain;charset=utf-8');expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(encoded(original)));}
 expect(screen.getByRole('link',{name:'Télécharger le fichier'}).getAttribute('download')).toBe('support-prive.txt');
 view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it.each([['fiche-l13.txt','fiche-l13.txt'],['../fuite.txt','support-prive.txt'],['bad.csv','support-prive.txt'],['a\r\nb.txt','support-prive.txt']])('accepts only a safe matching filename: %j',async(fileName,expected)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response()));await openText({api:{resource:async()=>privateText({fileName})}});expect(screen.getByRole('link',{name:'Télécharger le fichier'}).getAttribute('download')).toBe(expected);
});
it('releases the first URL if preparing the second URL fails',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response()));URL.createObjectURL.mockImplementationOnce(()=> 'blob:https://memory.invalid/first').mockImplementationOnce(()=>{throw new Error('fictive failure');});await openText();
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://memory.invalid/first');expect(screen.queryByRole('link',{name:/lire la fiche/})).toBeNull();expect(screen.getByRole('status').textContent).toContain('ne peut pas être lu');
});
it('releases the previous pair on successful renewal without keeping a persistent URL',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>response()));const api={resource:vi.fn(async()=>privateText())};const view=await openText({api});
 await act(async()=>{vi.advanceTimersByTime(105000);});expect(URL.createObjectURL).toHaveBeenCalledTimes(4);expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);expect(view.container.querySelector('a[href="blob:https://memory.invalid/1"]')).toBeNull();
 view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
});
it.each(['image/png','image/jpeg'])('keeps the existing signed-link behavior for %s without a Blob or text fetch',async mime=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await openText({api:{resource:async()=>privateText({mime})}});expect(fetcher).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();expect(screen.getByRole('link').getAttribute('href')).toBe('https://memory.invalid/private-text');
});
