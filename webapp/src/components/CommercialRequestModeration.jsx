import { useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CommercialRequestModeration({ request, busy, protectedRequest, remove, moderate }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [blockEmail, setBlockEmail] = useState(false);

  function removePermanently(payload) {
    if (window.confirm('Supprimer définitivement cette demande ? Les mails envoyés ou à vérifier restent dans l’historique.')) {
      void remove(payload);
    }
  }

  if (request.discarded_at) {
    return <section className="admin-commercial__moderation" aria-label="Demande dans la corbeille">
      <p>{request.discarded_reason === 'spam' ? 'Spam' : 'Test'} · Dans la corbeille</p>
      <div className="admin-commercial__actions">
        <button type="button" className="btn" disabled={busy} onClick={() => moderate('restore')}>Restaurer la demande</button>
        <button type="button" className="btn admin-commercial__danger" disabled={busy || protectedRequest}
          onClick={() => removePermanently({})}>Supprimer définitivement</button>
      </div>
      {protectedRequest && <p>Cette demande est liée à un dossier commercial.</p>}
    </section>;
  }

  return <div className="admin-commercial__message-removal">
    <button type="button" className="btn admin-commercial__danger" disabled={busy || request.status === 'won'}
      aria-expanded={open} aria-controls={open ? formId : undefined}
      title={request.status === 'won' ? 'Cette demande a été convertie en inscription.' : undefined}
      onClick={() => setOpen((current) => !current)}>Supprimer</button>
    {open && <form id={formId} className="admin-commercial__remove-form" onSubmit={(event) => {
      event.preventDefault();
      void moderate(reason, reason === 'spam' && blockEmail);
    }}>
      <label>Motif
        <select value={reason} onChange={(event) => {
          setReason(event.target.value);
          setBlockEmail(false);
        }} disabled={busy}>
          <option value="spam">Spam</option>
          <option value="test">Test</option>
        </select>
      </label>
      {reason === 'spam' && <label className="admin-commercial__check">
        <input type="checkbox" checked={blockEmail} disabled={busy} onChange={(event) => setBlockEmail(event.target.checked)} />
        Bloquer {request.email} sur le formulaire pendant 180 jours
      </label>}
      <div className="admin-commercial__actions">
        <button type="submit" className="btn" disabled={busy}>Mettre à la corbeille</button>
        <button type="button" className="btn admin-commercial__danger" disabled={busy || protectedRequest}
          onClick={() => removePermanently({ reason, blockEmail: reason === 'spam' && blockEmail })}>Supprimer définitivement</button>
      </div>
      {protectedRequest && <p>Cette demande est liée à un dossier commercial. Tu peux la mettre à la corbeille.</p>}
    </form>}
  </div>;
}

export function BlockedContactEmails({ revision }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');

  useEffect(() => {
    if (!open) return;
    let current = true;
    async function load() {
      const { data, error: issue } = await supabase.from('contact_email_blocks')
        .select('email,expires_at').order('expires_at', { ascending: false });
      if (!current) return;
      const now = Date.now();
      setRows((data || []).map((row) => ({ ...row, expired: Date.parse(row.expires_at) <= now })));
      setError(issue ? 'La liste des adresses bloquées est indisponible.' : '');
    }
    void load();
    return () => { current = false; };
  }, [open, revision]);

  async function unblock(email) {
    setPending(email);
    try {
      const { data, error: issue } = await supabase.from('contact_email_blocks')
        .delete().eq('email', email).select('email').maybeSingle();
      if (issue || data?.email !== email) throw new Error('Déblocage non confirmé');
      setError('');
      setRows((previous) => previous?.filter((row) => row.email !== email));
    } catch {
      setError('Le blocage n’a pas pu être levé.');
    } finally {
      setPending('');
    }
  }

  return <details className="admin-commercial__moderation admin-commercial__blocklist" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Adresses bloquées sur le formulaire</summary>
    {error && <p role="alert">{error}</p>}
    {rows === null ? <p role="status">Chargement…</p> : rows.length === 0 && !error ? <p>Aucune adresse bloquée.</p> : (
      <ul>{rows.map(({ email, expires_at: expiresAt, expired }) => <li key={email}>
        <span><strong>{email}</strong><br />{expired ? 'Blocage expiré' : `Bloquée jusqu’au ${new Date(expiresAt).toLocaleDateString('fr-FR')}`}</span>
        <button type="button" className="btn" disabled={Boolean(pending)} aria-label={`Débloquer ${email}`} onClick={() => unblock(email)}>Débloquer</button>
      </li>)}</ul>
    )}
  </details>;
}
