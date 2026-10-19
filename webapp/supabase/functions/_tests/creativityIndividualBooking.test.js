import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {INDIVIDUAL_14H_COURSE_IDS,BUREAUTIQUE_SCHEDULE_FORMATS,getIndividualBookingCourse,CREATIVITY_INDIVIDUAL_BOOKING} from '../_shared/bureautiqueBooking.js';
const source=readFileSync(new URL('../create-course-booking/index.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'');
const js=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const slots=Array.from({length:28},(_,i)=>`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`);
const jsonResponse=(value,status=200)=>new Response(JSON.stringify(value),{status});
const errorSource=readFileSync(new URL('../_shared/calendarServer.ts',import.meta.url),'utf8').split('export function calendarErrorResponse')[1];
const calendarErrorResponse=new Function('calendarResponse','calendarUnavailablePayload',ts.transpile('function calendarErrorResponse'+errorSource,{target:ts.ScriptTarget.ES2022})+';return calendarErrorResponse;')(jsonResponse,()=>({error:'Unavailable'}));
function fixture(error=null){
 let handler,call;
 const Deno={env:{get:()=>'configured'},serve:h=>{handler=h}};
 const client={auth:{getUser:async()=>({data:{user:{id:'10000000-0000-4000-8000-000000000001'}}})}};
 const runCalendarAction=async options=>{call={name:options.action,args:options.payload,actorId:options.actorId};if(error)throw error;return 'booking';};
 new Function('Deno','createClient','corsHeaders','jsonResponse','requiredEnv','INDIVIDUAL_14H_COURSE_IDS','BUREAUTIQUE_SCHEDULE_FORMATS','runCalendarAction','calendarServiceClient','calendarErrorResponse',js)(Deno,()=>client,{},jsonResponse,()=> 'configured',INDIVIDUAL_14H_COURSE_IDS,BUREAUTIQUE_SCHEDULE_FORMATS,runCalendarAction,()=>client,calendarErrorResponse);
 return{send:body=>handler(new Request('https://local.test',{method:'POST',headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify(body)})),call:()=>call};
}
const body={course_id:'ia-creativite-individuel',delivery_mode:'remote',schedule_format:'four_half_days_3h30',slot_ids:slots};
test('catalogue individuel exact14h sans groupe ni collectif et sans LMS fictif',()=>{assert.equal(getIndividualBookingCourse(body.course_id),CREATIVITY_INDIVIDUAL_BOOKING);assert.equal(INDIVIDUAL_14H_COURSE_IDS.length,7);for(const id of ['ia-creativite-groupe','ia-creativite-ecole-association'])assert.equal(getIndividualBookingCourse(id),null);assert.equal(CREATIVITY_INDIVIDUAL_BOOKING.inPersonLocation,'Calais');assert.match(CREATIVITY_INDIVIDUAL_BOOKING.coursePath,/reservation-formation/)});
for(const format of Object.keys(BUREAUTIQUE_SCHEDULE_FORMATS))test('handler accepte28slots uniques '+format,async()=>{const f=fixture();assert.equal((await f.send({...body,schedule_format:format})).status,201);assert.equal(f.call().name,'create_course_booking');assert.deepEqual(f.call().args.p_slot_ids,slots)});
for(const override of [{slot_ids:slots.slice(1)},{slot_ids:[slots[0],...slots.slice(0,27)]},{schedule_format:'two_2h'},{course_id:'ia-creativite-groupe'},{course_id:'ia-creativite-ecole-association'}])test('handler refuse '+JSON.stringify(override).slice(0,80),async()=>{const f=fixture();assert.equal((await f.send({...body,...override})).status,400);assert.equal(f.call(),undefined)});
for(const [code,status] of [['42501',403],['23505',409],['23P01',409]])test('handler restitue refusRPC '+code,async()=>{const f=fixture({code,message:'Denied'});assert.equal((await f.send(body)).status,status)});
