import { InputError, requiredUuid, singleEmail } from './httpInput.js';
import { CLIENT_REPLY_LIMITS as LIMITS, CLIENT_REPLY_MIME_TYPES as MIME } from './clientReplyPolicy.js';
import { PROFESSIONAL_REPLY_TO } from './adminEmailNotifications.js';
import { sendCommercialEmail, smtpFailureCode } from './smtpReceipt.js';

const encoder = new TextEncoder();
export async function sha256Hex(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), (value)=>value.toString(16).padStart(2,'0')).join('');
}

function isDocx(bytes) {
  // Inspect the central directory without extracting or executing any document.
  // Reject encrypted/ZIP64 archives, paths, macros and embedded payloads.
  if (bytes.length < 22) return false;
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (view.getUint32(0,true) !== 0x04034b50) return false;
  let end = -1;
  for (let pos = bytes.length-22;pos >= Math.max(0,bytes.length-65557);pos--) {
    if (view.getUint32(pos,true) === 0x06054b50 && pos+22+view.getUint16(pos+20,true) === bytes.length) {end=pos;break;}
  }
  if (end < 0 || view.getUint16(end+4,true) || view.getUint16(end+6,true)) return false;
  const count = view.getUint16(end+10,true);
  if (!count || count>2000 || view.getUint16(end+8,true)!==count) return false;
  const size=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
  if (start+size !== end) return false;
  const names=new Set();let cursor=start,total=0;
  try {
    for (let n=0;n<count;n++) {
      if (cursor+46>end || view.getUint32(cursor,true)!==0x02014b50) return false;
      const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true);
      const compressed=view.getUint32(cursor+20,true),expanded=view.getUint32(cursor+24,true);
      const nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
      const local=view.getUint32(cursor+42,true);
      if (cursor+46+nameLength+extra+comment>end || flags&1 || ![0,8].includes(method) || local+30>=start || expanded>20*1024*1024 || compressed>bytes.length) return false;
      const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(cursor+46,cursor+46+nameLength));
      if (!name || names.has(name) || /(^\/|\\|(^|\/)\.\.(\/|$)|[\r\n])/.test(name) || /vba|embeddings\/|\.(?:bin|exe|dll|js|vbs)$/i.test(name)) return false;
      if (view.getUint32(local,true)!==0x04034b50 || view.getUint16(local+8,true)!==method) return false;
      const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true);
      if (local+30+localName+localExtra+compressed>start || view.getUint16(local+6,true)&1) return false;
      if (new TextDecoder().decode(bytes.subarray(local+30,local+30+localName))!==name) return false;
      names.add(name);total+=expanded;if(total>50*1024*1024)return false;
      cursor+=46+nameLength+extra+comment;
    }
  } catch {return false;}
  return cursor===end && names.has('[Content_Types].xml') && names.has('_rels/.rels') && names.has('word/document.xml');
}

export async function validateReplyAttachments(files) {
  if (files.length>LIMITS.maxFiles) throw new InputError('Trois pièces jointes maximum.');
  let total=0;const result=[];
  for (const file of files) {
    if (typeof file?.name!=='string' || !file.name.trim() || /[\r\n/\\]/.test(file.name) || encoder.encode(file.name).length>LIMITS.maxFilenameBytes
      || !Number.isSafeInteger(file.size) || file.size<=0 || file.size>LIMITS.maxFileBytes) throw new InputError('Pièce jointe invalide : nom ou taille non autorisé (3 Mo maximum par fichier).');
    total+=file.size;if(total>LIMITS.maxTotalBytes) throw new InputError('Les pièces jointes dépassent 6 Mo au total.');
    const extension=file.name.split('.').at(-1).toLowerCase(),mime=MIME[extension];
    if (!mime || (file.type && file.type!==mime && file.type!=='application/octet-stream')) throw new InputError('Seuls les fichiers PDF et DOCX sont autorisés.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if (bytes.length!==file.size) throw new InputError('Pièce jointe incomplète.');
    const pdf=extension==='pdf' && new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-' && new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-2048))).includes('%%EOF');
    if (!(pdf || (extension==='docx' && isDocx(bytes)))) throw new InputError('Le contenu de la pièce jointe ne correspond pas à un document PDF ou DOCX valide.');
    result.push({name:file.name,mime,bytes,size:bytes.length,sha256:await sha256Hex(bytes)});
  }
  return result;
}

export async function validateClientReply(input,request,files) {
  const requestId=requiredUuid(input.requestId),replyId=requiredUuid(input.replyId);
  if (requestId!==request.id) throw new InputError('Demande introuvable.',404);
  const recipient=singleEmail(input.recipientEmail),expected=singleEmail(request.email);
  if(recipient!==expected)throw new InputError('Le destinataire doit correspondre au demandeur.',403);
  const subject=typeof input.subject==='string'?input.subject.trim():'';
  const message=typeof input.message==='string'?input.message.trim():'';
  if(subject.length<2||subject.length>LIMITS.maxSubjectLength||/[\r\n]/.test(subject))throw new InputError('Objet invalide.');
  if(message.length<2||message.length>LIMITS.maxMessageLength)throw new InputError('Message invalide.');
  const attachments=await validateReplyAttachments(files);
  const metadata=attachments.map(({name,mime,size,sha256})=>({name,mime,size,sha256}));
  const fingerprint=await sha256Hex(encoder.encode(JSON.stringify({requestId,recipient,subject,message,metadata})));
  return {requestId,replyId,recipient,subject,message,attachments,metadata,fingerprint};
}

export async function deliverClientReply(reply,actorId,store,{send=sendCommercialEmail,retry=false,now=()=>new Date().toISOString()}={}) {
  const key=`reply:${reply.replyId}`;
  let existing=await store.find(key),row;
  if(!existing){
    try { row=await store.insert({contact_request_id:reply.requestId,communication_type:'information',recipient_email:reply.recipient,subject:reply.subject,body:reply.message,
      attachment_metadata:reply.metadata,reply_fingerprint:reply.fingerprint,idempotency_key:key,prepared_by:actorId,delivery_status:'sending',delivery_attempts:1,attempted_at:now()}); }
    catch(error){if(error?.code!=='23505')throw error;existing=await store.find(key);if(!existing)throw error;}
  }
  if(existing){
    if(existing.reply_fingerprint!==reply.fingerprint)throw new InputError('Cette référence correspond à un autre message. Aucun nouvel envoi effectué.',409);
    if(existing.delivery_status!=='failed'||!retry)return {id:existing.id,status:existing.delivery_status};
    row=await store.claimFailed(existing,now());
    if(!row)return {id:existing.id,status:'sending'};
  }
  let status='sent',errorCode=null;
  try {await send({recipientEmail:reply.recipient,subject:reply.subject,body:reply.message,attachments:reply.attachments,replyTo:PROFESSIONAL_REPLY_TO,messageId:`client-reply-${row.id}`});}
  catch(error){status=error?.outcome==='uncertain'?'uncertain':'failed';errorCode=smtpFailureCode(error);}
  try {await store.finish(row.id,{delivery_status:status,error_code:errorCode,sent_at:status==='sent'?now():null});}
  catch{return {id:row.id,status:'uncertain'};}
  // The communication row is the primary audit record. History is best effort
  // and never causes a new send, changes a quote, or alters the request status.
  try {await store.history(reply.requestId,actorId,status,row.id);}catch{/* primary record is already durable */}
  return {id:row.id,status};
}

export function createClientReplyStore(database) {
  return {
    async find(key){const{data,error}=await database.from('commercial_communications').select('*').eq('idempotency_key',key).maybeSingle();if(error)throw error;return data;},
    async insert(row){const{data,error}=await database.from('commercial_communications').insert(row).select('*').single();if(error)throw error;return data;},
    async claimFailed(row,now){
      if(row.delivery_attempts>=100)return null;
      const{data,error}=await database.from('commercial_communications').update({delivery_status:'sending',error_code:null,attempted_at:now,delivery_attempts:row.delivery_attempts+1})
        .eq('id',row.id).eq('delivery_status','failed').eq('delivery_attempts',row.delivery_attempts).select('*').maybeSingle();if(error)throw error;return data;
    },
    async finish(id,changes){const{data,error}=await database.from('commercial_communications').update(changes).eq('id',id).eq('delivery_status','sending').select('id').maybeSingle();if(error||!data)throw error||new Error('reply_state_conflict');},
    async history(requestId,actorId,status,id){const{error}=await database.from('commercial_request_history').insert({contact_request_id:requestId,actor_user_id:actorId,event_type:status==='sent'?'email_sent':'email_failed',details:{communicationId:id,kind:'client_reply',deliveryStatus:status}});if(error)throw error;},
  };
}
