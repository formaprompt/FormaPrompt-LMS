import { useRef, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { checkClientReply, sendClientReply, validateReplyFiles } from '../lib/clientReply';
import './AdminClientReply.css';

export default function AdminClientReply({ request }) {
  const { user,role }=useAuth();
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({subject:`Re : ${String(request.subject||'Votre demande de formation').replace(/[\r\n]/g,' ').slice(0,290)}`,message:''});
  const [files,setFiles]=useState([]);
  const [reviewed,setReviewed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [frozen,setFrozen]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState(null);
  const replyId=useRef(null);
  const sending=useRef(false);
  if(!user||role!=='admin')return null;
  const editable=!busy&&!frozen;

  function change(field,value){setForm((current)=>({...current,[field]:value}));setReviewed(false);setError('');replyId.current=null;setResult(null);}
  function addFiles(event){
    const next=[...files,...Array.from(event.target.files||[])];
    const failure=validateReplyFiles(next);event.target.value='';setReviewed(false);
    if(failure){setError(failure);return;}
    setFiles(next);setError('');replyId.current=null;setResult(null);
  }
  function review(event){
    event.preventDefault();const failure=validateReplyFiles(files);
    if(failure){setError(failure);return;}
    if(form.subject.trim().length<2||form.message.trim().length<2){setError('Complétez l’objet et le message.');return;}
    setError('');setReviewed(true);
  }
  function applyStatus(status){
    setResult(status);setFrozen(status!=='failed');
    if(status==='failed')setError('Le message n’a pas été envoyé. Vous pouvez corriger le contenu ou relancer explicitement cet envoi.');
  }
  async function send(){
    if(sending.current||!reviewed||frozen)return;
    replyId.current ||= crypto.randomUUID();sending.current=true;setBusy(true);setFrozen(true);setError('');
    try{
      const response=await sendClientReply(supabase,request,form,files,replyId.current,result==='failed');
      applyStatus(['sent','failed','sending','uncertain'].includes(response?.status)?response.status:'uncertain');
    }catch(failure){setResult('check');setError(failure.message);}
    finally{sending.current=false;setBusy(false);}
  }
  async function check(){
    if(sending.current)return;
    sending.current=true;setBusy(true);setError('');
    try{
      const response=await checkClientReply(supabase,request.id,replyId.current);
      applyStatus(response?.status==='not_found'?'failed':response?.status||'uncertain');
    }catch(failure){setError(failure.message);}
    finally{sending.current=false;setBusy(false);}
  }
  return <section className="admin-client-reply" aria-label="Réponse par e-mail">
    {!open?<button type="button" className="btn btn-primary" onClick={()=>setOpen(true)}>Répondre au client</button>:<>
      <h3>Répondre au client</h3>
      <p>Les réponses arriveront à <strong>thierry@formaprompt.com</strong>. Le devis et le statut commercial restent inchangés.</p>
      <form className="admin-client-reply__form" onSubmit={review}>
        <fieldset disabled={!editable}>
          <label>Destinataire<input type="email" value={request.email} readOnly required /></label>
          <label>Objet de la réponse<input required minLength={2} maxLength={300} value={form.subject} onChange={(e)=>change('subject',e.target.value)} /></label>
          <label>Votre message<textarea required minLength={2} maxLength={10000} rows={5} value={form.message} onChange={(e)=>change('message',e.target.value)} /></label>
          <label>Pièces jointes<input type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={addFiles} /></label>
          <small>PDF ou DOCX · 3 fichiers maximum · 3 Mo par fichier · 6 Mo au total. Les fichiers sont transmis pour cet envoi et ne sont pas publiés sur le site.</small>
          <ul>{files.map((file,index)=><li key={`${file.name}-${index}`}><span>{file.name} ({Math.ceil(file.size/1024)} Ko)</span><button type="button" onClick={()=>{setFiles((current)=>current.filter((_,n)=>n!==index));setReviewed(false);replyId.current=null;setResult(null);}}>Retirer {file.name}</button></li>)}</ul>
          <button className="btn" type="submit">Vérifier le message et les pièces jointes</button>
        </fieldset>
      </form>
      {reviewed&&<div className="admin-client-reply__review" aria-label="Vérification avant envoi">
        <strong>À : {request.email}</strong><p>Objet : {form.subject}</p><p className="admin-client-reply__body">{form.message}</p>
        <p>{files.length?`Pièces jointes : ${files.map((file)=>file.name).join(', ')}`:'Aucune pièce jointe.'}</p>
        {(!result||result==='failed')&&<button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy?'Envoi en cours…':result==='failed'?'Réessayer cet envoi':'Envoyer la réponse au client'}</button>}
      </div>}
      {error&&<p role="alert">{error}</p>}
      {result==='sent'&&<p role="status">Réponse remise au serveur mail. L’échange pourra continuer dans votre messagerie professionnelle.</p>}
      {result==='sent'&&<button type="button" className="btn" onClick={()=>{setForm((current)=>({...current,message:''}));setFiles([]);setReviewed(false);setResult(null);setFrozen(false);setError('');replyId.current=null;}}>Préparer un nouveau message</button>}
      {(result==='uncertain'||result==='sending')&&<p role="alert">Le résultat de l’envoi est à vérifier. Aucun renvoi automatique n’est prévu. Vérifiez votre messagerie avant de préparer un autre message.</p>}
      {(result==='check'||result==='sending')&&<button type="button" className="btn" disabled={busy} onClick={check}>Vérifier le résultat de cet envoi</button>}
      <button type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>Fermer la réponse</button>
    </>}
  </section>;
}
