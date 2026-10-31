// Native PostgreSQL acceptance, fictitious data only, fixed local endpoint.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const executable=process.env.MAIL_QA_PSQL;
if(!executable)throw Error('MAIL_QA_PSQL required');
const expectedRoot=resolve('../output/mail-qa-postgres/data').replaceAll('\\','/');
const database=`mail_notifications_test_${process.pid}_${Date.now()}`;
const quote=(value)=>`'${String(value).replaceAll("'","''")}'`;
function sql(statement,db=database){
  return new Promise((ok,fail)=>{
    const child=spawn(executable,['-X','-q','-A','-t','-h','127.0.0.1','-p','55471','-U','mail_test','-d',db,'-v','ON_ERROR_STOP=1'],{windowsHide:true,env:{...process.env,PGCONNECT_TIMEOUT:'4',PGCLIENTENCODING:'UTF8',PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=10000'}});
    let out='',err='';child.stdout.on('data',(chunk)=>out+=chunk);child.stderr.on('data',(chunk)=>err+=chunk);
    child.on('error',fail);child.on('exit',(code)=>code?fail(Error(err.trim())):ok(out.trim()));child.stdin.end(statement);
  });
}
const preflight=JSON.parse(await sql("SELECT json_build_object('address',inet_server_addr(),'port',inet_server_port(),'directory',current_setting('data_directory'));",'postgres'));
assert.equal(preflight.address,'127.0.0.1');assert.equal(preflight.port,55471);assert.equal(preflight.directory.replaceAll('\\','/').toLowerCase(),expectedRoot.toLowerCase());
await sql(`CREATE DATABASE ${database};`,'postgres');
await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;`,'postgres').catch(async(error)=>{if(!/already exists/.test(error.message))throw error;});
await sql(`
CREATE SCHEMA private;
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.commercial_quotes(id uuid PRIMARY KEY);
CREATE TABLE public.contact_requests(id uuid PRIMARY KEY,name text,email text,subject text,message text,status text DEFAULT 'new',created_at timestamptz DEFAULT now());
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_insert ON public.contact_requests FOR INSERT TO anon,authenticated WITH CHECK (true);
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT INSERT ON public.contact_requests TO anon,authenticated;
GRANT ALL ON public.contact_requests TO service_role;
CREATE TABLE public.stripe_webhook_events(event_id text PRIMARY KEY,event_type text,livemode boolean,stripe_created_at timestamptz);
CREATE TABLE public.stripe_payment_transactions(id uuid PRIMARY KEY,status text,last_event_id text REFERENCES public.stripe_webhook_events(event_id),stripe_payment_intent_id text,stripe_checkout_session_id text,amount_total integer,currency text,payment_type text,created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.stripe_webhook_events,public.stripe_payment_transactions TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;
`);
const commercialMigration=await readFile(new URL('../supabase/migrations/20260821144632_sprint_3_commercial_cycle.sql',import.meta.url),'utf8');
await sql(commercialMigration.slice(commercialMigration.indexOf('CREATE TABLE public.commercial_communications ('),commercialMigration.indexOf('CREATE INDEX commercial_communications_request_idx')));
await sql(`INSERT INTO public.contact_requests(id,name) VALUES('10000000-0000-4000-8000-000000000001','Demande historique fictive');`);
const migration=await readFile(new URL('../supabase/migrations/20261031110303_admin_email_notifications_and_client_replies.sql',import.meta.url),'utf8');
await sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;');
await sql(migration);
await sql(await readFile(new URL('../supabase/migrations/20261031110410_restrict_admin_email_notification_service_grants.sql',import.meta.url),'utf8'));
const checks=[];const test=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
const count=async(kind)=>Number(await sql(`SELECT count(*) FROM public.admin_email_notifications${kind?` WHERE kind=${quote(kind)}`:''};`));
const makeEvent=async(id,{live=true,old=false,type='checkout.session.completed'}={})=>sql(`INSERT INTO public.stripe_webhook_events VALUES(${quote(id)},${quote(type)},${live},now()${old?"-interval '2 days'":"+interval '1 second'"});`);
const payment=async(n,event,status='paid',extra='')=>sql(`SET ROLE service_role; INSERT INTO public.stripe_payment_transactions(id,status,last_event_id,stripe_payment_intent_id,stripe_checkout_session_id,amount_total,currency,payment_type) VALUES('20000000-0000-4000-8000-${String(n).padStart(12,'0')}',${quote(status)},${quote(event)},'pi_fictif_${n}','cs_fictif_${n}',49700,'eur','course'); ${extra}`);

await test('aucun rattrapage de demande historique au déploiement',async()=>assert.equal(await count(),0));
await test('une insertion anonyme queue une alerte protégée au destinataire fixe',async()=>{
  await sql("SET ROLE anon; INSERT INTO public.contact_requests(id,name,email,message) VALUES('10000000-0000-4000-8000-000000000002','Fictif','client@example.test','Contenu sensible fictif');");
  assert.equal(await count('contact_request'),1);
  const row=JSON.parse(await sql("SELECT row_to_json(n) FROM public.admin_email_notifications n;"));
  assert.equal(row.recipient_email,'formaprompt@gmail.com');assert.equal(row.status,'pending');
  assert.ok(!JSON.stringify(row).includes('client@example.test'));assert.ok(!JSON.stringify(row).includes('sensible'));
});
await test('anon et authenticated ne lisent ni ne modifient la file',async()=>{
  for(const role of ['anon','authenticated']){
    await assert.rejects(sql(`SET ROLE ${role}; SELECT * FROM public.admin_email_notifications;`),/permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; UPDATE public.admin_email_notifications SET status='sent';`),/permission denied/);
    await assert.rejects(sql(`SET ROLE ${role}; SELECT private.enqueue_contact_admin_email();`),/permission denied/);
  }
});
await test('le service seul accède à la file et la destination ne peut être changée',async()=>{
  assert.equal(Number(await sql('SET ROLE service_role; SELECT count(*) FROM public.admin_email_notifications;')),1);
  assert.equal(await sql("SELECT has_table_privilege('service_role','public.admin_email_notifications','DELETE') OR has_table_privilege('service_role','public.admin_email_notifications','TRUNCATE') OR has_table_privilege('service_role','public.admin_email_notifications','TRIGGER') OR has_table_privilege('service_role','public.admin_email_notifications','REFERENCES');"),'f');
  await assert.rejects(sql("SET ROLE service_role; UPDATE public.admin_email_notifications SET recipient_email='autre@example.test';"),/check constraint/);
});
await test('transaction contact et file sont atomiques',async()=>{
  await sql("BEGIN; INSERT INTO public.contact_requests(id) VALUES('10000000-0000-4000-8000-000000000003'); ROLLBACK;");assert.equal(await count('contact_request'),1);
});
await test('paiement test et paiement non confirmé ne notifient pas',async()=>{
  await makeEvent('evt_fictif_test',{live:false});await payment(1,'evt_fictif_test');
  await makeEvent('evt_fictif_processing');await payment(2,'evt_fictif_processing','processing');assert.equal(await count('payment_confirmed'),0);
});
await test('paiement live confirmé crée une seule alerte minimale',async()=>{
  await makeEvent('evt_fictif_paid');await payment(3,'evt_fictif_paid');assert.equal(await count('payment_confirmed'),1);
  const payload=JSON.parse(await sql("SELECT payload FROM public.admin_email_notifications WHERE kind='payment_confirmed';"));assert.deepEqual(payload,{amount_cents:49700,currency:'eur',payment_type:'course'});
});
await test('rejeu, événement asynchrone et changement de statut ne dupliquent pas un paiement',async()=>{
  await makeEvent('evt_fictif_async',{type:'checkout.session.async_payment_succeeded'});
  await sql("SET ROLE service_role; UPDATE public.stripe_payment_transactions SET last_event_id='evt_fictif_async' WHERE id='20000000-0000-4000-8000-000000000003';");
  await payment(4,'evt_fictif_async','processing',"UPDATE public.stripe_payment_transactions SET stripe_payment_intent_id='pi_fictif_3',status='paid' WHERE id='20000000-0000-4000-8000-000000000004';");
  assert.equal(await count('payment_confirmed'),1);
  assert.equal(Number(await sql("SELECT count(*) FROM public.admin_email_notifications WHERE deduplication_key='payment:pi_fictif_3';")),1);
});
await test('événement historique rejoué après activation ne déclenche pas de rattrapage',async()=>{
  const before=await count();await makeEvent('evt_fictif_old',{old:true});await payment(5,'evt_fictif_old');assert.equal(await count(),before);
});
await test('remboursement, expiration et litige ne sont pas traités comme une vente',async()=>{
  const before=await count();for(const[n,type]of [[6,'refund.updated'],[7,'checkout.session.expired'],[8,'charge.dispute.closed']]){await makeEvent(`evt_fictif_${n}`,{type});await payment(n,`evt_fictif_${n}`);}assert.equal(await count(),before);
});
await test('deux connexions concurrentes ne réservent qu’une fois un envoi',async()=>{
  const statement="SET ROLE service_role; UPDATE public.admin_email_notifications SET status='sending',attempts=attempts+1,attempted_at=now() WHERE kind='contact_request' AND status='pending' AND attempts=0 RETURNING id;";
  const results=await Promise.all([sql(statement),sql(statement)]);assert.equal(results.filter(Boolean).length,1);
  assert.equal(await sql("SELECT attempts FROM public.admin_email_notifications WHERE kind='contact_request';"),'1');
});
await test('la migration conserve les devis et accepte un suivi de réponse incertain',async()=>{
  await sql("INSERT INTO profiles VALUES('40000000-0000-4000-8000-000000000001'); INSERT INTO commercial_communications(contact_request_id,communication_type,recipient_email,subject,body,delivery_status,idempotency_key,prepared_by) VALUES('10000000-0000-4000-8000-000000000002','information','client@example.test','Programme','Document fictif','uncertain','reply:00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001');");
  assert.equal(await sql("SELECT status FROM contact_requests WHERE id='10000000-0000-4000-8000-000000000002';"),'new');assert.equal(await sql('SELECT count(*) FROM commercial_quotes;'),'0');
});
await mkdir('../output/mail-qa-postgres',{recursive:true});
await writeFile('../output/mail-qa-postgres/acceptance.json',JSON.stringify({database,host:'127.0.0.1',port:55471,checks},null,2));
console.log(`PASS ${checks.length} native PostgreSQL checks; fictitious database ${database}. No SMTP transport invoked.`);
