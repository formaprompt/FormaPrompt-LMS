import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as input from '../_shared/httpInput.js';
import * as replyCore from '../_shared/clientReply.js';
import * as policy from '../_shared/clientReplyPolicy.js';
import {randomUUID} from 'node:crypto';

function compile(path,dependencies,extra={}){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.deepEqual(result.diagnostics,[]);
  const exports={};let handler;
  runInNewContext(result.outputText,{exports,require(name){assert.ok(name in dependencies,`Unexpected import ${name}`);return dependencies[name];},
    Deno:{env:{get:(name)=>({SUPABASE_URL:'https://fictif.invalid',SUPABASE_ANON_KEY:'fictif-public',SUPABASE_SERVICE_ROLE_KEY:'fictif-service'})[name]},serve:(fn)=>handler=fn},
    Request,Response,TextDecoder,TextEncoder,Date,console:{error(){}},...extra});
  return {exports,handler};
}

function fixture(role='admin',validSession=true){
  const calls={profile:0,contact:0,send:0,notification:0};
  const requestId='30000000-0000-4000-8000-000000000001';
  const database={from(table){
    if(table==='profiles')calls.profile++;
    else if(table==='contact_requests')calls.contact++;
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:table==='profiles'?{id:'actor',role}:table==='contact_requests'?{id:requestId,email:'client@example.test'}:null,error:null})};return query;
  }};
  const auth=compile('../_shared/requireMailAdmin.ts',{
    'npm:@supabase/supabase-js@2.105.1':{createClient:(_url,key)=>key==='fictif-public'?{auth:{getUser:async(token)=>({data:{user:validSession&&token==='valid-token'?{id:'actor',user_metadata:{role:'admin'}}:null},error:null})}}:database},
    './httpInput.js':input,
  }).exports;
  const dependencies={
    '../_shared/cors.ts':{jsonResponse:(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})},
    '../_shared/requireMailAdmin.ts':auth,
    '../_shared/httpInput.js':input,
    '../_shared/clientReplyPolicy.js':policy,
    '../_shared/clientReply.js':{...replyCore,createClientReplyStore:()=>({}),deliverClientReply:async(reply)=>{calls.send++;calls.reply=reply;return{id:'fictif',status:'sent'};}},
    '../_shared/adminNotificationActions.js':{notificationAction:async()=>{calls.notification++;return{rows:[]};}},
  };
  const reply=compile('../admin-reply-client/index.ts',dependencies).handler;
  const notifications=compile('../admin-email-notifications/index.ts',dependencies).handler;
  return{calls,reply,notifications,requestId};
}
function multipart(id,{token='valid-token',recipient='client@example.test',attachment=true}={}){
  const form=new FormData();for(const[key,value]of Object.entries({requestId:id,replyId:randomUUID(),recipientEmail:recipient,subject:'Programme détaillé',message:'Voici votre programme détaillé.'}))form.set(key,value);
  if(attachment)form.append('attachments',new File(['%PDF-1.7\n%%EOF'],'programme.pdf',{type:'application/pdf'}));
  return new Request('https://fixture.invalid',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:form});
}
for(const role of ['user','employee'])test(`le rôle ${role} ne peut ni lire/reprendre les alertes ni répondre au client`,async()=>{
  const f=fixture(role);assert.equal((await f.reply(multipart(f.requestId))).status,403);
  assert.equal((await f.notifications(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer valid-token'},body:'{"action":"list","role":"admin"}'}))).status,403);
  assert.equal(f.calls.send,0);assert.equal(f.calls.notification,0);assert.equal(f.calls.contact,0);
});
test('session absente ou expirée refusée avant lecture des documents et du profil',async()=>{
  const absent=fixture();assert.equal((await absent.reply(multipart(absent.requestId,{token:null}))).status,401);assert.equal(absent.calls.profile,0);
  const invalid=fixture('admin',false);assert.equal((await invalid.reply(multipart(invalid.requestId))).status,401);assert.equal(invalid.calls.contact,0);
});
test('un administrateur envoie le contenu et les PJ validés sans mutation de devis',async()=>{
  const f=fixture();const response=await f.reply(multipart(f.requestId));assert.equal(response.status,200);assert.equal((await response.json()).status,'sent');
  assert.equal(f.calls.send,1);assert.equal(f.calls.reply.attachments.length,1);assert.equal(f.calls.reply.recipient,'client@example.test');
});
test('une adresse détournée et une requête trop volumineuse ne peuvent envoyer',async()=>{
  const f=fixture();assert.equal((await f.reply(multipart(f.requestId,{recipient:'autre@example.test'}))).status,403);assert.equal(f.calls.send,0);
  const huge=new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer valid-token','content-type':'multipart/form-data; boundary=test','content-length':String(policy.CLIENT_REPLY_LIMITS.maxRequestBytes+1)},body:'x'});
  assert.equal((await f.reply(huge)).status,413);assert.equal(f.calls.send,0);
});
test('la vérification d’un résultat ne peut pas déclencher un nouvel envoi',async()=>{
  const f=fixture();const response=await f.reply(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer valid-token','content-type':'application/json'},body:JSON.stringify({action:'status',requestId:f.requestId,replyId:randomUUID()})}));
  assert.equal(response.status,200);assert.equal((await response.json()).status,'not_found');assert.equal(f.calls.send,0);
});
test('le lecteur borné arrête aussi les corps sans Content-Length',async()=>{
  const request=new Request('https://fixture.invalid',{method:'POST',body:'x'.repeat(200)});
  await assert.rejects(input.readBoundedBody(request,100),(error)=>error.status===413);
});

function commercialCleanupFixture(role = 'admin', rpcError = null, rpcResult = null) {
  const calls = [];
  const requestId = randomUUID();
  const actorId = randomUUID();
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: actorId, role }, error: null }),
  };
  const database = {
    from(table) {
      assert.equal(table, 'profiles');
      return query;
    },
    async rpc(name, params) {
      calls.push([name, params]);
      return { data: rpcResult, error: rpcError };
    },
  };
  const dependencies = {
    'npm:@supabase/supabase-js@2.105.1': {
      createClient: (_url, key) => key === 'fictif-public'
        ? { auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) } }
        : database,
    },
    '../_shared/cors.ts': {
      jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    },
    '../_shared/commercialCycle.js': {},
    '../_shared/smtpReceipt.js': { sendCommercialEmail: () => assert.fail('Le tri ne doit déclencher aucun e-mail.') },
  };
  const { handler } = compile('../admin-commercial-cycle/index.ts', dependencies);
  const call = (action, payload = {}) => handler(new Request('https://fixture.invalid', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
    body: JSON.stringify({ action, requestId, ...payload }),
  }));
  return { calls, call, requestId, actorId };
}

test('les actions de nettoyage sont réservées à l’administrateur', async () => {
  const fixture = commercialCleanupFixture('employee');
  assert.equal((await fixture.call('cancel_follow_up', { itemId: randomUUID() })).status, 403);
  assert.equal(fixture.calls.length, 0);
});

test('la suppression du spam et le nettoyage d’une relance utilisent uniquement la fonction SQL prévue', async () => {
  const { call, calls, actorId, requestId } = commercialCleanupFixture();
  const itemId = randomUUID();
  assert.equal((await call('cancel_follow_up', { itemId })).status, 200);
  assert.equal((await call('purge_blocked_spam')).status, 200);
  assert.deepEqual(calls.map(([name, params]) => [name, { ...params }]), [
    ['cleanup_commercial_activity', { p_actor_id: actorId, p_request_id: requestId, p_action: 'cancel_follow_up', p_item_id: itemId }],
    ['cleanup_commercial_activity', { p_actor_id: actorId, p_request_id: requestId, p_action: 'purge_blocked_spam', p_item_id: null }],
  ]);
});

test('le conflit signalé par la base ressort dans l’interface sans envoi', async () => {
  const fixture = commercialCleanupFixture('admin', { code: 'FP409', message: 'La relance a déjà été traitée.' });
  const response = await fixture.call('cancel_follow_up', { itemId: randomUUID() });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'La relance a déjà été traitée.');
});

test('la suppression directe transmet le motif et le choix de blocage, sans envoyer de mail', async () => {
  const { call, calls, actorId, requestId } = commercialCleanupFixture('admin', null, 'deleted');
  const response = await call('remove_commercial_message', { reason: 'spam', blockEmail: true });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result, 'deleted');
  assert.equal(calls[0][0], 'remove_commercial_message');
  assert.deepEqual({ ...calls[0][1] }, {
    p_actor_id: actorId, p_request_id: requestId, p_communication_id: null, p_reason: 'spam', p_block_email: true,
  });
});

test('l’archivage d’un mail renvoie son résultat et reste réservé à l’administrateur', async () => {
  const itemId = randomUUID();
  const staff = commercialCleanupFixture('employee');
  assert.equal((await staff.call('remove_commercial_message', { itemId })).status, 403);
  assert.equal(staff.calls.length, 0);
  const admin = commercialCleanupFixture('admin', null, 'archived');
  const response = await admin.call('remove_commercial_message', { itemId });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result, 'archived');
  assert.equal(admin.calls[0][1].p_communication_id, itemId);
});
