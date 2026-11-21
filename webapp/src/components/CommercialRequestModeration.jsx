import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CommercialRequestModeration({ request, busy, linked, canPurgeSpam, purgeSpam, moderate }) {
  const [reason, setReason] = useState('');
  const [blockEmail, setBlockEmail] = useState(false);

  if (request.discarded_at) {
    return <section className="admin-commercial__moderation" aria-label="Demande dans la corbeille">
      <p>{request.discarded_reason === 'spam' ? 'Spam' : 'Test'} · Dans la corbeille</p>
      <div className="admin-commercial__actions">
        <button type="button" className="btn" disabled={busy} onClick={() => moderate('restore')}>Restaurer la demande</button>
        {canPurgeSpam && <button type="button" className="btn admin-commercial__danger" disabled={busy} onClick={() => {
          if (window.confirm('Supprimer définitivement ce spam ? Les e-mails envoyés ou à vérifier resteront consultables.')) purgeSpam();
        }}>Supprimer le spam bloqué</button>}
        {!linked && !canPurgeSpam && <button type="button" className="btn admin-commercial__danger" disabled={busy} onClick={() => {
          if (window.confirm('Supprimer définitivement cette demande ? Cette action est irréversible.')) moderate('delete');
        }}>Supprimer définitivement</button>}
      </div>
      {linked && !canPurgeSpam && <p>Cette demande est liée à un dossier. Elle peut être conservée ici ou restaurée.</p>}
    </section>;
  }

  if (request.status === 'won') return null;
  return <details className="admin-commercial__moderation">
    <summary>Retirer cette demande</summary>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (reason) moderate(reason, reason === 'spam' && blockEmail);
    }}>
      <label>Motif du retrait
        <select value={reason} onChange={(event) => {
          setReason(event.target.value);
          setBlockEmail(false);
        }} required>
          <option value="">Choisir un motif</option>
          <option value="test">Test</option>
          <option value="spam">Spam</option>
        </select>
      </label>
      {reason === 'spam' && <label className="admin-commercial__check">
        <input type="checkbox" checked={blockEmail} onChange={(event) => setBlockEmail(event.target.checked)} />
        Bloquer {request.email} sur le formulaire de contact pendant 180 jours
      </label>}
      <button type="submit" className="btn" disabled={!reason || busy}>Mettre à la corbeille</button>
    </form>
  </details>;
}

export function BlockedContactEmails({ revision, onUnblock }) {
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
      onUnblock(email);
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
