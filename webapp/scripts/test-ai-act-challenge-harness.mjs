// Recette entièrement locale : SQL de la migration réelle, PostgreSQL WASM PGlite.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const fixtures = Object.fromEntries(['learner','learner2','trainer','admin','employee','outsider','newcomer'].map((name,index)=>[name, `10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`]));
export const course = 'formation-ia-act';
export const defaultRuntime = process.env.PGLITE_RUNTIME_PATH;
export const defaultQaDirectory = new URL('../test-results/ai-act-challenge/',import.meta.url);
export async function createHarness(runtime=defaultRuntime) {
  let runtimeModule;
  try {runtimeModule=runtime?await import(pathToFileURL(resolve(runtime)).href):await import('@electric-sql/pglite');}
  catch {throw new Error('Runtime PGlite absent : fournir PGLITE_RUNTIME_PATH ou le chemin du module en premier argument, ou utiliser le paquet déjà installé localement.');}
  const {PGlite}=runtimeModule;
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text NOT NULL);
    CREATE TABLE public.course_access(user_id uuid,course_id text,status text,expires_at timestamptz,PRIMARY KEY(user_id,course_id));
    CREATE TABLE public.training_enrollments(id uuid PRIMARY KEY,user_id uuid,course_id text,status text,learner_first_name text,learner_last_name text,enrolled_at timestamptz);
    CREATE FUNCTION private.is_strict_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin') $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
  `);
  for (const [name,id] of Object.entries(fixtures)) {
    await db.query('INSERT INTO profiles VALUES($1,$2)',[id,name==='admin'?'admin':name==='employee'?'employee':'user']);
    if (['learner','learner2','newcomer'].includes(name)) await db.query('INSERT INTO course_access VALUES($1,$2,$3,null)',[id,course,'active']);
  }
  const migrations = await readdir(new URL('../supabase/migrations/',import.meta.url));
  const selected = migrations.filter(name=>/ai_act_challenge/.test(name)).sort();
  if(!selected.length) throw new Error('Migration AI Act Challenge absente');
  const migrationHashes={};
  for (const name of selected) {
    const source=await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
    migrationHashes[name]=createHash('sha256').update(source).digest('hex');
    await db.exec(source);
  }
  // Une seule connexion PGlite : sérialisation obligatoire de l'identité effective.
  // Cela teste transactions et RLS, pas les courses entre connexions serveur natives.
  let queue=Promise.resolve();
  const run = (fn) => { const current=queue.then(fn); queue=current.catch(()=>{}); return current; };
  const as = (user,sql,params=[],role='authenticated') => run(async()=> {
    await db.exec(`SET ROLE ${role};`);
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[fixtures[user]??user??'']);
      return await db.query(sql,params);
    } finally {await db.exec('RESET ROLE');}
  });
  const rpc = async (user,action,payload={}) => (await as(user,'SELECT public.ai_act_challenge($1,$2::jsonb) AS data',[action,JSON.stringify(payload)])).rows[0].data;
  return {db,as,rpc,fixtures,course,migrations:selected,migrationHashes,close:()=>db.close()};
}
