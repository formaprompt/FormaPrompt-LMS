import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import './AdminEmailNotifications.css';

const LABELS = {pending:'À envoyer',sending:'Envoi en cours ou à vérifier',sent:'Remise au serveur mail',failed:'Échec — non envoyé',uncertain:'Résultat à vérifier'};

export default function AdminEmailNotifications() {
  const { user, role } = useAuth();
  const userId = user?.id;
  const [rows,setRows] = useState([]);
  const [error,setError] = useState('');
  const [hasMore,setHasMore] = useState(false);
  const [running,setRunning] = useState('');
  const [loaded,setLoaded] = useState(false);
  const [checkedAt,setCheckedAt] = useState(0);
  const load = useCallback(async () => {
    setError('');
    try {
      const {data,error:failure} = await supabase.functions.invoke('admin-email-notifications',{body:{action:'list'}});
      if (failure || data?.error) throw new Error('notification_list_failed');
      setRows(data?.rows || []); setHasMore(Boolean(data?.hasMore)); setCheckedAt(Date.now()); setLoaded(true);
    } catch { setError('Le suivi des alertes est indisponible.'); }
  },[]);
  useEffect(() => {
    if (!userId || role !== 'admin') return;
    const timer = window.setTimeout(load,0);
    return () => window.clearTimeout(timer);
  },[userId,role,load]);

  async function retry(row) {
    const uncertain = row.status === 'uncertain' || row.status === 'sending';
    if (!window.confirm(uncertain
      ? 'Après vérification de formaprompt@gmail.com, confirmez-vous une nouvelle tentative ? Le précédent envoi peut avoir abouti : un doublon est possible.'
      : 'Envoyer cette alerte administrateur à formaprompt@gmail.com ?')) return;
    setRunning(row.id); setError('');
    try {
      const {data,error:failure} = await supabase.functions.invoke('admin-email-notifications',{body:{action:'retry',id:row.id,acknowledgePossibleDuplicate:uncertain}});
      if (failure || data?.error) throw new Error();
      await load();
    } catch { setError('La nouvelle tentative ne peut pas être confirmée. Actualisez le suivi avant toute autre action.'); }
    finally { setRunning(''); }
  }
  if (!user || role !== 'admin') return null;
  const unresolved = rows.filter((row)=>row.status !== 'sent');
  return <details className="admin-email-notifications">
    <summary>Alertes e-mail administrateur {loaded && `— ${unresolved.length}${hasMore ? '+' : ''} à vérifier`}</summary>
    <p>Destinataire : <strong>formaprompt@gmail.com</strong>. Une remise au serveur mail ne garantit pas le classement dans la boîte de réception. Aucun message client n’est envoyé depuis ce suivi.</p>
    <button type="button" className="btn" onClick={load} disabled={Boolean(running)}>Actualiser le suivi</button>
    {error && <p role="alert">{error}</p>}
    {loaded && rows.length === 0 && <p>Aucune alerte enregistrée depuis l’activation de ce service.</p>}
    {hasMore && <p>Plus de 50 alertes restent à vérifier. Les plus anciennes sont affichées.</p>}
    <ul>{rows.map((row)=> {
      const stale = row.status === 'sending' && checkedAt-Date.parse(row.attempted_at) > 2*60_000;
      return <li key={row.id}>
        <strong>{row.kind === 'contact_request' ? 'Demande de devis ou de contact' : 'Paiement confirmé'}</strong>
        <span>{LABELS[row.status]} · {new Date(row.created_at).toLocaleString('fr-FR')} · {row.attempts} tentative(s)</span>
        <small>Référence : {row.source_id}{row.error_code ? ` · Code : ${row.error_code}` : ''}</small>
        <a href={row.kind==='contact_request'?`/admin/commercial?demande=${encodeURIComponent(row.source_id)}`:`/admin/stripe-apres-paiement?transaction=${encodeURIComponent(row.source_id)}`}>Ouvrir le dossier concerné</a>
        {(row.status === 'pending' || row.status === 'failed' || row.status === 'uncertain' || stale) && <button type="button" className="btn" disabled={Boolean(running)} onClick={()=>retry(row)}>{row.status === 'uncertain' || stale ? 'Vérifier puis réessayer' : 'Réessayer cette alerte'}</button>}
      </li>;
    })}</ul>
  </details>;
}
