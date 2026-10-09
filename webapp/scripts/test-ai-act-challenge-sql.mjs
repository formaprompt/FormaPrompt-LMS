import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHarness,defaultQaDirectory} from './test-ai-act-challenge-harness.mjs';
const qa=process.env.CHALLENGE_QA_DIR||fileURLToPath(defaultQaDirectory);
let h;
const checks=[];
const rpc=(user,action,payload={})=>h.rpc(user,action,action==='start'?{request_id:randomUUID(),...payload}:payload);
const test=async(name,fn)=> {await fn();checks.push(name);console.log(`PASS ${name}`);};
const denied=async(user,action,payload,code)=>assert.rejects(rpc(user,action,payload),new RegExp(code));
const letters='BACBAABACBCC'.split('');
const active=state=>state.attempts.find(a=>a.status==='in_progress');
const save=async(user,a,code,option,extra={})=>rpc(user,'save',{attempt_id:a.id,question_code:code,option_code:option,expected_revision:a.revision,request_id:randomUUID(),...extra});
async function fill(user,score,wrongIndices=null){
  let state=await rpc(user,'state');
  for(const [i,q] of state.questions.entries()){
    const wrong=wrongIndices?wrongIndices.includes(i):i>=score;
    const letter=wrong?(letters[i]==='A'?'B':'A'):letters[i];
    await save(user,active(state),q.code,letter);state=await rpc(user,'state');
  }return active(state);
}
async function finish(user,a){return rpc(user,'finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:true});}
try {
  h=await createHarness(process.argv[2]);
  await test('Référentiel exact : douze scénarios, choix, lettres et corrigés validés',async()=>{
    const base=process.env.CHALLENGE_SOURCE_DIR;
    if(!base)throw Error('Fournir CHALLENGE_SOURCE_DIR : dossier des deux références pédagogiques validées.');
    const master=await readFile(`${base}/AI_ACT_CHALLENGE_CAHIER_FONCTIONNEL_V1.0_VALIDE.md`,'utf8');
    const corrections=await readFile(`${base}/AI_ACT_CHALLENGE_CORRIGES_INTEGRAUX_V1_VALIDES.md`,'utf8');
    const normalized=x=>x.replace(/\r\n/g,'\n');
    const rows=(await h.db.query('SELECT * FROM private.challenge_questions ORDER BY position')).rows;
    assert.equal(rows.length,12);
    for(const [i,q] of rows.entries()){
      const line=master.split(/\r?\n/).find(l=>l.startsWith(`| ${i+1} |`));assert.ok(line);
      const columns=line.split('|').slice(1,-1).map(x=>x.trim());
      assert.equal(q.scenario,columns[1]);assert.equal(q.correct_option,letters[i]);
      const choices=columns[2].split(' / ').map(x=>({code:x.slice(0,1),text:x.slice(2)}));
      assert.deepEqual(q.options,choices);
      const section=corrections.split(new RegExp(`## Question ${i+1} - `))[1].split(/\n## Question |\n## Tableau récapitulatif/)[0];
      const extract=(from,to)=>section.split(from)[1].split(to)[0].trim();
      assert.equal(normalized(q.explanation),normalized(extract('### Explication pédagogique','### Exemple professionnel')));
      const example=extract('### Exemple professionnel','**Référence');assert.equal(normalized(q.example),normalized(example));
      assert.equal(normalized(q.remediation),normalized(extract('### Conseil de remédiation','**À retenir :**')));
      const takeaway=section.split('**À retenir :**')[1].split(/\n---/)[0].trim();assert.equal(normalized(q.takeaway),normalized(takeaway));
      const legal=section.slice(section.indexOf('**Référence')).split('### Conseil de remédiation')[0].trim();
      assert.equal(normalized(q.legal_reference),normalized(legal));
    }
  });
  await test('ACL et RLS réelles : aucune lecture ou écriture directe, même administrateur',async()=>{
    const tables=['versions','questions','paths','attempts','answers','start_requests','save_requests','trainer_grants'];
    for(const name of tables){
      const table=`private.challenge_${name}`;
      const security=(await h.db.query('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass',[table])).rows[0];
      assert.deepEqual(security,{relrowsecurity:true,relforcerowsecurity:true});
      for(const user of ['learner','trainer','admin','employee']) await assert.rejects(h.as(user,`SELECT * FROM ${table}`),/permission denied/);
      const acl=(await h.db.query("SELECT has_table_privilege('authenticated',$1,'UPDATE') AS update,has_table_privilege('authenticated',$1,'DELETE') AS delete,has_table_privilege('anon',$1,'SELECT') AS anon",[table])).rows[0];
      assert.deepEqual(acl,{update:false,delete:false,anon:false});
      // Grant temporaire dans la seule base éphémère, pour vérifier aussi le filtrage RLS.
      await h.db.exec(`GRANT SELECT ON ${table} TO authenticated`);
      assert.equal((await h.as('admin',`SELECT * FROM ${table}`)).rows.length,0);
      await h.db.exec(`REVOKE SELECT ON ${table} FROM authenticated`);
    }
  });
  await test('Accès refusé sans droit et rôle anon',async()=>{
    await denied('outsider','start',{},'ACCESS_DENIED');
    await assert.rejects(h.as(null,'SELECT public.ai_act_challenge($1,$2::jsonb)',['state','{}'],'anon'),/permission denied|AUTH|ACCESS_DENIED/i);
  });
  await test('Une seule tentative ouverte, reprise et absence de corrigé',async()=>{
    const first=await rpc('learner','start');const a=active(first);
    assert.equal(a.number,1);assert.equal(first.questions.length,12);assert.equal(a.answered_count,0);
    const second=await rpc('learner','start');assert.equal(active(second).id,a.id);
    assert.ok(!/correct_option|explanation|remediation/.test(JSON.stringify(first)));
    assert.equal(a.score,null);
  });
  await test('12 réponses confirmées et confirmation humaine obligatoires',async()=>{
    const a=active(await rpc('learner','state'));
    await denied('learner','finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:true},'INCOMPLETE_ATTEMPT');
    await denied('learner','finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:false},'CONFIRMATION_REQUIRED');
  });
  await test('Sauvegarde, reprise et protections des révisions/idempotence',async()=>{
    let state=await rpc('learner','state');const a=active(state);const request_id=randomUUID();
    const payload={attempt_id:a.id,question_code:'Q01',option_code:'B',expected_revision:a.revision,request_id};
    const ack=await rpc('learner','save',payload);const replay=await rpc('learner','save',payload);
    assert.deepEqual(replay,ack);
    await denied('learner','save',{...payload,option_code:'A'},'IDEMPOTENCY|INVALID_INPUT');
    await denied('learner','save',{...payload,question_code:'Q02',request_id:randomUUID()},'REVISION_CONFLICT');
    state=await rpc('learner','state');assert.equal(active(state).answers.Q01,'B');assert.equal(active(state).answered_count,1);
    assert.ok(!/correct_option|explanation|remediation/.test(JSON.stringify(state)));
  });
  await test('8/12 est non réussi et clôture répétée immuable',async()=>{
    const a=await fill('learner',8);await finish('learner',a);
    const state=await rpc('learner','state');assert.equal(state.attempts[0].score,8);assert.equal(state.attempts[0].status,'failed');
    await finish('learner',a);assert.deepEqual(await rpc('learner','state'),state);
    await denied('learner','save',{attempt_id:a.id,question_code:'Q01',option_code:'A',expected_revision:a.revision,request_id:randomUUID()},'ATTEMPT_CLOSED');
  });
  await test('Seconde vierge et 9/12 réussi, meilleur/dernier',async()=>{
    const state=await rpc('learner','start');assert.equal(active(state).number,2);assert.deepEqual(active(state).answers,{});
    const a=await fill('learner',9);await finish('learner',a);const result=await rpc('learner','state');
    assert.equal(result.status,'passed');assert.equal(result.best_score,9);assert.equal(result.last_score,9);
    await denied('learner','start',{},'ATTEMPT_LIMIT');
  });
  await test('Seconde autorisée après succès, statut acquis, dernier inférieur',async()=>{
    await rpc('learner2','start');await finish('learner2',await fill('learner2',12));
    const second=await rpc('learner2','start');assert.equal(second.status,'passed');assert.equal(active(second).answered_count,0);
    await finish('learner2',await fill('learner2',8));const result=await rpc('learner2','state');
    assert.equal(result.best_score,12);assert.equal(result.last_score,8);assert.equal(result.status,'passed');
    await denied('learner2','start',{},'ATTEMPT_LIMIT');
  });
  await test('Isolation apprenants et états accès refusés sans effacer les réponses',async()=>{
    const a=(await rpc('learner','state')).attempts[0];
    await denied('learner2','finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:true},'NOT_FOUND|ACCESS_DENIED');
    for(const status of ['suspended','revoked','refunded','expired']){
      await h.db.query('UPDATE course_access SET status=$1 WHERE user_id=$2',[status,h.fixtures.learner]);
      await denied('learner','state',{},'ACCESS_DENIED');
      await denied('learner','start',{},'ACCESS_DENIED');
      await denied('learner','finish',{attempt_id:a.id,expected_revision:a.revision,confirmed:true},'ACCESS_DENIED');
      await denied('learner','save',{attempt_id:a.id,question_code:'Q01',option_code:'A',expected_revision:a.revision,request_id:randomUUID()},'ACCESS_DENIED');
    }
    await h.db.query("UPDATE course_access SET status='active',expires_at=now()-interval '1 day' WHERE user_id=$1",[h.fixtures.learner]);
    await denied('learner','state',{},'ACCESS_DENIED');
    await h.db.query("UPDATE course_access SET expires_at=null WHERE user_id=$1",[h.fixtures.learner]);
    assert.equal((await rpc('learner','state')).attempts.length,2);
  });
  await test('Habilitations strictes : employee exclu, scope formation, retrait immédiat',async()=>{
    assert.deepEqual(await rpc('employee','permissions'),{course_id:h.course,can_train:false,is_admin:false});
    await denied('employee','grant',{user_id:h.fixtures.trainer,course_id:h.course,active:true},'ACCESS_DENIED');
    await denied('trainer','trainer_overview',{},'ACCESS_DENIED');
    await rpc('admin','grant',{user_id:h.fixtures.trainer,course_id:h.course,active:true});
    assert.equal((await rpc('trainer','permissions')).can_train,true);
    assert.ok((await rpc('trainer','trainer_overview')).learners.length);
    await denied('trainer','trainer_overview',{course_id:'formation-excel'},'ACCESS_DENIED');
    await denied('trainer','grant',{user_id:h.fixtures.outsider,course_id:h.course,active:true},'ACCESS_DENIED');
    await denied('admin','grant',{user_id:h.fixtures.employee,course_id:h.course,active:true},'INVALID_INPUT');
    await denied('admin','edit_score',{user_id:h.fixtures.learner,score:12},'INVALID_INPUT');
    await rpc('admin','grant',{user_id:h.fixtures.trainer,course_id:h.course,active:false});
    await denied('trainer','trainer_overview',{},'ACCESS_DENIED');
    await denied('trainer','trainer_detail',{user_id:h.fixtures.learner},'ACCESS_DENIED');
  });
  await test('Statistiques personnes uniques, meilleur résultat et dénominateurs',async()=>{
    const data=await rpc('admin','trainer_overview');
    assert.equal(data.stats.population,3);assert.equal(data.stats.active,3);assert.equal(data.stats.started,2);assert.equal(data.stats.finished,2);
    assert.equal(data.stats.passed,2);assert.equal(data.stats.not_started,1);assert.equal(data.stats.average_best_score,10.5);
    assert.equal(data.stats.success_rate_population,66.67);assert.equal(data.stats.success_rate_finished,100);
    assert.equal(data.learners.length,3);assert.equal(new Set(data.learners.map(x=>x.display_name)).size,3);
    assert.equal(data.questions.length,12);assert.ok(data.questions.every(x=>x.total===2));
    assert.equal(data.questions.find(x=>x.code==='Q12').errors,1);
    const calendar=data.themes.find(x=>x.theme===data.questions.find(q=>q.code==='Q11').theme);
    assert.equal(calendar.sample_size,2);assert.equal(calendar.total,2);
    await h.db.query("UPDATE course_access SET status='revoked' WHERE user_id=$1",[h.fixtures.newcomer]);
    const activeOnly=await rpc('admin','trainer_overview',{active_only:true});assert.equal(activeOnly.stats.population,2);assert.equal(activeOnly.stats.success_rate_population,100);
    await h.db.query("UPDATE course_access SET status='active' WHERE user_id=$1",[h.fixtures.newcomer]);
  });
  await test('Meilleures notes égales : analyses prennent la plus récente',async()=>{
    await rpc('newcomer','start');await finish('newcomer',await fill('newcomer',11,[0]));
    await rpc('newcomer','start');await finish('newcomer',await fill('newcomer',11,[1]));
    const data=await rpc('admin','trainer_overview');
    assert.equal(data.stats.finished,3);assert.ok(data.questions.every(x=>x.total===3));
    assert.equal(data.questions.find(x=>x.code==='Q01').errors,0);assert.equal(data.questions.find(x=>x.code==='Q02').errors,1);
  });
  await test('Identités fiables et conflits, sans ouvrir les dossiers',async()=>{
    const insert=async(first,last)=>h.db.query("INSERT INTO training_enrollments VALUES($1,$2,$3,'validated',$4,$5,now())",[randomUUID(),h.fixtures.learner,h.course,first,last]);
    await insert('Alice','Recette');
    let view=await rpc('admin','trainer_overview');let learner=view.learners.find(x=>x.user_id===h.fixtures.learner);
    assert.equal(learner.display_name,'Alice Recette');assert.equal(learner.identity_status,'available');assert.ok(!('learner_first_name' in learner));
    await insert('Alicia','Recette');view=await rpc('admin','trainer_overview');learner=view.learners.find(x=>x.user_id===h.fixtures.learner);
    assert.equal(learner.identity_status,'conflict');assert.ok(learner.display_name.startsWith('Apprenant '));
  });
  await test('Immuabilité banque et résultats, refus des champs de score clients',async()=>{
    await assert.rejects(h.db.exec("UPDATE private.challenge_questions SET correct_option='A' WHERE code='Q01'"),/IMMUTABLE_VERSION/);
    const a=(await rpc('learner','state')).attempts[0];
    await assert.rejects(h.db.query('UPDATE private.challenge_attempts SET score=12 WHERE id=$1',[a.id]),/IMMUTABLE_ATTEMPT/);
    await assert.rejects(h.db.query("UPDATE private.challenge_answers SET option_code='A' WHERE attempt_id=$1 AND question_code='Q01'",[a.id]),/IMMUTABLE_ATTEMPT/);
    const newcomer='10000000-0000-4000-8000-000000000008';
    await h.db.query("INSERT INTO profiles VALUES($1,'user')",[newcomer]);await h.db.query("INSERT INTO course_access VALUES($1,$2,'active',null)",[newcomer,h.course]);
    await denied(newcomer,'start',{score:12,status:'passed',user_id:h.fixtures.admin},'INVALID_INPUT');
    const start=await rpc(newcomer,'start');
    assert.equal(start.status,'in_progress');assert.equal(active(start).score,null);
  });
  await test('Version nouvelle : parcours figé, seconde identique, nouveau joueur version B, quota conservé',async()=>{
    const userA='10000000-0000-4000-8000-000000000008';const userB='10000000-0000-4000-8000-000000000009';
    const before=await rpc(userA,'state');assert.equal(before.version,'v1.0');
    await h.db.exec("UPDATE private.challenge_versions SET active=false; INSERT INTO private.challenge_versions(id,active) VALUES('qa-v2',true); INSERT INTO private.challenge_questions SELECT 'qa-v2',code,position,theme,scenario,options,correct_option,explanation,example,legal_reference,remediation,takeaway FROM private.challenge_questions WHERE version_id='v1.0';");
    assert.equal((await rpc(userA,'start')).version,'v1.0');
    await finish(userA,await fill(userA,12));const second=await rpc(userA,'start');
    assert.equal(second.version,'v1.0');assert.equal(active(second).answered_count,0);assert.deepEqual(second.questions,before.questions);
    await finish(userA,await fill(userA,9));await denied(userA,'start',{},'ATTEMPT_LIMIT');
    await h.db.query("INSERT INTO profiles VALUES($1,'user')",[userB]);await h.db.query("INSERT INTO course_access VALUES($1,$2,'active',null)",[userB,h.course]);
    assert.equal((await rpc(userB,'start')).version,'qa-v2');
    assert.equal((await rpc('learner','state')).version,'v1.0');
    await denied('learner','start',{},'ATTEMPT_LIMIT');
  });
  await test('Ancien acquittement reste identifiable et ne remplace pas une réponse plus récente',async()=>{
    const user='10000000-0000-4000-8000-000000000009';const a=active(await rpc(user,'state'));
    const payload={attempt_id:a.id,question_code:'Q01',option_code:'B',expected_revision:a.revision,request_id:randomUUID()};
    const first=await rpc(user,'save',payload);assert.equal(first.acknowledgement.revision,a.revision+1);
    await save(user,active(first),'Q01','A');const replay=await rpc(user,'save',payload);
    assert.equal(replay.acknowledgement.revision,a.revision+1);assert.equal(replay.acknowledgement.current_revision,a.revision+2);
    assert.equal(active(replay).answers.Q01,'A');
  });
  await test('Lancement idempotent après clôture ne consomme pas la seconde',async()=>{
    const user='10000000-0000-4000-8000-000000000010';await h.db.query("INSERT INTO profiles VALUES($1,'user')",[user]);await h.db.query("INSERT INTO course_access VALUES($1,$2,'active',null)",[user,h.course]);
    const request_id=randomUUID();await rpc(user,'start',{request_id});await finish(user,await fill(user,12));
    const replay=await rpc(user,'start',{request_id});assert.equal(replay.attempts.length,1);assert.equal(replay.can_start,true);assert.ok(!active(replay));
    await assert.rejects(h.rpc(user,'start',{}),/INVALID_INPUT/);
    await denied(user,'state',{course_id:null},'ACCESS_DENIED');
  });
  await test('Déplacements OLD/NEW bloqués et options exactement A B C',async()=>{
    await h.db.exec("INSERT INTO private.challenge_versions(id,active) VALUES('qa-unused',false)");
    await assert.rejects(h.db.exec("UPDATE private.challenge_questions SET version_id='qa-unused' WHERE version_id='v1.0' AND code='Q01'"),/IMMUTABLE_VERSION/);
    const closed=(await rpc('learner','state')).attempts[0];const open=active(await rpc('10000000-0000-4000-8000-000000000009','state'));
    await assert.rejects(h.db.query("UPDATE private.challenge_answers SET attempt_id=$1,question_code='Q02' WHERE attempt_id=$2 AND question_code='Q01'",[open.id,closed.id]),/IMMUTABLE_ATTEMPT|IMMUTABLE_ANSWER_KEY/);
    await h.db.exec("INSERT INTO private.challenge_questions SELECT 'qa-unused',code,position,theme,scenario,options,correct_option,explanation,example,legal_reference,remediation,takeaway FROM private.challenge_questions WHERE version_id='v1.0' AND code='Q01'");
    for(const options of [[{code:'A',text:'Unique'}],[{code:'A',text:'A'},{code:'B',text:'B'},{code:'B',text:'Duplicate'}],[{code:'A',text:'A'},{code:'B',text:'B'},{code:'C',text:''}]]){
      await assert.rejects(h.db.query("UPDATE private.challenge_questions SET options=$1::jsonb WHERE version_id='qa-unused'",[JSON.stringify(options)]),/INVALID_OPTIONS/);
    }
  });
  await test('Conservation : seules les activités effectives prolongent la date, contrat ACK inchangé',async()=>{
    const user='10000000-0000-4000-8000-000000000101';
    await h.db.query("INSERT INTO profiles VALUES($1,'user')",[user]);await h.db.query("INSERT INTO course_access VALUES($1,$2,'active',null)",[user,h.course]);
    const request_id=randomUUID();let state=await rpc(user,'start',{request_id});
    const old='2020-01-01T00:00:00.000Z';
    const age=()=>h.db.query('UPDATE private.challenge_paths SET last_activity_at=$1 WHERE user_id=$2',[old,user]);
    const date=async()=>String((await h.db.query('SELECT last_activity_at FROM private.challenge_paths WHERE user_id=$1',[user])).rows[0].last_activity_at);
    await age();const baseline=await date();
    await rpc(user,'state');await rpc(user,'start',{request_id});await rpc(user,'start');assert.equal(await date(),baseline);
    state=await save(user,active(state),'Q01','B');assert.notEqual(await date(),baseline);
    await age();const prior=active(state);const repeatedId=randomUUID();
    state=await save(user,prior,'Q01','B',{request_id:repeatedId});
    assert.equal(await date(),baseline);assert.equal(active(state).revision,prior.revision+1);assert.equal(state.acknowledgement.revision,prior.revision+1);
    await rpc(user,'save',{attempt_id:prior.id,question_code:'Q01',option_code:'B',expected_revision:prior.revision,request_id:repeatedId});assert.equal(await date(),baseline);
    state=await save(user,active(state),'Q01','A');assert.notEqual(await date(),baseline);
    await h.db.exec('BEGIN');
    try {
      await new Promise(resolve=>setTimeout(resolve,30));
      await h.db.query('UPDATE private.challenge_paths SET last_activity_at=clock_timestamp() WHERE user_id=$1',[user]);
      const newer=await date();state=await save(user,active(state),'Q01','B');
      assert.ok(new Date(await date())>=new Date(newer),'Une transaction ancienne ne doit jamais faire reculer la dernière activité');
      await h.db.exec('COMMIT');
    }catch(error){await h.db.exec('ROLLBACK');throw error;}
    const full=await fill(user,12);await age();await finish(user,full);assert.notEqual(await date(),baseline);
    await age();await finish(user,full);assert.equal(await date(),baseline);
    await rpc(user,'start');assert.notEqual(await date(),baseline);
  });
  await mkdir(qa,{recursive:true});await writeFile(`${qa}/sql-results.json`,JSON.stringify({passed:true,engine:'PGlite PostgreSQL WASM',nativeMultiConnectionConcurrency:false,migrationHashes:h.migrationHashes,checks},null,2));
  console.log(`PASS ${checks.length} groupes SQL réels`);
}catch(error){await mkdir(qa,{recursive:true});await writeFile(`${qa}/sql-results.json`,JSON.stringify({passed:false,checks,error:error.message,stack:error.stack},null,2));console.error(`FAIL SQL : ${error.message}`);process.exitCode=1;}
finally{await h?.close();}
