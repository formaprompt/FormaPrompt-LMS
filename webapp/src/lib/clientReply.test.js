import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClientReply, sendClientReply, validateReplyFiles } from './clientReply.js';

test('refuse tailles, formats, nombre et noms non autorisés avant tout envoi',()=>{
  const file=(name='programme.pdf',size=100)=>({name,size});
  assert.equal(validateReplyFiles([file()]),'');
  assert.match(validateReplyFiles([file('programme.exe')]),/PDF et DOCX/);
  assert.match(validateReplyFiles([file('programme.pdf',4*1024*1024)]),/3 Mo/);
  assert.match(validateReplyFiles(Array.from({length:4},()=>file())),/Trois/);
  assert.match(validateReplyFiles(Array.from({length:3},()=>file('test.pdf',3*1024*1024))),/6 Mo/);
  assert.match(validateReplyFiles([file('../programme.pdf')]),/nom/);
});
test('transmet FormData et même clé, sans action de devis',async()=>{
  const calls=[];const client={functions:{invoke:async(name,options)=>{calls.push({name,options});return{data:{status:'sent'}};}}};
  const file=new File(['%PDF-1.7\n%%EOF'],'programme.pdf',{type:'application/pdf'});
  await sendClientReply(client,{id:'request',email:'client@example.test'},{subject:'Programme',message:'Voici le programme'},[file],'same-reply');
  assert.equal(calls[0].name,'admin-reply-client');const body=calls[0].options.body;
  assert.equal(body.get('replyId'),'same-reply');assert.equal(body.get('recipientEmail'),'client@example.test');
  assert.equal(body.getAll('attachments').length,1);assert.equal(body.get('retry'),'false');
  await checkClientReply(client,'request','same-reply');
  assert.deepEqual(calls[1].options.body,{action:'status',requestId:'request',replyId:'same-reply'});
});
test('ne confond pas une erreur API et une remise SMTP',async()=>{
  const client={functions:{invoke:async()=>({error:new Error('network')})}};
  await assert.rejects(sendClientReply(client,{id:'request',email:'x@example.test'},{subject:'Objet',message:'Message'},[],'reply'),/ne peut pas être confirmé/);
});
