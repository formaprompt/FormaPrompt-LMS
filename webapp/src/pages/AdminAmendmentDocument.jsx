import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import './AdminCommercialQuoteDocument.css';

export default function AdminAmendmentDocument() {
  const { amendmentId } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [amendment, setAmendment] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !['admin', 'employee'].includes(role)) { navigate('/dashboard'); return; }
    supabase.from('training_amendments').select('*').eq('id', amendmentId).maybeSingle().then(({ data, error: loadError }) => {
      if (loadError || !data) setError('Avenant introuvable ou inaccessible.'); else setAmendment(data);
    });
  }, [user, role, navigate, amendmentId]);

  if (!user || !['admin', 'employee'].includes(role)) return null;
  if (error) return <main className="quote-document container section"><p role="alert">{error}</p></main>;
  if (!amendment) return <main className="quote-document container section"><p role="status">Chargement de l’avenant…</p></main>;
  const snapshot = amendment.frozen_snapshot;
  return <main className="quote-document container section">
    <nav className="quote-document__actions" aria-label="Actions de l’avenant"><Link className="btn" to="/admin/dossiers">Retour</Link><button className="btn btn-primary" type="button" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button></nav>
    <article className="quote-document__paper">
      <header><div><p>FormaPrompt</p><h1>Avenant {amendment.amendment_number}</h1></div><span>Version figée</span></header>
      <dl><div><dt>Date de création</dt><dd>{new Date(amendment.created_at).toLocaleDateString('fr-FR')}</dd></div><div><dt>Date d’effet</dt><dd>{new Date(amendment.effective_date).toLocaleDateString('fr-FR')}</dd></div></dl>
      <section><h2>Dossier concerné</h2><p><strong>{snapshot.learner.firstName} {snapshot.learner.lastName}</strong><br />{snapshot.learner.email}<br />Formation : {snapshot.enrollment.courseId}</p></section>
      <section><h2>Motif</h2><p>{snapshot.reason}</p></section>
      <section><h2>Modification convenue</h2><p>{snapshot.changeSummary}</p></section>
      <section className="quote-document__parties"><div><h2>Valeurs antérieures</h2><pre>{JSON.stringify(snapshot.previousValues, null, 2)}</pre></div><div><h2>Nouvelles valeurs</h2><pre>{JSON.stringify(snapshot.newValues, null, 2)}</pre></div></section>
      <footer><p>Date, nom, qualité et signature des parties :</p><div /></footer>
    </article>
  </main>;
}
