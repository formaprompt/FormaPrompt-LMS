import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {fixtures,course} from './test-ai-act-challenge-harness.mjs';
const quote=x=>x===null||x===undefined?'NULL':typeof x==='number'?String(x):typeof x==='boolean'?String(x):`'${String(x).replaceAll("'","''")}'`;
export class NativePrivacyConnection{
  constructor(){
    if(process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='55439'||!/^challenge_reserves_test_[a-z0-9]+$/.test(process.env.PGDATABASE??''))throw Error('LOCAL_PRIVACY_FIXTURE_REQUIRED');
    if(!process.env.CHALLENGE_PSQL_PATH)throw Error('CHALLENGE_PSQL_PATH_REQUIRED');
    this.child=spawn(process.env.CHALLENGE_PSQL_PATH,['-X','-q','-A','-t','-v','ON_ERROR_STOP=off'],{windowsHide:true,env:{...process.env,PGCLIENTENCODING:'UTF8',PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=12000 -c lc_messages=C'}});
    this.buffer='';this.errors='';this.queue=Promise.resolve();
    this.child.stdout.on('data',s=>{this.buffer+=s.toString();this.check?.();});
    this.child.stderr.on('data',s=>{this.errors+=s.toString();});
    this.child.on('error',error=>{this.failure=error;this.abort?.(error);});
    this.child.on('exit',code=>{this.failure=Error(`PSQL_EXIT_${code}`);this.abort?.(this.failure);});
  }
  exec(sql){const result=this.queue.then(()=>this.execute(sql));this.queue=result.catch(()=>{});return result;}
  execute(sql){return new Promise((resolveQuery,reject)=>{
    if(this.failure){reject(this.failure);return;}
    const marker=`END_${randomUUID().replaceAll('-','')}`;this.buffer='';this.errors='';
    const timer=setTimeout(()=>{this.check=null;reject(Error('PSQL_TIMEOUT'));},20000);
    this.abort=error=>{clearTimeout(timer);this.check=null;reject(error);};
    this.check=()=>{const end=this.buffer.indexOf(marker);if(end<0)return;clearTimeout(timer);this.check=null;
      if(/ERROR:|FATAL:/i.test(this.errors))reject(Error(this.errors.trim()));else resolveQuery(this.buffer.slice(0,end).trim());};
    this.child.stdin.write(`${sql.trimEnd().endsWith(';')?sql:`${sql};`}\n\\echo ${marker}\n`);
  });}
  async query(sql,params=[]){
    const rendered=sql.replace(/\$(\d+)/g,(_,index)=>quote(params[Number(index)-1])).replace(/;\s*$/,'');
    if(/^\s*(SELECT|WITH)\b/i.test(rendered))return {rows:JSON.parse(await this.exec(`SELECT coalesce(json_agg(t),'[]') FROM (${rendered}) t;`))};
    await this.exec(`${rendered};`);return {rows:[]};
  }
  async close(){if(this.child.exitCode!==null||this.failure)return;this.child.stdin.end('ROLLBACK;\n\\q\n');await new Promise(r=>this.child.once('exit',r));}
}
export async function createPrivacyHarness(){
  const native=process.env.CHALLENGE_PRIVACY_ENGINE==='native';let db;
  if(native){db=new NativePrivacyConnection();
    const preflight=(await db.query("SELECT version() AS engine,current_database() AS database,host(inet_server_addr()) AS address,inet_server_port() AS port,(SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('public','private','auth')) AS tables")).rows[0];
    if(preflight.address!=='127.0.0.1'||preflight.port!==55439||Number(preflight.tables)!==0){await db.close();throw Error('NATIVE_DATABASE_MUST_BE_DEDICATED_AND_EMPTY');}
  }else{if(!process.env.PGLITE_RUNTIME_PATH)throw Error('PGLITE_RUNTIME_PATH_REQUIRED');const {PGlite}=await import(pathToFileURL(resolve(process.env.PGLITE_RUNTIME_PATH)).href);db=new PGlite();}
  await db.exec(`DO $$ BEGIN
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    CREATE SCHEMA auth;CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,role text NOT NULL);
    CREATE TABLE course_access(user_id uuid REFERENCES profiles(id),course_id text,status text,expires_at timestamptz,PRIMARY KEY(user_id,course_id));
    CREATE TABLE training_enrollments(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),course_id text,status text,learner_first_name text,learner_last_name text,enrolled_at timestamptz,completed_at timestamptz,ends_at timestamptz,updated_at timestamptz);
    CREATE TABLE purchases(id uuid PRIMARY KEY,user_id uuid,amount integer);
    CREATE TABLE privacy_requests(id uuid PRIMARY KEY,subject_user_id uuid,request_type text,identity_verification_status text,administrative_decision text,status text);
    CREATE TABLE privacy_dependency_assessments(id uuid PRIMARY KEY,request_id uuid,category text,analysis_run_id uuid,assessed_at timestamptz);
    CREATE TABLE privacy_processing_actions(id uuid PRIMARY KEY,request_id uuid,assessment_id uuid,resolution text,status text);
    CREATE FUNCTION private.is_strict_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT FROM profiles WHERE id=auth.uid() AND role='admin') $$;
    CREATE FUNCTION public.admin_analyze_privacy_request(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    CREATE FUNCTION public.admin_execute_privacy_request(uuid,text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"historical_step":true}'::jsonb $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
  for(const [name,id] of Object.entries(fixtures)){
    await db.query('INSERT INTO profiles VALUES($1,$2)',[id,name==='admin'?'admin':name==='employee'?'employee':'user']);
    await db.query("INSERT INTO course_access VALUES($1,$2,'active',null)",[id,course]);
    await db.query('INSERT INTO purchases VALUES($1,$2,100)',[randomUUID(),id]);
  }
  const selected=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>/ai_act_challenge/.test(x)).sort();const migrationHashes={};
  for(const name of selected){const source=await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');migrationHashes[name]=createHash('sha256').update(source).digest('hex');await db.exec(source);}
  let queue=Promise.resolve();
  const as=(user,sql,params=[],role='authenticated')=>{const run=queue.then(async()=>{await db.exec(`SET ROLE ${role}`);try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[fixtures[user]??user??'']);return await db.query(sql,params);}finally{await db.exec('RESET ROLE');}});queue=run.catch(()=>{});return run;};
  const rpc=async(user,action,payload={})=>(await as(user,'SELECT ai_act_challenge($1,$2::jsonb) AS data',[action,JSON.stringify(payload)])).rows[0].data;
  const privacy=async(user,action,payload={})=>(await as(user,'SELECT admin_challenge_privacy($1,$2::jsonb) AS data',[action,JSON.stringify(payload)])).rows[0].data;
  const training=async(user,action,payload={})=>(await as(user,'SELECT challenge_training_status($1,$2::jsonb) AS data',[action,JSON.stringify(payload)])).rows[0].data;
  const trainingAdmin=async(user,action,payload={})=>(await as(user,'SELECT admin_challenge_training($1,$2::jsonb) AS data',[action,JSON.stringify(payload)])).rows[0].data;
  return {db,as,rpc,privacy,training,trainingAdmin,fixtures,course,native,migrationHashes,close:()=>db.close()};
}
