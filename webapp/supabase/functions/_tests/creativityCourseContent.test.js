import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as accessHelpers from '../_shared/paidCourseAccess.js';
import * as excelHelpers from '../_shared/excelInitiationResources.js';
import * as officeHelpers from '../_shared/officeResources.js';
import { courseCatalog } from '../_shared/paidCourseCatalog.js';
import { creativityCourseCatalog } from '../_shared/creativityCourseCatalog.js';
const ids = Object.keys(creativityCourseCatalog);
const source = readFileSync(new URL('../paid-course-content/index.ts', import.meta.url), 'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
function fixture(access) {
  let handler;
  const reads = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'learner' } }, error: null }) }, from: table => {
    const filters = [];
    reads.push({ table, filters });
    const query = { select: () => query, eq: (key,value) => { filters.push([key,value]); return query; }, maybeSingle: async () => ({ data: table === 'profiles' ? { role: 'user' } : access && filters.every(([key,value]) => access[key] === value) ? access : null, error: null }) };
    return query;
  }, storage: { from: () => { throw new Error('Aucune ressource Storage fictive ne doit être signée.'); } } };
  const values = { ...accessHelpers, ...excelHelpers, ...officeHelpers, courseCatalog, createClient: () => client, corsHeaders: {}, jsonResponse: (value,status=200) => new Response(JSON.stringify(value),{status}), Deno: { env: { get: () => 'configured' }, serve: h => { handler=h; } } };
  new Function(...Object.keys(values), code)(...Object.values(values));
  return { reads, send: (body,token=true) => handler(new Request('https://local.test',{method:'POST',headers:{...(token ? { Authorization: 'Bearer token' } : {}), 'Content-Type':'application/json'},body:JSON.stringify(body)})) };
}
for (const id of ids) {
  test(`contenu privé ${id} autorisé uniquement avec le droit exact actif`,async()=>{
    const f=fixture({user_id:'learner',course_id:id,status:'active',expires_at:null});
    const response=await f.send({action:'course',courseId:id,userId:'other-user'});
    assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.course.modules.length,4);assert.equal(data.course.exercises.length,6);assert.equal(data.course.textResources.length,5);assert.equal(data.course.initialPositioningRequired,false);
    assert.deepEqual(f.reads.find(r=>r.table==='course_access').filters,[['user_id','learner'],['course_id',id]]);
    assert.equal(f.reads.some(r=>r.table==='purchases'),false);
  });
  for (const status of ['suspended','refunded','revoked','scheduled']) test(`contenu ${id} refusé pour droit ${status}`,async()=>{
    const response=await fixture({user_id:'learner',course_id:id,status,expires_at:null}).send({action:'course',courseId:id});assert.equal(response.status,403);assert.equal((await response.json()).course,undefined);
  });
  test(`contenu ${id} refusé sans droit ou avec droit expiré`,async()=>{
    assert.equal((await fixture(null).send({action:'course',courseId:id})).status,403);
    assert.equal((await fixture({user_id:'learner',course_id:id,status:'active',expires_at:'2020-01-01'}).send({action:'course',courseId:id})).status,403);
  });
  test(`pas de guide ni vidéo inventés pour ${id}`,()=>{assert.throws(()=>accessHelpers.trainerGuideObjectPath(id),/indisponible/);assert.equal(accessHelpers.courseHasIonVideo(id),false);});
}
test('un droit de groupe ne donne pas le contenu individuel et un autre compte ne donne aucun droit',async()=>{
  const f=fixture({user_id:'learner',course_id:'ia-creativite-groupe',status:'active',expires_at:null});assert.equal((await f.send({action:'course',courseId:'ia-creativite-individuel'})).status,403);
  const other=fixture({user_id:'other',course_id:'ia-creativite-individuel',status:'active',expires_at:null});assert.equal((await other.send({action:'course',courseId:'ia-creativite-individuel'})).status,403);
});
test('anonyme et variante inconnue sont refusés',async()=>{assert.equal((await fixture(null).send({action:'course',courseId:ids[0]},false)).status,401);assert.equal((await fixture(null).send({action:'course',courseId:'ia-creativite'})).status,400);});
test('les métadonnées publiques ne contiennent aucune leçon ou support privé',()=>{
 const text=readFileSync(new URL('../../../src/data/courseCatalog.js',import.meta.url),'utf8');assert.doesNotMatch(text,/initialPositioningRequired|textResources|markdown|guidedSteps|lesson|glossary|\/assets\//);
 for(const id of ids){assert.match(text,new RegExp(id));assert.equal(courseCatalog[id].exercises.length,6)}
 const player=readFileSync(new URL('../../../src/pages/CoursePlayer.jsx',import.meta.url),'utf8');assert.doesNotMatch(player,/import.*(?:paidCourseCatalog|creativityCourseCatalog)/);assert.match(player,/rehypeSanitize/);assert.match(player,/skipHtml/);
});
