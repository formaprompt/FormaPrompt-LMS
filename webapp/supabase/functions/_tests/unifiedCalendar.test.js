import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { assertCalendarAvailable, loadCalendarBusy, REQUIRED_BUSY_CALENDAR_IDS, EXISTING_BOOKING_CALENDAR_ID, parisLocalDateTime, parseAvailabilityRange, periodsOverlap, CALENDAR_TIME_ZONE } from '../_shared/calendarAvailability.js';
import { queryProfessionalBusyWithoutOwnEvents } from '../_shared/calendarProfessionalEvents.js';
import { runCalendarAction } from '../_shared/calendarAction.js';
import { IN_PERSON_TRAVEL_FEE } from '../_shared/purchaseConfig.js';

// These are HTTP provider fixtures. Recurrence expansion and transparency in
// FreeBusy are Google responsibilities; no live OAuth/Calendar call is made.
const interval={starts_at:'2027-01-15T08:00:00Z',ends_at:'2027-01-15T09:30:00Z'};
const ids=[...REQUIRED_BUSY_CALENDAR_IDS,EXISTING_BOOKING_CALENDAR_ID];
const response=(payload,status=200)=>({ok:status>=200&&status<300,status,json:async()=>payload});
function provider(overrides={}){
  const calls=[];
  return {calls,fetchImpl:async(url,options)=>{
    calls.push({url,options});assert.match(url,/\/freeBusy$/);
    const body=JSON.parse(options.body);assert.equal(body.timeZone,'Europe/Paris');
    const calendars=Object.fromEntries(body.items.map(({id})=>[id,{busy:overrides[id]||[]} ]));
    return response({calendars});
  }};
}
const available=(p,extra={})=>assertCalendarAvailable({intervals:[interval],accessToken:'FIXTURE',env:()=>undefined,fetchImpl:p.fetchImpl,...extra});
for(const [name,busyIds]of [['professionnel seul',[ids[0]]],['personnel seul',[ids[1]]],['deux agendas',[ids[0],ids[1]]],['agenda métier',[ids[2]]]]){
  test('refuse un conflit '+name,async()=>{
    const p=provider(Object.fromEntries(busyIds.map(id=>[id,[{start:interval.starts_at,end:interval.ends_at}]])));
    await assert.rejects(()=>available(p),{code:'23P01'});
    assert.deepEqual(JSON.parse(p.calls[0].options.body).items.map(x=>x.id),ids);
  });
}
test('libre, transparent et annulé restent libres selon FreeBusy fournisseur',async()=>{
  for(const label of ['free','transparent','cancelled']){const p=provider();await available(p);assert.equal(p.calls.length,1,label);}
});
test('borne demi-ouverte et occurrence récurrente déplacée renvoyée par Google',async()=>{
  const p=provider({[ids[1]]:[{start:'2027-01-15T09:30:00Z',end:'2027-01-15T10:00:00Z'}]});await available(p);
  const moved=provider({[ids[1]]:[{start:'2027-01-15T09:00:00Z',end:'2027-01-15T10:00:00Z'}]});await assert.rejects(()=>available(moved),{code:'23P01'});
});
test('jour entier et changement heure Paris conservent la bonne date',async()=>{
  assert.equal(parisLocalDateTime('2027-03-28'),'2027-03-27T23:00:00.000Z');
  assert.equal(parisLocalDateTime('2027-03-29'),'2027-03-28T22:00:00.000Z');
  const p=provider({[ids[1]]:[{start:'2027-01-14T23:00:00Z',end:'2027-01-15T23:00:00Z'}]});await assert.rejects(()=>available(p),{code:'23P01'});
});
for(const broken of ['missing','errors','busy-not-array','invalid-date','http403','http429','http503','network','json']){
  test('échec fermé '+broken,async()=>{
    const fetchImpl=async()=>{
      if(broken==='network')throw Error('fixture network');
      if(broken==='json')return {ok:true,status:200,json:async()=>{throw Error('fixture JSON');}};
      const calendars=Object.fromEntries(ids.map(id=>[id,{busy:[]}]));
      if(broken==='missing')delete calendars[ids[1]];
      if(broken==='errors')calendars[ids[1]].errors=[{reason:'forbidden'}];
      if(broken==='busy-not-array')calendars[ids[1]].busy={};
      if(broken==='invalid-date')calendars[ids[1]].busy=[{start:'2027-02-31T08:00:00Z',end:'2027-02-31T10:00:00Z'}];
      return response({calendars},broken.startsWith('http')?Number(broken.slice(4)):200);
    };
    await assert.rejects(()=>available({fetchImpl}),/google_/);
  });
}
test('confirmation 14h couvre la dernière demi-heure des quatre séances sans scanner les jours intermédiaires',async()=>{
  const intervals=Array.from({length:4},(_,day)=>Array.from({length:7},(_,half)=>({
    starts_at:new Date(Date.UTC(2027,1,1+day*3,8,half*30)).toISOString(),
    ends_at:new Date(Date.UTC(2027,1,1+day*3,8,(half+1)*30)).toISOString(),
  }))).flat();
  const last=intervals.at(-1),p=provider({[ids[1]]:[{start:last.starts_at,end:last.ends_at}]});
  await assert.rejects(()=>available(p,{intervals}),{code:'23P01'});
  assert.equal(p.calls.length,4);
  assert.equal(intervals.reduce((n,x)=>n+(Date.parse(x.ends_at)-Date.parse(x.starts_at))/60000,0),840);
});
test('cache affichage court ne dispense jamais une confirmation du second appel',async()=>{
  const unique={starts_at:'2028-01-02T08:00:00Z',ends_at:'2028-01-02T09:00:00Z'},p=provider();
  const options={intervals:[unique],accessToken:'FIXTURE',env:()=>undefined,fetchImpl:p.fetchImpl,mode:'display',now:1000};
  await loadCalendarBusy(options);await loadCalendarBusy({...options,now:2000});assert.equal(p.calls.length,1);
  await assertCalendarAvailable({...options,now:2000});assert.equal(p.calls.length,2);
});
test('retrait événement propre par ID professionnel ne masque pas un événement superposé',async()=>{
  const own={calendar_id:EXISTING_BOOKING_CALENDAR_ID,event_id:'own123',...interval};
  const calls=[];
  const fetchImpl=async(url)=>{calls.push(url);return response({items:[{id:'own123',start:{dateTime:interval.starts_at},end:{dateTime:interval.ends_at}},{id:'other456',start:{dateTime:interval.starts_at},end:{dateTime:interval.ends_at}}]});};
  const busy=await queryProfessionalBusyWithoutOwnEvents({accessToken:'FIXTURE',calendarId:EXISTING_BOOKING_CALENDAR_ID,timeMin:interval.starts_at,timeMax:interval.ends_at,ownEvents:[own],fetchImpl});
  assert.equal(busy.length,1);const url=new URL(calls[0]);assert.equal(url.searchParams.get('fields'),'items(id,start,end,status,transparency),nextPageToken');assert.equal(url.searchParams.get('singleEvents'),'true');
  await assert.rejects(()=>queryProfessionalBusyWithoutOwnEvents({accessToken:'FIXTURE',calendarId:ids[1],timeMin:interval.starts_at,timeMax:interval.ends_at,ownEvents:[own],fetchImpl}),/own_events_invalid/);assert.equal(calls.length,1);
});
test('gate utilise intervalles serveur et refuse de muter pendant une panne',async()=>{
  const mutations=[],client={rpc:async(name,args)=>{mutations.push({name,args});return {data:name==='prepare_unified_calendar_action'?{action_id:randomUUID(),proof:randomUUID(),intervals:[interval]}:'DONE'};}};
  await assert.rejects(()=>runCalendarAction({client,actorId:randomUUID(),action:'create_course_booking',payload:{intervals:[{start:'FAKE'}]},availabilityOptions:{accessToken:'FIXTURE',env:()=>undefined,fetchImpl:async()=>{throw Error('offline');}}}),/google_/);
  assert.deepEqual(mutations.map(x=>x.name),['prepare_unified_calendar_action']);
});
test('ticket déjà exécuté restitue le résultat sans HTTP ni nouvelle mutation',async()=>{
  const calls=[],result={booking:{id:randomUUID()}},client={rpc:async(name)=>{calls.push(name);return {data:{already_executed:true,result}};}};
  assert.deepEqual(await runCalendarAction({client,action:'create_calendar_booking',payload:{},availabilityOptions:{fetchImpl:()=>assert.fail('no HTTP expected')}}),result);assert.deepEqual(calls,['prepare_unified_calendar_action']);
});

// Execute the actual display handler with synthetic DB rows and HTTP responses,
// so suppression is verified in the endpoint result, beyond the overlap helper.
const availabilitySource=readFileSync(new URL('../get-unified-availability/index.ts',import.meta.url),'utf8').replace(/^import .+$/gm,'');
const availabilityJs=ts.transpile(availabilitySource,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
function displayFixture(slots,fetchImpl){
  let handler;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
  const query=rows=>({select(){return this;},eq(){return this;},gte(){return this;},lte(){return this;},lt(){return this;},gt(){return this;},order(){return this;},range(){return this;},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}});
  const service={from:()=>query([])},scoped={from:()=>query(slots)};
  const Deno={serve:fn=>{handler=fn;},env:{get:()=> 'FIXTURE'}};
  new Function('createClient','corsHeaders','calendarActor','calendarErrorResponse','calendarResponse','calendarServiceClient','CALENDAR_TIME_ZONE','loadCalendarBusy','parseAvailabilityRange','parisLocalDateTime','periodsOverlap','Deno',availabilityJs)(
    ()=>scoped,{},async()=> 'fixture-actor',()=>json({code:'CALENDAR_UNAVAILABLE'},503),json,()=>service,CALENDAR_TIME_ZONE,
    options=>loadCalendarBusy({...options,accessToken:'FIXTURE',env:()=>undefined,fetchImpl}),parseAvailabilityRange,parisLocalDateTime,periodsOverlap,Deno,
  );
  return body=>handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer FICTIF'},body:JSON.stringify(body)}));
}
test('recette personnel seul retire les propositions cours et bloque la demi-journée publique',async()=>{
  const blocked={id:'personal-busy-slot',starts_at:'2081-01-15T08:00:00Z',ends_at:'2081-01-15T08:30:00Z',delivery_modes:['remote']};
  const free={...blocked,id:'free-slot',starts_at:'2081-01-15T15:00:00Z',ends_at:'2081-01-15T15:30:00Z'};
  const p=provider({[ids[1]]:[{start:blocked.starts_at,end:blocked.ends_at}]}),send=displayFixture([blocked,free],p.fetchImpl);
  const range={from:'2081-01-15T00:00:00Z',to:'2081-01-16T00:00:00Z'};
  const course=await send({purpose:'course_booking',...range});assert.equal(course.status,200);assert.deepEqual((await course.json()).slots,[free]);
  const publicCalendar=await send({purpose:'public_calendar',...range});assert.equal(publicCalendar.status,200);
  const payload=await publicCalendar.json();assert.ok(payload.blocks.some(block=>block.booking_date==='2081-01-15'&&block.slot==='Matin'));
  assert.equal(payload.blocks.some(block=>block.booking_date==='2081-01-15'&&block.slot==='Après-midi'),false);
  assert.equal(JSON.stringify(payload).includes(ids[1]),false);
  for(const call of p.calls)assert.deepEqual(JSON.parse(call.options.body).items.map(x=>x.id),ids);
});
test('recette personnel seul en dernière séance 14h empêche la mutation complète',async()=>{
  const intervals=Array.from({length:4},(_,day)=>Array.from({length:7},(_,half)=>({starts_at:new Date(Date.UTC(2082,1,1+day*3,8,half*30)).toISOString(),ends_at:new Date(Date.UTC(2082,1,1+day*3,8,(half+1)*30)).toISOString()}))).flat();
  const last=intervals.at(-1),p=provider({[ids[1]]:[{start:last.starts_at,end:last.ends_at}]}),calls=[];
  const client={rpc:async(name)=>{calls.push(name);return {data:{action_id:randomUUID(),proof:randomUUID(),intervals}};}};
  await assert.rejects(()=>runCalendarAction({client,actorId:randomUUID(),action:'create_course_booking',payload:{p_slot_ids:intervals.map(()=>randomUUID())},availabilityOptions:{accessToken:'FIXTURE',env:()=>undefined,fetchImpl:p.fetchImpl}}),{code:'23P01'});
  assert.deepEqual(calls,['prepare_unified_calendar_action']);assert.equal(p.calls.length,4);
  assert.equal(intervals.reduce((total,row)=>total+(Date.parse(row.ends_at)-Date.parse(row.starts_at))/60000,0),840);
  assert.ok(p.calls.some(call=>Date.parse(JSON.parse(call.options.body).timeMax)===Date.parse(last.ends_at)));
});
test('recette panne du personnel requis rend affichage indisponible et bloque execute',async()=>{
  const slot={id:'required-personal-calendar',starts_at:'2083-01-15T08:00:00Z',ends_at:'2083-01-15T08:30:00Z',delivery_modes:['remote']};
  const fetchImpl=async()=>response({calendars:{[ids[0]]:{busy:[]},[ids[1]]:{errors:[{reason:'forbidden'}]},[ids[2]]:{busy:[]}}});
  const send=displayFixture([slot],fetchImpl),result=await send({purpose:'course_booking',from:'2083-01-15T00:00:00Z',to:'2083-01-16T00:00:00Z'});
  assert.equal(result.status,503);assert.deepEqual(await result.json(),{code:'CALENDAR_UNAVAILABLE'});
  const calls=[],client={rpc:async(name)=>{calls.push(name);return {data:{action_id:randomUUID(),proof:randomUUID(),intervals:[slot]}};}};
  await assert.rejects(()=>runCalendarAction({client,actorId:randomUUID(),action:'create_course_booking',payload:{},availabilityOptions:{accessToken:'FIXTURE',env:()=>undefined,fetchImpl}}),/google_/);
  assert.deepEqual(calls,['prepare_unified_calendar_action']);
});

const travelSource=readFileSync(new URL('../create-travel-fee-checkout/index.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'');
const travelJs=ts.transpile(travelSource,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
function travelFixture({paid=false,failure=null}={}){
  const state={checks:0,checkout:[],reads:[],writes:[]};let handler;
  const booking={id:randomUUID(),user_id:'fixture-user',course_id:'formation-ia-act',delivery_mode:'in_person',schedule_format:'two_2h',status:'awaiting_travel_payment',distance_status:'approved',travel_fee_amount:3000,travel_fee_status:paid?'paid':'pending'};
  const client={auth:{getUser:async()=>({data:{user:{id:'fixture-user',email:'fixture@example.invalid'}}})},from(table){state.reads.push(table);return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:booking}),then(resolve){return Promise.resolve({data:[interval]}).then(resolve);},update(){state.writes.push(table);throw Error('unexpected write');}};}};
  class Stripe{constructor(){this.checkout={sessions:{create:async args=>{state.checkout.push(args);return {url:'https://checkout.example.invalid/fictif'};}}};}}
  const Deno={serve:fn=>{handler=fn;},env:{get:key=>key==='SITE_URL'?'https://site.example.invalid':'FICTIF'}};
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
  new Function('Stripe','createClient','corsHeaders','jsonResponse','IN_PERSON_TRAVEL_FEE','assertCalendarAvailable','calendarErrorResponse','Deno',travelJs)(Stripe,()=>client,{},json,IN_PERSON_TRAVEL_FEE,async options=>{state.checks++;assert.deepEqual(options.intervals,[interval]);if(failure)throw failure;},()=>json({error:'unavailable'},503),Deno);
  return {state,booking,send:()=>handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer FICTIF'},body:JSON.stringify({booking_request_id:booking.id})}))};
}
test('préflight frais déplacement réussit sans changer montants ou métadonnées Stripe',async()=>{
  const f=travelFixture();assert.equal((await f.send()).status,200);assert.equal(f.state.checks,1);const p=f.state.checkout[0];
  assert.equal(p.mode,'payment');assert.equal(p.line_items[0].price_data.unit_amount,3000);assert.equal(p.line_items[0].price_data.currency,'eur');assert.deepEqual(p.payment_method_types,['card']);assert.equal(p.customer_email,'fixture@example.invalid');
  assert.deepEqual(p.metadata,{payment_type:IN_PERSON_TRAVEL_FEE.paymentType,booking_request_id:f.booking.id,user_id:'fixture-user'});assert.deepEqual(p.payment_intent_data.metadata,p.metadata);assert.equal(p.invoice_creation.enabled,true);assert.equal(p.line_items[0].quantity,1);assert.equal(p.locale,'fr');assert.equal(f.state.writes.length,0);
});
test('panne agenda avant frais déplacement ne crée pas de Checkout et ne change pas la réservation',async()=>{
  const f=travelFixture({failure:Error('google_calendar_unavailable')}),before=structuredClone(f.booking);assert.equal((await f.send()).status,503);assert.equal(f.state.checkout.length,0);assert.equal(f.state.writes.length,0);assert.deepEqual(f.booking,before);
});
test('frais déjà payés restent payés et récupérables pendant une panne agenda',async()=>{
  const f=travelFixture({paid:true,failure:Error('google_calendar_unavailable')}),result=await f.send();assert.equal(result.status,200);assert.deepEqual(await result.json(),{alreadyPaid:true});assert.equal(f.booking.travel_fee_status,'paid');assert.equal(f.state.checks,0);assert.equal(f.state.checkout.length,0);assert.equal(f.state.writes.length,0);
});
