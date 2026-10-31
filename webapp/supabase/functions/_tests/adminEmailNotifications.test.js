import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminNotification, deliverAdminNotification, notifySourceSafely } from '../_shared/adminEmailNotifications.js';
import { SmtpReceiptError } from '../_shared/smtpReceipt.js';
import { submitContact, validateContactSubmission } from '../_shared/contactSubmission.js';

const id = '20000000-0000-4000-8000-000000000001';
const sourceId = '30000000-0000-4000-8000-000000000001';
const notification = { id,source_id:sourceId,kind:'contact_request',recipient_email:'formaprompt@gmail.com',status:'pending',attempts:0 };
function memoryStore() {
  const row = structuredClone(notification);
  return { row,
    async pendingForSource() { return row.status === 'pending' ? [row] : []; },
    async claim() { if(row.status !== 'pending')return null; row.status='sending'; row.attempts++; return structuredClone(row); },
    async finish(_id,changes) { Object.assign(row,changes); },
  };
}

test('l’alerte admin vise uniquement le Gmail choisi, sans données du prospect',()=> {
  const mail = buildAdminNotification({...notification,name:'Privé',email:'secret@example.test',message:'Besoin médical confidentiel'});
  assert.equal(mail.recipientEmail,'formaprompt@gmail.com');
  assert.match(mail.body,new RegExp(`/admin/commercial\\?demande=${sourceId}`));
  assert.doesNotMatch(JSON.stringify(mail),/Privé|secret@example|médical/);
  assert.throws(()=>buildAdminNotification({...notification,recipient_email:'autre@example.test'}));
});
test('l’alerte paiement contient montant et lien exact, sans adresse client',()=> {
  const mail=buildAdminNotification({...notification,kind:'payment_confirmed',payload:{amount_cents:49700,currency:'eur'}});
  assert.match(mail.body,/497.00 EUR/);
  assert.match(mail.body,new RegExp(`/admin/stripe-apres-paiement\\?transaction=${sourceId}`));
  assert.throws(()=>buildAdminNotification({...notification,kind:'payment_confirmed',payload:{amount_cents:0,currency:'eur'}}));
});
test('deux workers concurrents ou une répétition ne provoquent qu’un envoi',async()=> {
  const store=memoryStore(); let sends=0;
  const send=async()=>{sends++;};
  await Promise.all([deliverAdminNotification(store,id,{send}),deliverAdminNotification(store,id,{send})]);
  await deliverAdminNotification(store,id,{send});
  assert.equal(sends,1);assert.equal(store.row.attempts,1);assert.equal(store.row.status,'sent');
});
test('une panne connue reste traçable et n’est pas réessayée automatiquement',async()=> {
  const store=memoryStore();let sends=0;
  const send=async()=>{sends++;throw new SmtpReceiptError('smtp_configuration_missing');};
  await notifySourceSafely(store,'contact_request',sourceId,{send});
  await notifySourceSafely(store,'contact_request',sourceId,{send});
  assert.equal(sends,1);assert.equal(store.row.status,'failed');assert.equal(store.row.error_code,'smtp_configuration_missing');
});
test('une issue SMTP incertaine interdit la reprise automatique',async()=> {
  const store=memoryStore();let sends=0;
  const send=async()=>{sends++;throw new SmtpReceiptError('smtp_delivery_uncertain','uncertain');};
  await deliverAdminNotification(store,id,{send});
  await deliverAdminNotification(store,id,{send});
  assert.equal(sends,1);assert.equal(store.row.status,'uncertain');
});
test('si le statut ne peut être enregistré après SMTP, la ligne reste réservée',async()=> {
  const store=memoryStore();let sends=0;
  store.finish=async()=>{throw new Error('database unavailable');};
  const result=await deliverAdminNotification(store,id,{send:async()=>{sends++;}});
  assert.equal(result.status,'uncertain');assert.equal(store.row.status,'sending');
  await deliverAdminNotification(store,id,{send:async()=>{sends++;}});assert.equal(sends,1);
});

const contact = {submissionId:sourceId,name:'Organisme fictif',email:'client@example.test',subject:'Programme',message:'Pouvez-vous me transmettre le programme ?',request_type:'professional'};
function contactStore() {
  const rows=new Map();
  return {rows,find:async(id)=>rows.get(id),recentCount:async()=>0,insert:async(row)=>{rows.set(row.id,row);}};
}
test('la panne mail ne perd pas la demande et aucun accusé client n’est déclenché',async()=> {
  const store=contactStore();const tasks=[];const notified=[];
  const result=await submitContact(contact,{store,notify:async(id)=>{notified.push(id);throw new Error('smtp down');},defer:(task)=>tasks.push(task)});
  assert.deepEqual(result,{accepted:true});assert.equal(store.rows.size,1);
  await Promise.all(tasks);assert.deepEqual(notified,[sourceId]);assert.equal(store.rows.size,1);
});
test('répéter la soumission après une réponse réseau perdue ne duplique pas la demande',async()=> {
  const store=contactStore();const opts={store,notify:async()=>{}};
  await submitContact(contact,opts);await submitContact(contact,opts);
  assert.equal(store.rows.size,1);
  await assert.rejects(submitContact({...contact,message:'Autre contenu avec la même clé'},opts),/autre demande/);
});
test('validation, quota et honeypot précèdent les effets',async()=> {
  assert.throws(()=>validateContactSubmission({...contact,email:'x@example.test\r\nBcc:y@example.test'}));
  assert.throws(()=>validateContactSubmission({...contact,subject:'x'.repeat(201)}));
  const store=contactStore();let sends=0;store.recentCount=async()=>5;
  await assert.rejects(submitContact(contact,{store,notify:async()=>{sends++;}}),/patienter/);
  await submitContact({...contact,website:'bot'},{store,notify:async()=>{sends++;}});
  assert.equal(store.rows.size,0);assert.equal(sends,0);
});
