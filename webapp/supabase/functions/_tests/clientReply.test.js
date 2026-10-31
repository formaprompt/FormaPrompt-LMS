import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateReplyAttachments,validateClientReply,deliverClientReply } from '../_shared/clientReply.js';
import { CLIENT_REPLY_LIMITS } from '../_shared/clientReplyPolicy.js';
import { buildCommercialEmail,sendCommercialEmail,SmtpReceiptError } from '../_shared/smtpReceipt.js';

const contact={id:'30000000-0000-4000-8000-000000000001',email:'client@example.test'};
const input={requestId:contact.id,replyId:randomUUID(),recipientEmail:contact.email,subject:'Programme détaillé',message:'Bonjour, voici le programme détaillé.'};
const pdf=()=>new File(['%PDF-1.7\n1 0 obj <<>> endobj\n%%EOF'],'programme détaillé.pdf',{type:'application/pdf'});
function zip(names){
  const local=[],central=[];let offset=0;
  for(const name of names){
    const nameBytes=Buffer.from(name),data=Buffer.from('<document/>');
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(nameBytes.length,26);
    const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(nameBytes.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,nameBytes,data);central.push(directory,nameBytes);offset+=header.length+nameBytes.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
const docx=(names=['[Content_Types].xml','_rels/.rels','word/document.xml'])=>new File([zip(names)],'déroulé.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});

test('valide PDF et structure DOCX sans extraire ni publier les documents',async()=>{
  const files=await validateReplyAttachments([pdf(),docx()]);assert.equal(files.length,2);
  assert.match(files[0].sha256,/^[a-f0-9]{64}$/);assert.equal(files[0].mime,'application/pdf');assert.ok(files[0].bytes instanceof Uint8Array);
});
test('refuse les faux formats, macros, archives traversantes, tailles et nombre excessifs',async()=>{
  for(const file of [new File(['executable'],'fake.pdf',{type:'application/pdf'}),new File(['x'],'file.exe'),docx(['[Content_Types].xml','_rels/.rels','word/document.xml','word/vbaProject.bin']),docx(['[Content_Types].xml','_rels/.rels','word/document.xml','../payload']),new File([''],'vide.pdf')]){
    await assert.rejects(validateReplyAttachments([file]));
  }
  await assert.rejects(validateReplyAttachments([pdf(),pdf(),pdf(),pdf()]),/Trois/);
  const oversized={name:'programme.pdf',type:'application/pdf',size:CLIENT_REPLY_LIMITS.maxFileBytes+1,arrayBuffer:async()=>{throw Error('Must not read oversized file');}};
  await assert.rejects(validateReplyAttachments([oversized]),/3 Mo/);
});
test('verrouille le destinataire sur la demande et interdit l’injection d’en-têtes',async()=>{
  await assert.rejects(validateClientReply({...input,recipientEmail:'autre@example.test'},contact,[]),/demandeur/);
  await assert.rejects(validateClientReply({...input,recipientEmail:'client@example.test\r\nBcc:x@example.test'},contact,[]),/e-mail invalide/);
  await assert.rejects(validateClientReply({...input,subject:'Programme\r\nBcc:x@example.test'},contact,[]),/Objet invalide/);
  await assert.rejects(validateClientReply({...input,requestId:randomUUID()},contact,[]),/introuvable/);
});
test('encode en MIME mixte, conserve les octets et fixe le Reply-To professionnel',async()=>{
  const reply=await validateClientReply(input,contact,[pdf()]);
  const mail=buildCommercialEmail({recipientEmail:reply.recipient,subject:reply.subject,body:reply.message,attachments:reply.attachments,replyTo:'thierry@formaprompt.com',messageId:'client-reply-fictif'},'expediteur@example.test');
  assert.match(mail.data,/Content-Type: multipart\/mixed/);assert.match(mail.data,/Reply-To: <thierry@formaprompt.com>/);
  assert.match(mail.data,/filename\*=UTF-8''programme%20d%C3%A9taill%C3%A9.pdf/);
  const encoded=mail.data.split('Content-Disposition: attachment;')[1].split('\r\n\r\n')[1].split('\r\n--')[0];
  assert.deepEqual(Buffer.from(encoded.replaceAll('\r\n',''),'base64'),Buffer.from(reply.attachments[0].bytes));
  assert.doesNotMatch(mail.data,/https?:\/\/.*programme/);
});

function replyStore(){
  const rows=new Map(),history=[];
  return{rows,events:history,
    find:async(key)=>structuredClone(rows.get(key)),
    insert:async(row)=>{if(rows.has(row.idempotency_key))throw Object.assign(Error('duplicate'),{code:'23505'});const saved={...row,id:randomUUID()};rows.set(row.idempotency_key,saved);return structuredClone(saved);},
    claimFailed:async(row,now)=>{const current=rows.get(row.idempotency_key);if(current.delivery_status!=='failed'||current.delivery_attempts!==row.delivery_attempts)return null;Object.assign(current,{delivery_status:'sending',attempted_at:now,delivery_attempts:current.delivery_attempts+1});return structuredClone(current);},
    finish:async(id,changes)=>Object.assign([...rows.values()].find((row)=>row.id===id),changes),
    history:async(...entry)=>history.push(entry),
  };
}
test('double clic, concurrence et répétition utilisent une seule communication',async()=>{
  const reply=await validateClientReply(input,contact,[pdf()]),store=replyStore();let sent=0;
  const options={send:async(mail)=>{sent++;assert.equal(mail.replyTo,'thierry@formaprompt.com');}};
  await Promise.all([deliverClientReply(reply,'admin',store,options),deliverClientReply(reply,'admin',store,options)]);
  await deliverClientReply(reply,'admin',store,options);assert.equal(sent,1);assert.equal(store.rows.size,1);
  const row=[...store.rows.values()][0];assert.equal(row.communication_type,'information');assert.ok(!JSON.stringify(row.attachment_metadata).includes('bytes'));
  assert.ok(!('status'in contact));
});
test('une clé réutilisée avec un contenu différent ne peut pas envoyer',async()=>{
  const store=replyStore(),reply=await validateClientReply(input,contact,[]);let sent=0;
  await deliverClientReply(reply,'admin',store,{send:async()=>{sent++;}});
  const changed=await validateClientReply({...input,message:'Autre message, même clé'},contact,[]);
  await assert.rejects(deliverClientReply(changed,'admin',store,{send:async()=>{sent++;}}),/autre message/);assert.equal(sent,1);
});
test('un échec certain exige un retry explicite ; une issue incertaine ne se répète jamais',async()=>{
  const store=replyStore(),reply=await validateClientReply(input,contact,[]);let sent=0;
  const fail={send:async()=>{sent++;throw new SmtpReceiptError('smtp_rejected_450');}};
  await deliverClientReply(reply,'admin',store,fail);await deliverClientReply(reply,'admin',store,fail);assert.equal(sent,1);
  await deliverClientReply(reply,'admin',store,{retry:true,send:async()=>{sent++;throw new SmtpReceiptError('smtp_delivery_uncertain','uncertain');}});
  await deliverClientReply(reply,'admin',store,{retry:true,send:async()=>{sent++;}});assert.equal(sent,2);
  assert.equal([...store.rows.values()][0].delivery_status,'uncertain');
});

const env={SMTP_HOST:'smtp.ionos.fr',SMTP_PORT:'465',SMTP_USER:'test@example.test',SMTP_PASSWORD:'fictif',SMTP_FROM:'test@example.test'};
function smtpFixture({ack='250 accepted\r\n',failReadAfterData=false,partial=false}={}){
  const replies=['220 ready\r\n','250 ehlo\r\n','334 username\r\n','334 password\r\n','235 ok\r\n','250 from\r\n','250 to\r\n','354 data\r\n',ack];const writes=[];
  return{writes,async read(buffer){const reply=replies.shift();if(reply===undefined||failReadAfterData&&replies.length===0)return null;const bytes=new TextEncoder().encode(reply);buffer.set(bytes);return bytes.length;},async write(bytes){const n=partial?Math.min(17,bytes.length):bytes.length;writes.push(new TextDecoder().decode(bytes.subarray(0,n)));return n;},close(){}};
}
test('SMTP gère les écritures partielles et confirme dès le 250 final',async()=>{
  const connection=smtpFixture({partial:true});const reply=await validateClientReply(input,contact,[pdf()]);
  const result=await sendCommercialEmail({recipientEmail:reply.recipient,subject:reply.subject,body:reply.message,attachments:reply.attachments,messageId:'reply-fictif-transport'},{getEnv:(key)=>env[key],connectTls:async()=>connection});
  assert.equal(result.status,'sent');assert.match(connection.writes.join(''),/Content-Disposition: attachment/);
});
test('SMTP distingue rejet après DATA et perte de l’accusé final',async()=>{
  const message={recipientEmail:contact.email,subject:'Programme',body:'Voici le programme',messageId:'reply-fictif-failure'};
  await assert.rejects(sendCommercialEmail(message,{getEnv:(key)=>env[key],connectTls:async()=>smtpFixture({ack:'450 refused\r\n'})}),(error)=>error.outcome==='not_sent');
  await assert.rejects(sendCommercialEmail(message,{getEnv:(key)=>env[key],connectTls:async()=>smtpFixture({failReadAfterData:true})}),(error)=>error.outcome==='uncertain');
});
