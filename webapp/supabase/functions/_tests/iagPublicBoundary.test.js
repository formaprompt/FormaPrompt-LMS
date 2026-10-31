import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iagPrivateCourseCatalog } from '../_shared/iagPrivateCourseCatalog.js';
import { iagPrivateResourceAllowlist, lookupIagResource } from '../_shared/iagPrivateResourceAllowlist.js';
import { iagResourceImportReceipt } from '../_shared/iagResourceImportReceipt.js';
import { handleIagPrivateAction } from '../_shared/iagPrivateDelivery.js';
import { courseCatalog } from '../_shared/paidCourseCatalog.js';
import ts from 'typescript';
import * as accessHelpers from '../_shared/paidCourseAccess.js';
import * as positioning from '../_shared/iagPositioning.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => readFileSync(path.join(root, p), 'utf8');
test('public modules contain no IAG paid payload and keep an unpromoted receipt', () => {
  assert.deepEqual(Object.keys(iagPrivateCourseCatalog), []);
  assert.deepEqual(Object.keys(iagPrivateResourceAllowlist), []);
  assert.equal(iagResourceImportReceipt.status, 'NOT_IMPORTED');
  assert.deepEqual(Object.keys(iagResourceImportReceipt.entries), []);
  assert.throws(() => lookupIagResource({}), /absent/);
  assert.ok(Buffer.byteLength(read('supabase/functions/_shared/iagPrivateCourseCatalog.js')) < 1000);
  assert.ok(Buffer.byteLength(read('supabase/functions/_shared/iagPrivateResourceAllowlist.js')) < 1000);
});

test('canonical public assessment migration excludes the paid seed and retains its database guards', () => {
  const source = read('supabase/migrations/20261024064209_iag_assessments.sql');
  assert.match(source, /CREATE TABLE private\.iag_rubric_versions/);
  assert.match(source, /rubric_version text NOT NULL REFERENCES private\.iag_rubric_versions\(version\)/);
  assert.match(source, /REVOKE ALL ON private\.iag_rubric_versions FROM PUBLIC, anon, authenticated/);
  assert.match(source, /ALTER TABLE private\.iag_rubric_versions ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(source, /INSERT INTO private\.iag_rubric_versions|\$v7\$|"criteres_essentiels"|"grilles"/);
});
test('missing private bundle refuses content before Storage and preserves other courses', async () => {
  let touched = false;
  const adminClient = new Proxy({}, { get() { touched = true; throw new Error('Storage must not be used'); } });
  for (const action of ['iag_document', 'iag_resource', 'iag_resource_renew']) {
    const response = await handleIagPrivateAction({ action, payload: {}, adminClient });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'IAG_PRIVATE_BUNDLE_REQUIRED');
  }
  assert.equal(touched, false);
  assert.equal(courseCatalog['formation-ia-generative-elearning'], undefined);
  assert.ok(Object.keys(courseCatalog).length > 1);
});
test('Auth, exact entitlement and questionnaire precede private actions and missing catalogue response', () => {
  const source = read('supabase/functions/paid-course-content/index.ts');
  const gate = source.indexOf('if (!await requireIagPositioning');
  assert.ok(source.indexOf('authClient.auth.getUser(token)') < gate);
  assert.ok(source.indexOf('if (!hasUsableCourseAccess(access))') < gate);
  assert.ok(gate < source.lastIndexOf('await handleIagPrivateAction'));
  assert.ok(gate < source.indexOf("code: 'IAG_PRIVATE_BUNDLE_REQUIRED'"));
  assert.match(source, /Cache-Control', 'private, no-store'/);
});
function endpoint({role='user', entitlement=null, completed=false, auth=true}={}) {
  let handler, usedPrivate=0;
  const client={auth:{getUser:async()=>({data:{user:auth?{id:'actor'}:null},error:null})},from(table){
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='profiles'?{role}:entitlement,error:null})}; return q;
  }};
  const values={...accessHelpers,...positioning,courseCatalog,createClient:()=>client,corsHeaders:{},
    requireIagPositioning:async()=>completed,
    handleIagPrivateAction:async()=>{usedPrivate++;return{status:200,body:{rubrics:{synthetic:true},rubricVersion:'v7-2026-10-21'}};},
    jsonResponse:(value,status=200)=>new Response(JSON.stringify(value),{status}),Deno:{env:{get:()=> 'offline'},serve:h=>{handler=h;}}};
  const source=read('supabase/functions/paid-course-content/index.ts').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'');
  new Function(...Object.keys(values),ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}))(...Object.values(values));
  return {send:(action='iag_rubrics')=>handler(new Request('https://offline.invalid',{method:'POST',headers:{Authorization:'Bearer fictitious','Content-Type':'application/json'},body:JSON.stringify({action,courseId:positioning.IAG_COURSE_ID})})),calls:()=>usedPrivate};
}
test('rubric permission branch preserves staff correction scope and strict learner gates (offline endpoint)',async()=>{
  for(const role of ['admin','employee']) {
    const f=endpoint({role}); const response=await f.send(); assert.equal(response.status,200); assert.equal(f.calls(),1); assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal((await endpoint({role}).send('iag_document')).status,403);
  }
  for(const role of ['user','trainer','former-admin']) { const f=endpoint({role}); assert.equal((await f.send()).status,403); assert.equal(f.calls(),0); }
  assert.equal((await endpoint({role:'admin',auth:false}).send()).status,401);
  const active={status:'active',expires_at:null};
  assert.equal((await endpoint({entitlement:active}).send()).status,412);
  assert.equal((await endpoint({entitlement:active,completed:true}).send()).status,200);
  for(const status of ['revoked','suspended','refunded']) assert.equal((await endpoint({entitlement:{status,expires_at:null},completed:true}).send()).status,403);
});
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(dir, x.name)) : [path.join(dir, x.name)]);
}
test('frontend sources and existing frontend build never import private Edge data modules', () => {
  const forbidden = /iagPrivateCourseCatalog|iagPrivateResourceAllowlist|iagResourceImportReceipt/;
  for (const filename of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'dist'))]) {
    if (!/\.(?:jsx?|tsx?|json|html|map)$/.test(filename)) continue;
    assert.doesNotMatch(readFileSync(filename, 'utf8'), forbidden, path.relative(root, filename));
  }
  const publicRubrics=path.join(root,'src/data/iagRubricsV7.json');
  if(existsSync(publicRubrics)) {
    const value=readFileSync(publicRubrics,'utf8');
    assert.ok(Buffer.byteLength(value)<1024,'Detailed paid rubrics must remain server-side');
    assert.equal(Object.hasOwn(JSON.parse(value),'grilles'),false);
    assert.equal(Object.hasOwn(JSON.parse(value),'criteres_essentiels'),false);
  }
});
