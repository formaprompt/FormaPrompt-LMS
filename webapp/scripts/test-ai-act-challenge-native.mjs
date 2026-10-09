// PostgreSQL natif, connexions psql indépendantes. Base dédiée vierge uniquement.
// Requiert un cluster local préalablement autorisé ; ne crée ni cluster ni base.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fixtures,course} from './test-ai-act-challenge-harness.mjs';
const host=process.env.PGHOST,port=process.env.PGPORT,database=process.env.PGDATABASE;
if(host!=='127.0.0.1'||port!=='55439'||!/^challenge_final_native_test(?:_[a-z0-9]+)?$/.test(database??'')) throw Error('LOCAL_DEDICATED_DATABASE_REQUIRED: 127.0.0.1:55439/challenge_final_native_test');
const exe=process.env.CHALLENGE_PSQL_PATH;
if(!exe)throw Error('CHALLENGE_PSQL_PATH_REQUIRED');
const qa=process.env.CHALLENGE_QA_DIR;
if(!qa)throw Error('CHALLENGE_QA_DIR_REQUIRED');
const quote=x=>`'${String(x).replaceAll("'","''")}'`;
class Connection{
  constructor(){
    this.child=spawn(exe,['-X','-q','-A','-t','-v','ON_ERROR_STOP=off'],{env:{...process.env,PGCLIENTENCODING:'UTF8',PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=12000 -c lc_messages=C'},windowsHide:true});
    this.buffer='';this.errors='';this.queue=Promise.resolve();
    this.child.stdout.on('data',chunk=>{this.buffer+=chunk.toString();this.check?.();});
    this.child.stderr.on('data',chunk=>{this.errors+=chunk.toString();});
    this.child.on('error',error=>{this.failure=error;this.abort?.(error);});
    this.child.on('exit',code=>{this.failure=Error(`PSQL_EXIT_${code}: ${this.errors.trim()}`);this.abort?.(this.failure);});
  }
  query(sql){const result=this.queue.then(()=>this.execute(sql));this.queue=result.catch(()=>{});return result;}
  execute(sql){
    const marker=`END_${randomUUID().replaceAll('-','')}`;this.buffer='';this.errors='';
    return new Promise((resolveQuery,reject)=>{
      if(this.failure){reject(this.failure);return;}
      const timer=setTimeout(()=>{this.check=null;reject(Error('PSQL_QUERY_TIMEOUT'));},20000);
      this.abort=error=>{clearTimeout(timer);this.check=null;reject(error);};
      this.check=()=>{const end=this.buffer.indexOf(marker);if(end<0)return;clearTimeout(timer);this.check=null;
        const output=this.buffer.slice(0,end).trim();
        if(/ERROR:|FATAL:/i.test(this.errors))reject(Error(this.errors.trim()));else resolveQuery(output);
      };
      this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }
  async close(){if(this.child.exitCode!==null||this.failure)return;this.child.stdin.end('ROLLBACK;\n\\q\n');await new Promise(r=>this.child.once('exit',r));}
}
const connections=[];const connect=()=>{const c=new Connection();connections.push(c);return c;};
const admin=connect(),a=connect(),b=connect(),gate=connect();const checks=[];const waits=[];
const active=s=>s.attempts.find(t=>t.status==='in_progress');
const rpc=async(c,user,action,payload={})=>{
  const result=await c.query(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${quote(fixtures[user])},false); SELECT public.ai_act_challenge(${quote(action)},${quote(JSON.stringify(payload))}::jsonb); RESET ROLE;`);
  return JSON.parse(result.split(/\r?\n/).at(-1));
};
const start=(c,user)=>rpc(c,user,'start',{request_id:randomUUID()});
const payload=(attempt,question='Q01',option='B')=>({attempt_id:attempt.id,expected_revision:attempt.revision,question_code:question,option_code:option,request_id:randomUUID()});
async function waitBlocked(pids){
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    const rows=JSON.parse(await admin.query(`SELECT coalesce(json_agg(json_build_object('pid',pid,'event',wait_event,'blockers',pg_blocking_pids(pid))),'[]') FROM pg_stat_activity WHERE pid IN (${pids.join(',')}) AND wait_event_type='Lock';`));
    if(rows.length===pids.length){waits.push(rows);return;}
    await new Promise(r=>setTimeout(r,30));
  }throw Error('EXPECTED_NATIVE_LOCK_WAIT_NOT_OBSERVED');
}
async function race(user,operation1,operation2){
  await gate.query(`BEGIN; SELECT id FROM profiles WHERE id=${quote(fixtures[user])} FOR UPDATE;`);
  const pending1=operation1().then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
  const pending2=operation2().then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
  try{await waitBlocked([pidA,pidB]);}finally{await gate.query('COMMIT;');}
  return Promise.all([pending1,pending2]);
}
async function filled(user){let state=await start(a,user);for(const q of state.questions)state=await rpc(a,user,'save',payload(active(state),q.code,'A'));return active(state);}
const finishPayload=t=>({attempt_id:t.id,expected_revision:t.revision,confirmed:true});
let pidA,pidB;
try{
  const preflight=JSON.parse(await admin.query("SELECT json_build_object('engine',version(),'database',current_database(),'address',inet_server_addr(),'port',inet_server_port(),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('public','private','auth')));"));
  assert.equal(preflight.database,database);assert.equal(preflight.address,'127.0.0.1');assert.equal(preflight.port,55439);assert.match(preflight.engine,/PostgreSQL/);
  assert.equal(preflight.tables,0,'Base vierge obligatoire, aucune modification d’une base existante');
  await admin.query(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL);
    CREATE TABLE public.course_access(user_id uuid,course_id text,status text,expires_at timestamptz,PRIMARY KEY(user_id,course_id));
    CREATE TABLE public.training_enrollments(id uuid PRIMARY KEY,user_id uuid,course_id text,status text,learner_first_name text,learner_last_name text,enrolled_at timestamptz);
    CREATE FUNCTION private.is_strict_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT FROM profiles WHERE id=auth.uid() AND role='admin') $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
  for(const [user,id] of Object.entries(fixtures))await admin.query(`INSERT INTO profiles VALUES(${quote(id)},${quote(user==='admin'?'admin':'user')}); INSERT INTO course_access VALUES(${quote(id)},${quote(course)},'active',null);`);
  const migration=await readFile(new URL('../supabase/migrations/20261008180934_ai_act_challenge.sql',import.meta.url),'utf8');
  await admin.query(migration);
  pidA=Number(await a.query('SELECT pg_backend_pid();'));pidB=Number(await b.query('SELECT pg_backend_pid();'));assert.notEqual(pidA,pidB);
  const test=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
  await test('start/start: une seule tentative',async()=>{
    const results=await race('learner',()=>start(a,'learner'),()=>start(b,'learner'));
    assert.ok(results.every(x=>x.ok));assert.equal(active(results[0].value).id,active(results[1].value).id);
  });
  await test('save/save: une seule révision acceptée',async()=>{
    const t=active(await rpc(a,'learner','state'));
    const results=await race('learner',()=>rpc(a,'learner','save',payload(t)),()=>rpc(b,'learner','save',payload(t,'Q02','A')));
    assert.equal(results.filter(x=>x.ok).length,1);assert.match(results.find(x=>!x.ok).error,/REVISION_CONFLICT/);
    assert.equal(active(await rpc(a,'learner','state')).revision,1);
  });
  await test('reprise deux appareils: conflit explicite, puis reprise commune',async()=>{
    const [s1,s2]=await Promise.all([rpc(a,'learner','state'),rpc(b,'learner','state')]);assert.deepEqual(s1,s2);
    await a.query('BEGIN;');await rpc(a,'learner','save',payload(active(s1),'Q03','C'));
    const pending=rpc(b,'learner','save',payload(active(s2),'Q04','A')).then(()=>null,error=>error);
    try{await waitBlocked([pidB]);}finally{await a.query('COMMIT;');}
    assert.match((await pending).message,/REVISION_CONFLICT/);
    assert.deepEqual(await rpc(a,'learner','state'),await rpc(b,'learner','state'));
  });
  await test('finish/finish: clôture idempotente',async()=>{
    const t=await filled('learner2');const p=finishPayload(t);
    const results=await race('learner2',()=>rpc(a,'learner2','finish',p),()=>rpc(b,'learner2','finish',p));
    assert.ok(results.every(x=>x.ok));assert.deepEqual(results[0].value,results[1].value);assert.equal(results[0].value.attempts[0].revision,t.revision+1);
  });
  await test('save après finish: aucune réponse modifiée',async()=>{
    const t=await filled('employee');await a.query('BEGIN;');
    const before=await rpc(a,'employee','finish',finishPayload(t));
    const pending=rpc(b,'employee','save',payload(t)).then(()=>null,error=>error);
    try{await waitBlocked([pidB]);}finally{await a.query('COMMIT;');}
    assert.match((await pending).message,/ATTEMPT_CLOSED/);
    assert.deepEqual(await rpc(a,'employee','state'),before);
  });
  await test('troisième passage concurrent: quota deux conservé',async()=>{
    await rpc(a,'learner2','finish',finishPayload(await filled('learner2')));
    const results=await race('learner2',()=>start(a,'learner2'),()=>start(b,'learner2'));
    assert.ok(results.every(x=>!x.ok&&/ATTEMPT_LIMIT/.test(x.error)));
    assert.equal((await rpc(a,'learner2','state')).attempts.length,2);
  });
  await test('retrait accès pendant session: attente réelle puis refus',async()=>{
    await start(a,'newcomer');
    await gate.query(`BEGIN; UPDATE course_access SET status='revoked' WHERE user_id=${quote(fixtures.newcomer)};`);
    const pending=rpc(b,'newcomer','state').then(()=>null,error=>error);
    try{await waitBlocked([pidB]);}finally{await gate.query('COMMIT;');}
    assert.match((await pending).message,/ACCESS_DENIED/);
    assert.equal(Number(await admin.query(`SELECT count(*) FROM private.challenge_paths WHERE user_id=${quote(fixtures.newcomer)};`)),1);
  });
  await test('replay incident: accusé perdu rejoué sans double sauvegarde',async()=>{
    const t=active(await start(a,'outsider'));const p=payload(t);
    const results=await race('outsider',()=>rpc(a,'outsider','save',p),()=>rpc(b,'outsider','save',p));
    assert.ok(results.every(x=>x.ok));assert.deepEqual(results[0].value,results[1].value);
    assert.equal(active(await rpc(a,'outsider','save',p)).revision,1);
    await assert.rejects(rpc(b,'outsider','save',{...p,option_code:'A'}),/INVALID_INPUT/);
  });
  await test('horodatage monotone: transaction ancienne après activité récente',async()=>{
    await start(a,'trainer');await a.query('BEGIN; SELECT now();');
    await new Promise(r=>setTimeout(r,30));
    const t=active(await rpc(b,'trainer','state'));await rpc(b,'trainer','save',payload(t));
    const before=await admin.query(`SELECT last_activity_at::text FROM private.challenge_paths WHERE user_id=${quote(fixtures.trainer)};`);
    const latest=active(await rpc(a,'trainer','state'));await rpc(a,'trainer','save',payload(latest,'Q02','A'));await a.query('COMMIT;');
    const after=await admin.query(`SELECT last_activity_at::text FROM private.challenge_paths WHERE user_id=${quote(fixtures.trainer)};`);
    assert.ok(new Date(after)>=new Date(before),'Date ne doit pas reculer après transaction ancienne');
  });
  await mkdir(qa,{recursive:true});await writeFile(resolve(qa,'native-results.json'),JSON.stringify({status:'PASS',engine:'PostgreSQL native',preflight,fixtureAuth:true,realSupabaseJwt:false,migrationHash:createHash('sha256').update(migration).digest('hex'),connections:{pidA,pidB},checks,lockWaits:waits},null,2));
}catch(error){
  await mkdir(qa,{recursive:true});await writeFile(resolve(qa,'native-results.json'),JSON.stringify({status:'FAIL',engine:'PostgreSQL native',realSupabaseJwt:false,checks,lockWaits:waits,error:error.message},null,2));
  throw error;
}finally{await Promise.all(connections.map(c=>c.close()));}
