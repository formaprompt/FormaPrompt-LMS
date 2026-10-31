import { CLIENT_REPLY_LIMITS as LIMITS, CLIENT_REPLY_MIME_TYPES } from '../../supabase/functions/_shared/clientReplyPolicy.js';

export function validateReplyFiles(files) {
  if(files.length>LIMITS.maxFiles)return 'Trois pièces jointes maximum.';
  let total=0;
  for(const file of files){
    const extension=file.name.split('.').at(-1).toLowerCase();
    if(!CLIENT_REPLY_MIME_TYPES[extension])return 'Seuls les fichiers PDF et DOCX sont autorisés.';
    if(file.size<=0||file.size>LIMITS.maxFileBytes)return 'Chaque fichier doit peser entre 1 octet et 3 Mo.';
    if(new TextEncoder().encode(file.name).length>LIMITS.maxFilenameBytes||/[\r\n/\\]/.test(file.name))return 'Le nom d’une pièce jointe est trop long ou invalide.';
    total+=file.size;
  }
  return total>LIMITS.maxTotalBytes?'Les pièces jointes dépassent 6 Mo au total.':'';
}

async function responseData(result){
  if(result.error||result.data?.error){
    let message=result.data?.error;
    try{message||=(await result.error?.context?.clone().json())?.error;}catch{/* generic fallback */}
    throw new Error(message||'Le résultat de l’envoi ne peut pas être confirmé. Vérifiez le suivi avant de réessayer.');
  }
  return result.data;
}

export async function sendClientReply(client,request,form,files,replyId,retry=false){
  const data=new FormData();
  for(const[key,value]of Object.entries({requestId:request.id,replyId,recipientEmail:request.email,subject:form.subject,message:form.message,retry:String(retry)}))data.set(key,value);
  for(const file of files)data.append('attachments',file,file.name);
  return responseData(await client.functions.invoke('admin-reply-client',{body:data}));
}

export async function checkClientReply(client,requestId,replyId){
  return responseData(await client.functions.invoke('admin-reply-client',{body:{action:'status',requestId,replyId}}));
}
