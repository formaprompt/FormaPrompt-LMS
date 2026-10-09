import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrivacyHarness,NativePrivacyConnection} from './test-ai-act-challenge-privacy-harness.mjs';
const qa=process.env.CHALLENGE_PRIVACY_QA_DIR;if(!qa)throw Error('CHALLENGE_PRIVACY_QA_DIR_REQUIRED');
let h;const checks=[],nativeLocks=[];const active=s=>s.attempts.find(x=>x.status==='in_progress');
const test=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
const start=user=>h.rpc(user,'start',{request_id:randomUUID()});
const save=async(user,question='Q01',option='B')=>{const t=active(await h.rpc(user,'state'));return h.rpc(user,'save',{attempt_id:t.id,expected_revision:t.revision,question_code:question,option_code:option,request_id:randomUUID()});};
const plan=(user,operation='retention',extra={})=>h.privacy('admin','plan',{subject_user_id:h.fixtures[user]??user,operation,exceptions_reviewed:true,decision_reference:'LOCAL-REVIEW-NO-EXCEPTION',...extra});
const execute=p=>h.privacy('admin','execute',{plan_id:p.id,confirmation:p.confirmation});
const verify=(user,ended='2020-02-29T12:34:56Z',extra={})=>h.trainingAdmin('admin','verify',{subject_user_id:h.fixtures[user]??user,request_id:randomUUID(),ended_at:ended,evidence_kind:'controlled_external',evidence_reference:'LOCAL-FICTITIOUS-END-VERIFIED',evidence_sha256:'a'.repeat(64),evidence_reviewed:true,reason_code:'LOCAL-MANUAL-REVIEW',confirmed:true,expected_revision:0,...extra});
async function finish(user){let state=await start(user);for(const q of state.questions)state=await save(user,q.code,'A');const t=active(state);return h.rpc(user,'finish',{attempt_id:t.id,expected_revision:t.revision,confirmed:true});}
const commercial=async()=>JSON.stringify({access:(await h.db.query('SELECT * FROM course_access ORDER BY user_id')).rows,purchases:(await h.db.query('SELECT * FROM purchases ORDER BY id')).rows});
try{
  h=await createPrivacyHarness();const initialCommercial=await commercial();
  await test('RLS/ACL : procédure admin stricte, helpers et tables privés',async()=>{
    for(const user of ['learner','trainer','employee','outsider'])await assert.rejects(h.privacy(user,'preview',{subject_user_id:h.fixtures.learner}),/ACCESS_DENIED/);
    await assert.rejects(h.as(null,"SELECT admin_challenge_privacy('audit','{}')",[],'anon'),/permission denied/);
    for(const table of ['training_closures','privacy_plans','privacy_context','privacy_audit']){
      const acl=(await h.db.query("SELECT relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'SELECT') AS client FROM pg_class WHERE oid=$1::regclass",[`private.challenge_${table}`])).rows[0];
      assert.deepEqual(acl,{relrowsecurity:true,relforcerowsecurity:true,client:false});
      await assert.rejects(h.as('admin',`SELECT * FROM private.challenge_${table}`),/permission denied/);
    }
    await assert.rejects(h.as('admin',"SELECT private.challenge_privacy_delete_allowed('challenge_paths',NULL,NULL,NULL)"),/permission denied/);
    await assert.rejects(h.as('admin','SELECT private.challenge_privacy_overview($1)',[h.fixtures.learner]),/permission denied/);
    await assert.rejects(h.as('admin','SELECT private.challenge_subject_authorization(NULL,NULL)'),/permission denied/);
  });
  await test('12 mois calendaires UTC : année bissextile, borne exacte et fuseaux',async()=>{
    for(const tz of ['UTC','Europe/Paris','Pacific/Auckland']){
      await h.db.exec(`SET timezone='${tz}';`);
      const result=(await h.db.query("SELECT private.challenge_retention_due('2020-02-29T12:34:56Z')=timestamptz '2021-02-28T12:34:56Z' AS leap,private.challenge_retention_due('2020-10-31T23:30:00Z')=timestamptz '2021-10-31T23:30:00Z' AS calendar")).rows[0];assert.deepEqual(result,{leap:true,calendar:true});
    }
    await h.db.exec("SET timezone='UTC';");
  });
  await test('Pas de purge formation non clôturée/non certifiée/non échue',async()=>{
    await start('learner');await assert.rejects(plan('learner'),/RETENTION_NOT_DUE/);
    const recently=new Date();recently.setUTCMonth(recently.getUTCMonth()-1);await verify('learner',recently.toISOString());
    await assert.rejects(plan('learner'),/RETENTION_NOT_DUE/);
    await h.trainingAdmin('admin','reopen',{subject_user_id:h.fixtures.learner,request_id:randomUUID(),expected_revision:1,reason_code:'LOCAL-REOPENED',confirmed:true});
    await assert.rejects(plan('learner'),/RETENTION_NOT_DUE/);
    await verify('learner','2020-02-29T12:34:56Z',{expected_revision:2});
    await assert.rejects(plan('learner','retention',{exceptions_reviewed:false}),/EXCEPTION_REVIEW_REQUIRED/);
  });
  await test('Fin dossier existant : validation explicite, source et reprise contrôlées',async()=>{
    const id=randomUUID();await h.db.query("INSERT INTO training_enrollments VALUES($1,$2,$3,'completed','Fictive','Test',now(),$4,$4,now())",[id,h.fixtures.learner2,h.course,'2020-03-31T23:00:00Z']);await start('learner2');
    await assert.rejects(verify('learner2','2020-04-01T00:00:00Z',{evidence_kind:'document',evidence_id:id}),/EVIDENCE_NOT_VALID/);
    await verify('learner2','2020-03-31T23:00:00Z',{source_enrollment_id:id});assert.equal((await h.privacy('admin','preview',{subject_user_id:h.fixtures.learner2})).eligible,true);
    const p=await plan('learner2');await h.db.query("UPDATE training_enrollments SET status='in_progress',updated_at=clock_timestamp() WHERE id=$1",[id]);
    await assert.rejects(execute(p),/RETENTION_NOT_DUE/);
    await assert.rejects(verify('learner2','2020-03-31T23:00:00Z',{expected_revision:1,source_enrollment_id:id}),/ALREADY_VERIFIED|TRAINING_NOT_CLOSED/);
    await h.db.query("UPDATE training_enrollments SET status='completed',updated_at=clock_timestamp() WHERE id=$1",[id]);
    assert.equal((await h.privacy('admin','preview',{subject_user_id:h.fixtures.learner2})).eligible,false);
    await h.trainingAdmin('admin','review',{subject_user_id:h.fixtures.learner2,request_id:randomUUID(),expected_revision:1,reason_code:'SOURCE-CHANGED',confirmed:true});
    await verify('learner2','2020-03-31T23:00:00Z',{expected_revision:2,source_enrollment_id:id});
  });
  await test('Lecture/replay/choix identique/changement/finish ne déplacent jamais échéance formation',async()=>{
    const before=await h.privacy('admin','preview',{subject_user_id:h.fixtures.learner});const t=active(await h.rpc('learner','state'));
    const payload={attempt_id:t.id,expected_revision:t.revision,question_code:'Q01',option_code:'B',request_id:randomUUID()};
    await h.rpc('learner','save',payload);await h.rpc('learner','save',payload);await save('learner');await save('learner','Q01','A');await h.rpc('learner','state');
    const after=await h.privacy('admin','preview',{subject_user_id:h.fixtures.learner});assert.equal(after.due_at,before.due_at);assert.deepEqual(after.closure,before.closure);
  });
  await test('Export complet et catégorie manuelle dans assistant historique',async()=>{
    const exported=await h.privacy('admin','export',{subject_user_id:h.fixtures.learner});assert.equal(exported.paths.length,1);assert.equal(exported.attempts.length,1);assert.equal(exported.answers.length,1);assert.ok(exported.save_requests.length>=3);
    const state=await h.rpc('learner','state'),q=state.questions.find(x=>x.code==='Q01');assert.equal(exported.readable_responses.length,1);
    const readable=exported.readable_responses[0];assert.equal(readable.scenario,q.scenario);assert.equal(readable.selected_text,q.options.find(x=>x.code===readable.selected_code).text);assert.equal(readable.question_number,1);assert.equal(readable.attempt_number,1);assert.equal(readable.version,state.version);assert.equal(readable.score_out_of_12,null);
    assert.ok(!/correct_option|legal_reference|explanation/.test(JSON.stringify(exported)));
    const id=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified','full_erasure_possible','ready_for_execution')",[id,h.fixtures.learner]);
    const analysis=(await h.as('admin','SELECT admin_analyze_privacy_request($1) AS data',[id])).rows[0].data;assert.equal(analysis.challenge_manual_step.counts.paths,1);
    await assert.rejects(h.as('admin',"SELECT admin_execute_privacy_request($1,'CONFIRM','LOCAL REASON')",[id]),/CHALLENGE_PRIVACY_STEP_REQUIRED/);
  });
  await test('Plan nominatif court et stale check : sauvegarde/fin source/révision admin',async()=>{
    let p=await plan('learner');await save('learner','Q02','A');await assert.rejects(execute(p),/STALE_PLAN/);
    p=await plan('learner');await h.trainingAdmin('admin','review',{subject_user_id:h.fixtures.learner,request_id:randomUUID(),expected_revision:3,reason_code:'CORRECT-EFFECTIVE-END',confirmed:true}); await verify('learner','2020-03-01T00:00:00Z',{expected_revision:4});await assert.rejects(execute(p),/STALE_PLAN/);
    await assert.rejects(execute({...p,confirmation:'WRONG'}),/CONFIRMATION_REQUIRED/);
  });
  await test('Plans expirés/annulés : aucun UUID/digest nominatif conservé',async()=>{
    const p=await plan('learner');await h.db.query("UPDATE private.challenge_privacy_plans SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[p.id]);
    await h.privacy('admin','cleanup_plans');assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_plans WHERE id=$1',[p.id])).rows[0].n),0);
    await assert.rejects(execute(p),/PLAN_MISSING_OR_EXPIRED/);
    const cancel=await plan('learner');await h.privacy('admin','cancel_plan',{subject_user_id:h.fixtures.learner,plan_id:cancel.id});
    assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_plans WHERE id=$1',[cancel.id])).rows[0].n),0);
  });
  await test('Voie dédiée : refus suppression ordinaire et faux contexte client',async()=>{
    const t=active(await h.rpc('learner','state'));
    await assert.rejects(h.db.query('DELETE FROM private.challenge_attempts WHERE id=$1',[t.id]),/PRIVACY_DEDICATED_EXECUTION_REQUIRED/);
    await assert.rejects(h.as('admin','INSERT INTO private.challenge_privacy_context VALUES(pg_backend_pid(),txid_current(),$1,NULL)',[h.fixtures.learner]),/permission denied/);
    await h.db.exec("SELECT set_config('challenge.privacy_context','forged',false);");
    await assert.rejects(h.db.query('DELETE FROM private.challenge_paths WHERE user_id=$1',[h.fixtures.learner]),/PRIVACY_DEDICATED_EXECUTION_REQUIRED/);
  });
  await test('Clôture puis purge atomique : aucun score/choix/log/métadonnée/quota sujet',async()=>{
    await finish('learner');const p=await plan('learner');
    // Injection panne fixture APRES plusieurs DELETE : aucune suppression partielle.
    await h.db.exec("CREATE FUNCTION private.fail_fixture_purge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_FAILURE'; END $$; CREATE TRIGGER zz_fail_fixture BEFORE DELETE ON private.challenge_paths FOR EACH ROW EXECUTE FUNCTION private.fail_fixture_purge();");
    const before=await h.privacy('admin','export',{subject_user_id:h.fixtures.learner});await assert.rejects(execute(p),/FIXTURE_FAILURE/);
    assert.deepEqual(await h.privacy('admin','export',{subject_user_id:h.fixtures.learner}),before);
    assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_context')).rows[0].n),0);
    await h.db.exec('DROP TRIGGER zz_fail_fixture ON private.challenge_paths;');
    const done=await execute(p);assert.equal(done.paths_deleted,1);assert.equal(done.attempts_deleted,1);assert.equal(done.answers_deleted,12);assert.ok(done.request_logs_deleted>=12);
    const after=await h.privacy('admin','export',{subject_user_id:h.fixtures.learner});for(const key of ['paths','attempts','answers','start_requests','save_requests'])assert.deepEqual(after[key],[]);assert.equal(after.overview.closure,null);
    assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_plans WHERE subject_user_id=$1',[h.fixtures.learner])).rows[0].n),0);
  });
  await test('Audit minimal sans sujet/score/hash de parcours, droits/achats intacts',async()=>{
    const audit=await h.privacy('admin','audit');assert.equal(audit.length,1);
    const allowed=['id','actor_user_id','executed_at','operation','procedure_version','paths_deleted','attempts_deleted','answers_deleted','request_logs_deleted','grants_deleted','actor_references_unlinked','administrative_references_unlinked'];assert.deepEqual(Object.keys(audit[0]).sort(),allowed.sort());
    assert.ok(!JSON.stringify(audit).includes(h.fixtures.learner));assert.equal(await commercial(),initialCommercial);
  });
  await test('Après effacement : ancien replay refusé, nouveau quota deux si accès persiste',async()=>{
    const oldPlan=await plan('learner2');const oldState=await h.rpc('learner2','state');await execute(oldPlan);
    await assert.rejects(h.rpc('learner2','save',{attempt_id:active(oldState).id,expected_revision:0,question_code:'Q01',option_code:'B',request_id:randomUUID()}),/ACCESS_DENIED/);
    const fresh=await start('learner');assert.equal(active(fresh).number,1);assert.equal(fresh.best_score,null);assert.deepEqual(active(fresh).answers,{});
    await finish('learner');assert.equal(active(await start('learner')).number,2);await finish('learner');await assert.rejects(start('learner'),/ATTEMPT_LIMIT/);
  });
  await test('Échéance apprenant : habilitation formateur et auteurs tiers préservés',async()=>{
    await start('trainer');await h.rpc('admin','grant',{user_id:h.fixtures.trainer,course_id:h.course,active:true});await verify('trainer');
    await h.db.query('INSERT INTO private.challenge_trainer_grants VALUES($1,$2,true,clock_timestamp(),$3)',[h.fixtures.employee,h.course,h.fixtures.trainer]);
    const before=(await h.db.query('SELECT * FROM private.challenge_trainer_grants ORDER BY user_id')).rows;
    const result=await execute(await plan('trainer'));assert.equal(result.grants_deleted,0);assert.equal(result.actor_references_unlinked,0);assert.equal(result.administrative_references_unlinked,0);
    assert.deepEqual((await h.db.query('SELECT * FROM private.challenge_trainer_grants ORDER BY user_id')).rows,before);
    assert.equal((await h.rpc('trainer','permissions')).can_train,true);
  });
  await test('Demande sujet : identité/décision contrôlées et grants reçus/acteurs minimisés',async()=>{
    await start('trainer');const request=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified',NULL,'ready_for_execution')",[request,h.fixtures.trainer]);
    await assert.rejects(plan('trainer','subject_erasure',{request_id:request}),/PRIVACY_REQUEST_NOT_APPROVED/);
    await h.db.query("UPDATE privacy_requests SET administrative_decision='full_erasure_possible' WHERE id=$1",[request]);
    await assert.rejects(plan('trainer','subject_erasure',{request_id:request}),/CHALLENGE_CATEGORY_DECISION_REQUIRED/);
    const assessment=randomUUID(),action=randomUUID(),run=randomUUID();
    await h.db.query("INSERT INTO privacy_dependency_assessments VALUES($1,$2,'lesson_progress',$3,clock_timestamp())",[assessment,request,run]);
    await h.db.query("INSERT INTO privacy_processing_actions VALUES($1,$2,$3,'retain','approved')",[action,request,assessment]);
    await assert.rejects(plan('trainer','subject_erasure',{request_id:request,challenge_decision:'erase',challenge_exceptions_reviewed:true,decision_reference:'LOCAL-DECISION-ERASURE'}),/CHALLENGE_RETENTION_EXCEPTION/);
    await h.db.query("UPDATE privacy_processing_actions SET resolution='delete' WHERE id=$1",[action]);
    await h.rpc('admin','grant',{user_id:h.fixtures.trainer,course_id:h.course,active:true});
    await h.db.query('INSERT INTO private.challenge_trainer_grants VALUES($1,$2,true,clock_timestamp(),$3)',[h.fixtures.outsider,h.course,h.fixtures.trainer]);
    let p=await plan('trainer','subject_erasure',{request_id:request,challenge_decision:'erase',challenge_exceptions_reviewed:true,decision_reference:'LOCAL-DECISION-ERASURE'});
    await h.db.query("UPDATE privacy_requests SET administrative_decision='partial_erasure_or_anonymization_required' WHERE id=$1",[request]);await assert.rejects(execute(p),/STALE_PRIVACY_DECISION/);
    await h.db.query("UPDATE privacy_processing_actions SET resolution='retain' WHERE id=$1",[action]);
    await assert.rejects(plan('trainer','subject_erasure',{request_id:request,challenge_decision:'erase',challenge_exceptions_reviewed:true,decision_reference:'LOCAL-DECISION-ERASURE'}),/CHALLENGE_RETENTION_EXCEPTION/);
    await h.db.query("UPDATE privacy_processing_actions SET resolution='delete' WHERE id=$1",[action]);
    p=await plan('trainer','subject_erasure',{request_id:request,challenge_decision:'erase',challenge_exceptions_reviewed:true,decision_reference:'LOCAL-DECISION-ERASURE'});
    const result=await execute(p);assert.equal(result.grants_deleted,1);assert.equal(result.actor_references_unlinked,2);
    const kept=(await h.db.query('SELECT active,updated_by FROM private.challenge_trainer_grants WHERE user_id=$1',[h.fixtures.outsider])).rows[0];assert.deepEqual(kept,{active:true,updated_by:null});
    const historical=(await h.as('admin',"SELECT admin_execute_privacy_request($1,'CONFIRM','LOCAL REASON') AS data",[request])).rows[0].data;assert.equal(historical.historical_step,true);
  });
  await test('Attestation sans sourceId : toute évolution dossier bloque et référence opaque imposée',async()=>{
    await start('newcomer');const enrollment=randomUUID();await h.db.query("INSERT INTO training_enrollments VALUES($1,$2,$3,'completed','Fictive','Test',now(),'2020-01-01','2020-01-01',now())",[enrollment,h.fixtures.newcomer,h.course]);
    await assert.rejects(verify('newcomer',undefined,{evidence_reference:'Nom prenom@example.invalid'}),/EVIDENCE_NOT_VALID/);
    await verify('newcomer');await h.db.query("UPDATE training_enrollments SET ends_at='2022-01-01',updated_at=clock_timestamp() WHERE id=$1",[enrollment]);
    assert.equal((await h.privacy('admin','preview',{subject_user_id:h.fixtures.newcomer})).eligible,false);await assert.rejects(plan('newcomer'),/RETENTION_NOT_DUE/);
    await h.trainingAdmin('admin','review',{subject_user_id:h.fixtures.newcomer,request_id:randomUUID(),expected_revision:1,reason_code:'SOURCE-CHANGED',confirmed:true}); await verify('newcomer','2020-02-29T12:34:56Z',{expected_revision:2});
  });
  await test('Sujet administrateur : références tiers déliées et autoeffacement sans recréer UUID',async()=>{
    h.fixtures.admin2='10000000-0000-4000-8000-000000000102';await h.db.query("INSERT INTO profiles VALUES($1,'admin')",[h.fixtures.admin2]);
    await start('admin');const otherPlan=await plan('newcomer');
    const referenceExport=await h.privacy('admin','export',{subject_user_id:h.fixtures.admin});assert.ok(referenceExport.verified_training_events.length>=1);assert.ok(referenceExport.administrative_actions.length>=1);assert.ok(referenceExport.created_plan_events.length>=1);
    const request=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified','full_erasure_possible','ready_for_execution')",[request,h.fixtures.admin]);
    const p=await h.privacy('admin2','plan',{subject_user_id:h.fixtures.admin,operation:'subject_erasure',request_id:request,challenge_decision:'erase',exceptions_reviewed:true,challenge_exceptions_reviewed:true,decision_reference:'LOCAL-ADMIN-ERASURE'});
    const done=await h.privacy('admin2','execute',{plan_id:p.id,confirmation:p.confirmation});assert.ok(done.administrative_references_unlinked>=3);
    const secondaryOnly=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified','full_erasure_possible','ready_for_execution')",[secondaryOnly,h.fixtures.admin2]);
    await assert.rejects(h.as('admin',"SELECT admin_execute_privacy_request($1,'CONFIRM','LOCAL REASON')",[secondaryOnly]),/CHALLENGE_PRIVACY_STEP_REQUIRED/);
    for(const [table,column] of [['training_closures','verified_by'],['privacy_audit','actor_user_id'],['privacy_plans','created_by']])assert.equal(Number((await h.db.query(`SELECT count(*) AS n FROM private.challenge_${table} WHERE ${column}=$1`,[h.fixtures.admin])).rows[0].n),0);
    const retained=(await h.db.query('SELECT created_by FROM private.challenge_privacy_plans WHERE id=$1',[otherPlan.id])).rows[0];assert.equal(retained.created_by,null);
    await start('admin');const ownRequest=randomUUID();await h.db.query("INSERT INTO privacy_requests VALUES($1,$2,'erasure','verified','full_erasure_possible','ready_for_execution')",[ownRequest,h.fixtures.admin]);
    const self=await plan('admin','subject_erasure',{request_id:ownRequest,challenge_decision:'erase',challenge_exceptions_reviewed:true,decision_reference:'LOCAL-SELF-ERASURE'});await execute(self);
    assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_audit WHERE actor_user_id=$1',[h.fixtures.admin])).rows[0].n),0);
    assert.equal(Number((await h.db.query('SELECT count(*) AS n FROM private.challenge_privacy_plans WHERE subject_user_id=$1 OR created_by=$1',[h.fixtures.admin])).rows[0].n),0);
  });
  if(h.native)await test('Concurrence native : plan exécuté pendant save retenu => stale, aucune purge',async()=>{
    await start('outsider');await verify('outsider');const p=await plan('outsider');const lock=new NativePrivacyConnection();
    try{
      await lock.exec(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${h.fixtures.outsider}',false);`);
      const state=(await lock.query("SELECT ai_act_challenge('state','{}') AS data")).rows[0].data;const t=active(state);
      await lock.query('SELECT ai_act_challenge($1,$2::jsonb)', ['save',JSON.stringify({attempt_id:t.id,expected_revision:t.revision,question_code:'Q01',option_code:'B',request_id:randomUUID()})]);
      const pid=(await h.db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pending=execute(p).then(()=>null,error=>error);const observer=new NativePrivacyConnection();
      try{const deadline=Date.now()+5000;let observed=false;while(Date.now()<deadline){const row=(await observer.query("SELECT pid,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[pid])).rows[0];if(row){nativeLocks.push(row);observed=true;break;}await new Promise(r=>setTimeout(r,20));}assert.equal(observed,true);}finally{await observer.close();await lock.exec('COMMIT; RESET ROLE;');}
      assert.match((await pending).message,/STALE_PLAN/);assert.equal((await h.privacy('admin','preview',{subject_user_id:h.fixtures.outsider})).counts.paths,1);
    }finally{await lock.close();}
  });
  assert.equal(await commercial(),initialCommercial);
  await mkdir(qa,{recursive:true});await writeFile(`${qa}/${h.native?'native':'pglite'}-privacy-results.json`,JSON.stringify({status:'PASS',engine:h.native?'PostgreSQL native':'PGlite PostgreSQL WASM',fixtureAuth:true,realSupabaseJwt:false,policy:'pendant formation puis 12 mois calendaires UTC après fin effective certifiée',checks,migrationHashes:h.migrationHashes,nativeLocks,commercialUnchanged:true},null,2));
}catch(error){await mkdir(qa,{recursive:true});await writeFile(`${qa}/${h?.native?'native':'pglite'}-privacy-results.json`,JSON.stringify({status:'FAIL',checks,error:error.message,stack:error.stack},null,2));console.error(error.message);process.exitCode=1;}finally{await h?.close();}
