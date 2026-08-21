import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { formatMoney, QUOTE_STATUS_LABELS } from '../lib/commercialAdministration';
import './AdminCommercialQuoteDocument.css';

function currentSnapshot(quote) {
  return quote.sent_snapshot || {
    quoteNumber: quote.quote_number, createdAt: quote.created_at, validUntil: quote.valid_until,
    provider: { legalName: 'Thierry FREZARD EI', tradeName: 'FormaPrompt', address: '6 rue Webster, 62100 Calais, France', siret: '511 151 615 00016', activityDeclaration: '32620346362', email: 'thierry@formaprompt.com' },
    client: { name: quote.client_name, email: quote.client_email, organizationName: quote.organization_name },
    beneficiary: { name: quote.beneficiary_name, email: quote.beneficiary_email },
    course: { id: quote.course_id, title: quote.course_title },
    pricing: { quantity: quote.quantity, unitPriceCents: quote.unit_price_cents, totalPriceCents: quote.total_price_cents, currency: quote.currency, taxStatement: quote.tax_statement },
  };
}

export default function AdminCommercialQuoteDocument() {
  const { quoteId } = useParams(); const { user, role } = useAuth(); const navigate = useNavigate();
  const [quote, setQuote] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    if (!user || !['admin', 'employee'].includes(role)) { navigate('/dashboard'); return; }
    supabase.from('commercial_quotes').select('*').eq('id', quoteId).maybeSingle().then(({ data, error: loadError }) => {
      if (loadError || !data) setError('Devis introuvable ou inaccessible.'); else setQuote(data);
    });
  }, [user, role, navigate, quoteId]);
  if (!user || !['admin', 'employee'].includes(role)) return null;
  if (error) return <main className="quote-document container section"><p role="alert">{error}</p></main>;
  if (!quote) return <main className="quote-document container section"><p role="status">Chargement du devis…</p></main>;
  const snapshot = currentSnapshot(quote);
  return <main className="quote-document container section">
    <nav className="quote-document__actions" aria-label="Actions du devis"><Link className="btn" to="/admin/commercial">Retour</Link><button className="btn btn-primary" type="button" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button></nav>
    <article className="quote-document__paper">
      <header><div><p>FormaPrompt</p><h1>Devis {snapshot.quoteNumber}</h1></div><span>{QUOTE_STATUS_LABELS[quote.status]}</span></header>
      <section className="quote-document__parties"><div><h2>Prestataire</h2><p><strong>{snapshot.provider.legalName}</strong><br />{snapshot.provider.address}<br />SIRET : {snapshot.provider.siret}<br />NDA : {snapshot.provider.activityDeclaration}<br />{snapshot.provider.email}</p></div><div><h2>Client</h2><p><strong>{snapshot.client.name}</strong><br />{snapshot.client.organizationName && <>{snapshot.client.organizationName}<br /></>}{snapshot.client.email}</p>{snapshot.beneficiary?.name && <p>Bénéficiaire : {snapshot.beneficiary.name}<br />{snapshot.beneficiary.email}</p>}</div></section>
      <dl><div><dt>Date de création</dt><dd>{new Date(snapshot.createdAt).toLocaleDateString('fr-FR')}</dd></div><div><dt>Valable jusqu’au</dt><dd>{new Date(snapshot.validUntil).toLocaleDateString('fr-FR')}</dd></div></dl>
      <table><thead><tr><th>Formation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody><tr><td>{snapshot.course.title}</td><td>{snapshot.pricing.quantity}</td><td>{formatMoney(snapshot.pricing.unitPriceCents)}</td><td><strong>{formatMoney(snapshot.pricing.totalPriceCents)}</strong></td></tr></tbody></table>
      <p className="quote-document__tax">{snapshot.pricing.taxStatement}</p>
      <footer><p>Bon pour accord — date, nom, qualité et signature du client :</p><div /></footer>
    </article>
  </main>;
}
