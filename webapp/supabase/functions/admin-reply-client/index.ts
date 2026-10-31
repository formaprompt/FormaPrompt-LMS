import { jsonResponse } from '../_shared/cors.ts';
import { requireMailAdmin } from '../_shared/requireMailAdmin.ts';
import { InputError, readBoundedBody, requiredUuid } from '../_shared/httpInput.js';
import { CLIENT_REPLY_LIMITS } from '../_shared/clientReplyPolicy.js';
import { createClientReplyStore, deliverClientReply, validateClientReply } from '../_shared/clientReply.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({});
  if (request.method !== 'POST') return jsonResponse({error:'Méthode non autorisée.'},405);
  try {
    // Authentication and current database role precede document parsing.
    const { database,actor } = await requireMailAdmin(request);
    const contentType=request.headers.get('content-type') || '';
    if(contentType.startsWith('application/json')){
      const input=JSON.parse(new TextDecoder().decode(await readBoundedBody(request,4096)));
      if(input.action!=='status')throw new InputError('Action invalide.');
      const requestId=requiredUuid(input.requestId),replyId=requiredUuid(input.replyId);
      const{data,error}=await database.from('commercial_communications').select('id,delivery_status,attempted_at')
        .eq('idempotency_key',`reply:${replyId}`).eq('contact_request_id',requestId).maybeSingle();
      if(error)throw error;
      const stale=data?.delivery_status==='sending' && Date.now()-Date.parse(data.attempted_at)>2*60_000;
      return jsonResponse({id:data?.id,status:stale?'uncertain':data?.delivery_status||'not_found'});
    }
    if(!contentType.startsWith('multipart/form-data;'))throw new InputError('Format de message invalide.');
    const bytes=await readBoundedBody(request,CLIENT_REPLY_LIMITS.maxRequestBytes);
    const form=await new Response(bytes,{headers:{'content-type':contentType}}).formData();
    for(const key of ['requestId','replyId','recipientEmail','subject','message','retry']){
      if(form.getAll(key).length>1)throw new InputError('Champ de message dupliqué.');
    }
    const input=Object.fromEntries(['requestId','replyId','recipientEmail','subject','message'].map((key)=>[key,form.get(key)]));
    const requestId=requiredUuid(input.requestId);
    const{data:contact,error}=await database.from('contact_requests').select('id,email').eq('id',requestId).maybeSingle();
    if(error)throw error;
    if(!contact)throw new InputError('Demande introuvable.',404);
    const reply=await validateClientReply(input,contact,form.getAll('attachments'));
    const result=await deliverClientReply(reply,actor.id,createClientReplyStore(database),{retry:form.get('retry')==='true'});
    return jsonResponse(result);
  }catch(error){
    if(error instanceof InputError)return jsonResponse({error:error.message},error.status);
    console.error('client_reply_outcome_unavailable');
    return jsonResponse({error:'Le résultat de l’envoi ne peut pas être confirmé. Conservez ce message et vérifiez le suivi avant toute nouvelle tentative.'},503);
  }
});
