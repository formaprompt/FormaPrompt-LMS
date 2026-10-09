import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrivacyHarness,NativePrivacyConnection} from './test-ai-act-challenge-privacy-harness.mjs';
const qa=process.env.CHALLENGE_PRIVACY_QA_DIR;if(!qa)throw Error('CHALLENGE_PRIVACY_QA_DIR_REQUIRED');
let h;const checks=[],locks=[];
const test=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
const payload=(user,revision,extra={})=>({subject_user_id:h.fixtures[user],request_id:randomUUID(),expected_revision:revision,confirmed:true,reason_code:'LOCAL-PROOF-REVIEW',...extra});
const verify=(user,revision,extra={})=>h.trainingAdmin('admin','verify',payload(user,revision,{ended_at:'2020-02-29T12:34:56Z',evidence_kind:'controlled_external',evidence_reference:'FIXTURE-PIECE-001',evidence_sha256:'b'.repeat(64),evidence_reviewed:true,...extra}));
const plan=user=>h.privacy('admin','plan',{subject_user_id:h.fixtures[user],operation:'retention',exceptions_reviewed:true,decision_reference:'LOCAL-NO-EXCEPTION'});
const execute=p=>h.privacy('admin','execute',{plan_id:p.id,confirmation:p.confirmation});
try{
 h=await createPrivacyHarness();
 await h.db.exec(`CREATE TABLE training_documents(id uuid PRIMARY KEY,enrollment_id uuid,user_id uuid,course_id text,document_type text,status text,content_snapshot jsonb,generated_at timestamptz);
 CREATE TABLE course_attestation_issuances(id bigint PRIMARY KEY,user_id uuid,course_id text,document_type text,reference text,content_snapshot jsonb,issued_at timestamptz);`);
 const unchanged=JSON.stringify((await h.db.query('SELECT * FROM course_access ORDER BY user_id')).rows);
 await test('Accès dédié : strictadmin, tables/helpers privés, apprenant uniquement soi',async()=>{
  for(const user of ['learner','trainer','employee','outsider'])await assert.rejects(h.trainingAdmin(user,'analyse',{subject_user_id:h.fixtures.learner}),/ACCESS_DENIED/);
  for(const t of ['training_declarations','training_history'])await assert.rejects(h.as('admin',`SELECT * FROM private.challenge_${t}`),/permission denied/);
  await assert.rejects(h.as('learner','SELECT private.challenge_training_analysis($1)',[h.fixtures.learner]),/permission denied/);
  await assert.rejects(h.as('learner',"SELECT private.challenge_training_rpc(NULL,'verify',$1::jsonb)",[JSON.stringify(payload('learner',0))]),/ACCESS_DENIED/);
  await assert.rejects(h.as(null,"SELECT challenge_training_status('status','{}')",[],'anon'),/permission denied/);
  assert.equal((await h.training('learner','status',{subject_user_id:h.fixtures.learner2})).revision,0);
  await assert.rejects(h.privacy('admin','verify_training',payload('learner',0)),/PEDAGOGICAL_EVIDENCE_REQUIRED/);
 });
 await test('Déclaration seule : aucune échéance ni purge ; replay et conflit',async()=>{
  const p={request_id:randomUUID(),expected_revision:0,declared_ended_at:'2020-01-01T00:00:00Z',confirmed:true};
  const state=await h.training('learner','declare',p);assert.equal(state.state,'declared');assert.equal(state.due_at,null);
  assert.deepEqual(await h.training('learner','declare',p),state);
  await assert.rejects(h.training('learner','declare',{...p,declared_ended_at:'2020-01-02'}),/REQUEST_ID_REUSED/);
  await assert.rejects(h.training('learner','declare',{...p,request_id:randomUUID()}),/REVISION_CONFLICT/);
  await assert.rejects(plan('learner'),/RETENTION_NOT_DUE/);
  await assert.rejects(verify('learner',1,{evidence_reviewed:false}),/EVIDENCE_REQUIRED/);
  await assert.rejects(h.training('learner','declare',{...p,request_id:randomUUID(),expected_revision:1,declared_ended_at:'2099-01-01'}),/INVALID_TRAINING_END/);
 });
 await test('Date effective distincte clic : preuve externe identifiée et vérification manuelle',async()=>{
  const p=payload('learner',1,{ended_at:'2020-02-29T12:34:56Z',evidence_kind:'controlled_external',evidence_reference:'FIXTURE-PIECE-001',evidence_sha256:'b'.repeat(64),evidence_reviewed:true});
  const r=await h.trainingAdmin('admin','verify',p);assert.equal(r.status.state,'verified');assert.equal(r.status.due_at,'2021-02-28T12:34:56+00:00');
  assert.equal(r.history.length,2);assert.notEqual(r.closure.ended_at,r.closure.verified_at);
  assert.deepEqual(await h.trainingAdmin('admin','verify',p),r);
  await assert.rejects(h.trainingAdmin('admin','verify',{...p,reason_code:'OTHER'}),/REQUEST_ID_REUSED/);
  await assert.rejects(verify('learner',2),/ALREADY_VERIFIED/);
  await assert.rejects(h.db.query('UPDATE private.challenge_training_history SET reason_code=$1 WHERE user_id=$2',['FORGED',h.fixtures.learner]),/PEDAGOGICAL_HISTORY_IMMUTABLE/);
 });
 await test('Reprise/révision motivée : historique et plans invalidés, pas purge inactivité',async()=>{
  const p=await plan('learner');await h.trainingAdmin('admin','reopen',payload('learner',2,{reason_code:'REAL-TRAINING-RESUMED'}));
  assert.equal((await h.training('learner','status')).due_at,null);await assert.rejects(execute(p),/RETENTION_NOT_DUE/);
  await assert.rejects(h.trainingAdmin('admin','review',payload('learner',3,{reason_code:''})),/INVALID_INPUT/);
  await h.trainingAdmin('admin','review',payload('learner',3,{reason_code:'ABANDONMENT-TO-REVIEW'}));await assert.rejects(plan('learner'),/RETENTION_NOT_DUE/);
  await verify('learner',4);assert.equal((await h.trainingAdmin('admin','analyse',{subject_user_id:h.fixtures.learner})).history.length,5);
 });
 await test('completed_at et certificat clic insuffisants ; preuve étrangère refusée',async()=>{
  const id=randomUUID();await h.db.query("INSERT INTO training_enrollments VALUES($1,$2,$3,'completed',NULL,NULL,now(),now(),now(),now())",[id,h.fixtures.learner2,h.course]);
  assert.equal((await h.training('learner2','status')).due_at,null);
  const doc=randomUUID();await h.db.query("INSERT INTO training_documents VALUES($1,$2,$3,$4,'completion_certificate','completed','{}',now())",[doc,id,h.fixtures.learner2,h.course]);
  await assert.rejects(verify('learner2',0,{evidence_kind:'document',evidence_id:doc}),/EVIDENCE_NOT_VALID/);
  await h.db.query("INSERT INTO course_attestation_issuances VALUES(1,$1,$2,'realisation','FIXTURE-REA-1','{}',now())",[h.fixtures.learner,h.course]);
  await assert.rejects(verify('learner2',0,{evidence_kind:'attestation',evidence_id:'1'}),/EVIDENCE_NOT_VALID/);
 });
 await test('Preuve existante modifiée/rôle révoqué/dossier repris : réexamen obligatoire',async()=>{
  const doc=randomUUID();await h.db.query("INSERT INTO training_documents VALUES($1,NULL,$2,$3,'attendance_sheet','completed','{\"proof\":\"signed\"}',now())",[doc,h.fixtures.learner2,h.course]);
  await verify('learner2',0,{evidence_kind:'document',evidence_id:doc});assert.equal((await h.training('learner2','status')).state,'verified');
  const p=await plan('learner2');await h.db.query("UPDATE training_documents SET content_snapshot='{\"proof\":\"changed\"}' WHERE id=$1",[doc]);
  assert.equal((await h.training('learner2','status')).state,'review_required');await assert.rejects(execute(p),/RETENTION_NOT_DUE/);
  await h.trainingAdmin('admin','review',payload('learner2',1));await verify('learner2',2,{evidence_kind:'document',evidence_id:doc});
  await h.db.query("UPDATE profiles SET role='employee' WHERE id=$1",[h.fixtures.admin]);assert.equal((await h.training('learner2','status')).state,'review_required');await h.db.query("UPDATE profiles SET role='admin' WHERE id=$1",[h.fixtures.admin]);
  await h.db.query("UPDATE training_enrollments SET status='in_progress' WHERE user_id=$1",[h.fixtures.learner2]);assert.equal((await h.training('learner2','status')).state,'review_required');
  await h.trainingAdmin('admin','review',payload('learner2',3));await assert.rejects(verify('learner2',4),/TRAINING_NOT_CLOSED/);
 });
 await test('Attestation contrôlée : bonne personne/formation, source et document intacts',async()=>{
  await verify('outsider',0,{evidence_kind:'attestation',evidence_id:'999'}).then(()=>assert.fail(),e=>assert.match(e.message,/EVIDENCE_NOT_VALID/));
  await h.db.query("INSERT INTO course_attestation_issuances VALUES(2,$1,$2,'realisation','FIXTURE-REA-2','{}',now())",[h.fixtures.outsider,h.course]);
  const before=JSON.stringify((await h.db.query('SELECT * FROM course_attestation_issuances ORDER BY id')).rows);
  await verify('outsider',0,{evidence_kind:'attestation',evidence_id:'2'});assert.equal(JSON.stringify((await h.db.query('SELECT * FROM course_attestation_issuances ORDER BY id')).rows),before);
 });
 await test('Effacement atomique : déclaration/historique/quota retirés, aucune preuve LMS supprimée',async()=>{
  await h.rpc('learner','start',{request_id:randomUUID()});const p=await plan('learner');
  await h.db.exec("CREATE FUNCTION private.training_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_FINAL_FAIL'; END $$; CREATE TRIGGER zz_training_fail BEFORE DELETE ON private.challenge_training_history FOR EACH ROW EXECUTE FUNCTION private.training_fail();");
  const before=await h.privacy('admin','export',{subject_user_id:h.fixtures.learner});await assert.rejects(execute(p),/FIXTURE_FINAL_FAIL/);assert.deepEqual(await h.privacy('admin','export',{subject_user_id:h.fixtures.learner}),before);
  await h.db.exec('DROP TRIGGER zz_training_fail ON private.challenge_training_history');await execute(p);
  assert.equal((await h.training('learner','status')).revision,0);assert.equal(Number((await h.db.query('SELECT count(*) n FROM private.challenge_training_history WHERE user_id=$1',[h.fixtures.learner])).rows[0].n),0);
  assert.equal((await h.rpc('learner','start',{request_id:randomUUID()})).attempts[0].number,1);
  assert.equal(Number((await h.db.query('SELECT count(*) n FROM course_attestation_issuances')).rows[0].n),2);
 });
 await test('Opposition effective : collecte bloquée, suivi/statistiques exclus, consultation conservée',async()=>{
  let state=await h.rpc('learner','state');for(const q of state.questions){const a=state.attempts.find(x=>x.status==='in_progress');state=await h.rpc('learner','save',{attempt_id:a.id,expected_revision:a.revision,question_code:q.code,option_code:'A',request_id:randomUUID()});}
  const a=state.attempts.find(x=>x.status==='in_progress');await h.rpc('learner','finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:true});
  const request=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'objection','verified','pending','received')",[request,h.fixtures.learner]);
  const p=payload('learner',0,{privacy_request_id:request,expected_restriction_revision:0,review_due_at:new Date(Date.now()+90*86400000).toISOString(),decision_reviewed:true});
  const r=await h.trainingAdmin('admin','restrict',p);assert.equal(r.restriction.active,true);assert.deepEqual(await h.trainingAdmin('admin','restrict',p),r);
  await assert.rejects(h.trainingAdmin('employee','restrict',p),/ACCESS_DENIED/);
  for(const action of ['start','save','finish']){
   const data=action==='start'?{request_id:randomUUID()}:action==='save'?{attempt_id:a.id,expected_revision:a.revision,question_code:'Q01',option_code:'B',request_id:randomUUID()}:{attempt_id:a.id,expected_revision:a.revision,confirmed:true};
   await assert.rejects(h.rpc('learner',action,data),/CHALLENGE_PROCESSING_RESTRICTED/);
  }
  assert.equal((await h.rpc('learner','state')).attempts.length,1);assert.equal((await h.training('learner','status')).restriction.active,true);
  const overview=await h.rpc('admin','trainer_overview');assert.ok(!JSON.stringify(overview.learners).includes(h.fixtures.learner));assert.equal(overview.stats.best_score_count,undefined);
  assert.deepEqual(overview.questions,[]);await assert.rejects(h.rpc('admin','trainer_detail',{user_id:h.fixtures.learner}),/ACCESS_DENIED/);
  assert.equal((await h.privacy('admin','export',{subject_user_id:h.fixtures.learner})).processing_restriction.active,true);
  await h.training('learner','declare',{request_id:randomUUID(),expected_revision:0,confirmed:true,declared_ended_at:'2020-01-01'});
  await verify('learner',1);const purge=await plan('learner');await execute(purge);
  assert.equal((await h.training('learner','status')).restriction.active,true);await assert.rejects(h.rpc('learner','start',{request_id:randomUUID()}),/CHALLENGE_PROCESSING_RESTRICTED/);
  const lift=payload('learner',0,{privacy_request_id:request,expected_restriction_revision:1,review_due_at:new Date(Date.now()+90*86400000).toISOString(),decision_reviewed:true});
  await assert.rejects(h.trainingAdmin('admin','unrestrict',lift),/RESTRICTION_LIFTING_DECISION_REQUIRED/);
  await h.trainingAdmin('admin','unrestrict',{...lift,lifting_decision:true,lifting_evidence_reference:'WITHDRAWAL-EXPLICIT-PIECE-1'});
  assert.equal((await h.rpc('learner','start',{request_id:randomUUID()})).attempts[0].number,1);
 });
 await test('Restriction : plan stale, effacement sujet sans relancer collecte, aucune expiration automatique',async()=>{
  await verify('learner',0);const stale=await plan('learner');const req=randomUUID();
  await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'restriction','verified','pending','received')",[req,h.fixtures.learner]);
  await h.trainingAdmin('admin','restrict',payload('learner',1,{privacy_request_id:req,expected_restriction_revision:2,review_due_at:new Date(Date.now()+86400000).toISOString(),decision_reviewed:true}));
  await assert.rejects(execute(stale),/STALE_PLAN/);
  await h.db.query("UPDATE private.challenge_processing_restrictions SET review_due_at=clock_timestamp()-interval '1 day' WHERE user_id=$1",[h.fixtures.learner]);
  await assert.rejects(h.rpc('learner','start',{request_id:randomUUID()}),/CHALLENGE_PROCESSING_RESTRICTED/);
  const erase=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified','full_erasure_possible','ready_for_execution')",[erase,h.fixtures.learner]);
  const p=await h.privacy('admin','plan',{subject_user_id:h.fixtures.learner,operation:'subject_erasure',request_id:erase,exceptions_reviewed:true,decision_reference:'LOCAL-ERASURE-GAME',challenge_decision:'erase',challenge_exceptions_reviewed:true});await execute(p);
  assert.equal((await h.training('learner','status')).revision,0);assert.equal((await h.training('learner','status')).restriction.active,true);
  await assert.rejects(h.rpc('learner','start',{request_id:randomUUID()}),/CHALLENGE_PROCESSING_RESTRICTED/);
  assert.equal((await h.privacy('admin','export',{subject_user_id:h.fixtures.learner})).paths.length,0);
 });
 if(h.native)await test('Concurrence PostgreSQL : deux validations même révision => une seule acceptée',async()=>{
  const c=new NativePrivacyConnection();const observer=new NativePrivacyConnection();
  try{
   await c.exec(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${h.fixtures.admin}',false);`);
   await c.query('SELECT admin_challenge_training($1,$2::jsonb)', ['verify',JSON.stringify(payload('newcomer',0,{ended_at:'2020-01-01',evidence_kind:'controlled_external',evidence_reference:'FIXTURE-NATIVE',evidence_sha256:'c'.repeat(64),evidence_reviewed:true}))]);
   const pid=(await h.db.query('SELECT pg_backend_pid() pid')).rows[0].pid;const pending=verify('newcomer',0).then(()=>null,e=>e);
   let wait;for(let i=0;i<100;i++){wait=(await observer.query("SELECT pid,wait_event,pg_blocking_pids(pid) blockers FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[pid])).rows[0];if(wait)break;await new Promise(r=>setTimeout(r,20));}
   assert.ok(wait);locks.push(wait);await c.exec('COMMIT; RESET ROLE');assert.match((await pending).message,/REVISION_CONFLICT/);
   assert.equal((await h.trainingAdmin('admin','analyse',{subject_user_id:h.fixtures.newcomer})).history.length,1);
  }finally{await c.close();await observer.close();}
 });
 assert.equal(JSON.stringify((await h.db.query('SELECT * FROM course_access ORDER BY user_id')).rows),unchanged);
 await mkdir(qa,{recursive:true});await writeFile(`${qa}/${h.native?'native':'pglite'}-training-results.json`,JSON.stringify({status:'PASS',checks,locks,migrationHashes:h.migrationHashes,fixtureAuth:true,realJwt:false,commercialAccessUnchanged:true},null,2));
}catch(error){await mkdir(qa,{recursive:true});await writeFile(`${qa}/${h?.native?'native':'pglite'}-training-results.json`,JSON.stringify({status:'FAIL',checks,error:error.message,stack:error.stack},null,2));console.error(error);process.exitCode=1;}finally{await h?.close();}
