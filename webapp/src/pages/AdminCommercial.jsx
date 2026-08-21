import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  COMMERCIAL_COURSES,
  defaultValidUntil,
  filterCommercialRequests,
  formatMoney,
  localDateTime,
  QUOTE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from '../lib/commercialAdministration';
import './AdminCommercial.css';

function qualificationFrom(request) {
  return {
    status: request.status,
    requestType: request.request_type,
    courseId: request.course_id || '',
    organizationName: request.organization_name || '',
    beneficiaryName: request.beneficiary_name || '',
    beneficiaryEmail: request.beneficiary_email || '',
    fundingRequested: request.funding_requested,
    administrativeNotes: request.administrative_notes || '',
  };
}

function quoteFrom(request) {
  const courseId = request.course_id || 'formation-ia';
  return {
    clientName: request.name,
    clientEmail: request.email,
    organizationName: request.organization_name || '',
    beneficiaryName: request.beneficiary_name || '',
    beneficiaryEmail: request.beneficiary_email || '',
    courseId,
    quantity: 1,
    unitPriceCents: COMMERCIAL_COURSES[courseId].priceAmountCents,
    validUntil: defaultValidUntil(),
    draftNotes: '',
  };
}

function enrollmentFrom(request, quote) {
  const courseId = quote?.course_id || request.course_id || 'formation-ia';
  const course = COMMERCIAL_COURSES[courseId];
  const names = (request.beneficiary_name || request.name).trim().split(/\s+/);
  return {
    targetUserId: '', learnerEmail: request.beneficiary_email || request.email,
    learnerFirstName: names.shift() || '', learnerLastName: names.join(' ') || '-',
    learnerJobTitle: '', learnerPhone: '', learnerAddressLine1: '', learnerPostalCode: '', learnerCity: '',
    organizationName: request.organization_name || '', courseId, enrollmentSource: request.organization_name ? 'company' : 'manual',
    fundingMode: request.funding_requested ? 'other' : (request.organization_name ? 'company' : 'self_funded'),
    funderName: '', fundingReference: '', deliveryMode: 'remote', trainingLocation: '', remoteAccessDetails: '',
    startsAt: localDateTime(24 * 7), endsAt: localDateTime(24 * 7 + course.durationMinutes / 60),
    durationMinutes: course.durationMinutes, priceAmountCents: quote?.total_price_cents ?? course.priceAmountCents,
    administrativeNotes: `Conversion de la demande commerciale ${request.id}`,
  };
}

export default function AdminCommercial() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const selectedIdRef = useRef('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qualification, setQualification] = useState(null);
  const [quoteForm, setQuoteForm] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({ scheduledFor: localDateTime(48), subject: 'Suivi de votre projet de formation', message: '' });
  const [enrollment, setEnrollment] = useState(null);
  const [stripePurchaseId, setStripePurchaseId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [running, setRunning] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      supabase.from('contact_requests').select('*').order('updated_at', { ascending: false }),
      supabase.from('commercial_quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('commercial_request_history').select('*').order('created_at', { ascending: false }),
      supabase.from('commercial_communications').select('*').order('prepared_at', { ascending: false }),
      supabase.from('commercial_follow_ups').select('*').order('scheduled_for', { ascending: false }),
      supabase.from('purchases').select('id,user_id,course_id,payment_status,purchased_at').eq('payment_status', 'paid').order('purchased_at', { ascending: false }),
      supabase.from('profiles').select('id,email,role').eq('role', 'user'),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) setFeedback({ type: 'error', message: 'Le module commercial ne peut pas être chargé. Appliquez la migration Sprint 3 localement.' });
    setRequests(results[0].data || []); setQuotes(results[1].data || []);
    setHistory(results[2].data || []); setCommunications(results[3].data || []);
    setFollowUps(results[4].data || []); setPurchases(results[5].data || []); setProfiles(results[6].data || []);
    const nextSelectedId = selectedIdRef.current || results[0].data?.[0]?.id || '';
    selectedIdRef.current = nextSelectedId;
    setSelectedId(nextSelectedId);
    const nextSelected = (results[0].data || []).find((item) => item.id === nextSelectedId);
    const nextAcceptedQuote = (results[1].data || []).find((item) => item.contact_request_id === nextSelectedId && item.status === 'accepted');
    if (nextSelected) {
      setQualification(qualificationFrom(nextSelected));
      setQuoteForm(quoteFrom(nextSelected));
      setEnrollment(enrollmentFrom(nextSelected, nextAcceptedQuote));
      setStripePurchaseId('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user || !['admin', 'employee'].includes(role)) { navigate('/dashboard'); return; }
    const task = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(task);
  }, [user, role, navigate, loadData]);

  const selected = requests.find((request) => request.id === selectedId);
  const selectedQuotes = quotes.filter((quote) => quote.contact_request_id === selectedId);
  const selectedHistory = history.filter((item) => item.contact_request_id === selectedId);
  const selectedCommunications = communications.filter((item) => item.contact_request_id === selectedId);
  const selectedFollowUps = followUps.filter((item) => item.contact_request_id === selectedId);
  const acceptedQuote = selectedQuotes.find((quote) => quote.status === 'accepted');
  const matchingPurchases = purchases.filter((purchase) => {
    const profile = profiles.find((item) => item.id === purchase.user_id);
    return profile?.email?.toLowerCase() === selected?.email?.toLowerCase()
      && (!selected?.course_id || selected.course_id === purchase.course_id);
  });
  const filtered = useMemo(() => filterCommercialRequests(requests, search, statusFilter), [requests, search, statusFilter]);

  function selectRequest(request) {
    selectedIdRef.current = request.id;
    setSelectedId(request.id);
    setQualification(qualificationFrom(request));
    setQuoteForm(quoteFrom(request));
    setEnrollment(enrollmentFrom(request, quotes.find((quote) => quote.contact_request_id === request.id && quote.status === 'accepted')));
    setStripePurchaseId('');
  }

  async function invoke(action, payload = {}) {
    setRunning(action); setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-commercial-cycle', {
      body: { action, requestId: selectedId, ...payload },
    });
    if (error || data?.error) {
      setFeedback({ type: 'error', message: data?.error || 'Action impossible.' });
      setRunning(''); return false;
    }
    setFeedback({ type: 'success', message: 'Action enregistrée dans l’historique commercial.' });
    await loadData(); setRunning(''); return true;
  }

  function update(objectSetter, field, value) {
    objectSetter((current) => ({ ...current, [field]: value }));
  }

  async function saveQualification(event) {
    event.preventDefault();
    await invoke('update_request', { request: qualification });
  }

  async function createQuote(event) {
    event.preventDefault();
    await invoke('create_quote', { quote: { ...quoteForm, quantity: Number(quoteForm.quantity), unitPriceCents: Number(quoteForm.unitPriceCents) } });
  }

  async function convertAdministrative(event) {
    event.preventDefault(); setRunning('convert_administrative'); setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-manage-enrollment', {
      body: {
        action: 'create_enrollment', commercialRequestId: selected.id,
        commercialQuoteId: acceptedQuote?.id,
        enrollment: {
          ...enrollment, startsAt: new Date(enrollment.startsAt).toISOString(),
          endsAt: new Date(enrollment.endsAt).toISOString(), durationMinutes: Number(enrollment.durationMinutes),
          priceAmountCents: Number(enrollment.priceAmountCents),
        },
      },
    });
    if (error || data?.error) setFeedback({ type: 'error', message: data?.error || 'Conversion administrative impossible.' });
    else { setFeedback({ type: 'success', message: 'Inscription créée via le système existant et demande convertie.' }); await loadData(); }
    setRunning('');
  }

  if (!user || !['admin', 'employee'].includes(role)) return null;
  return (
    <main className="admin-commercial container section">
      <header className="admin-commercial__header">
        <div><p>Administration FormaPrompt</p><h1>Cycle commercial</h1><span>Demande → qualification → devis → relance → inscription</span></div>
        <Link className="btn" to="/admin">Retour à l’administration</Link>
      </header>
      {feedback && <div className={`admin-commercial__feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}
      <div className="admin-commercial__layout">
        <aside className="admin-commercial__sidebar" aria-label="Demandes commerciales">
          <label>Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail, sujet…" /></label>
          <label>Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous</option>{Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {loading ? <p role="status">Chargement…</p> : filtered.length === 0 ? <p>Aucune demande.</p> : (
            <ul>{filtered.map((request) => <li key={request.id}><button type="button" className={request.id === selectedId ? 'is-selected' : ''} onClick={() => selectRequest(request)}><strong>{request.name}</strong><span>{request.email}</span><em className={`is-${request.status}`}>{REQUEST_STATUS_LABELS[request.status]}</em></button></li>)}</ul>
          )}
        </aside>
        <section className="admin-commercial__detail">
          {!selected ? <p>Sélectionnez une demande.</p> : <>
            <header className="admin-commercial__request-header"><div><h2>{selected.name}</h2><p>{selected.email} · {REQUEST_TYPE_LABELS[selected.request_type]}</p></div><span className={`admin-commercial__badge is-${selected.status}`}>{REQUEST_STATUS_LABELS[selected.status]}</span></header>
            <article className="admin-commercial__message"><strong>{selected.subject}</strong><p>{selected.message}</p><small>Reçue le {new Date(selected.created_at).toLocaleString('fr-FR')}</small></article>

            <details open><summary>Qualification et notes</summary>
              <form className="admin-commercial__form" onSubmit={saveQualification}>
                <label>Type<select value={qualification?.requestType || ''} onChange={(e) => update(setQualification, 'requestType', e.target.value)}>{Object.entries(REQUEST_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Statut<select value={qualification?.status || ''} onChange={(e) => update(setQualification, 'status', e.target.value)}>{Object.entries(REQUEST_STATUS_LABELS).filter(([v]) => v !== 'won').map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Formation<select value={qualification?.courseId || ''} onChange={(e) => update(setQualification, 'courseId', e.target.value)}><option value="">À qualifier</option>{Object.entries(COMMERCIAL_COURSES).map(([v,c]) => <option key={v} value={v}>{c.title}</option>)}</select></label>
                <label>Organisation<input maxLength="200" value={qualification?.organizationName || ''} onChange={(e) => update(setQualification, 'organizationName', e.target.value)} /></label>
                <label>Bénéficiaire<input maxLength="200" value={qualification?.beneficiaryName || ''} onChange={(e) => update(setQualification, 'beneficiaryName', e.target.value)} /></label>
                <label>E-mail bénéficiaire<input type="email" maxLength="320" value={qualification?.beneficiaryEmail || ''} onChange={(e) => update(setQualification, 'beneficiaryEmail', e.target.value)} /></label>
                <label className="admin-commercial__check"><input type="checkbox" checked={Boolean(qualification?.fundingRequested)} onChange={(e) => update(setQualification, 'fundingRequested', e.target.checked)} /> Financement demandé</label>
                <label className="is-wide">Notes administratives<textarea rows="3" maxLength="4000" value={qualification?.administrativeNotes || ''} onChange={(e) => update(setQualification, 'administrativeNotes', e.target.value)} /></label>
                <button className="btn btn-primary" disabled={Boolean(running)}>Enregistrer la qualification</button>
              </form>
            </details>

            <details open><summary>Devis</summary>
              <form className="admin-commercial__form" onSubmit={createQuote}>
                <label>Client<input required maxLength="200" value={quoteForm?.clientName || ''} onChange={(e) => update(setQuoteForm, 'clientName', e.target.value)} /></label>
                <label>E-mail<input required type="email" maxLength="320" value={quoteForm?.clientEmail || ''} onChange={(e) => update(setQuoteForm, 'clientEmail', e.target.value)} /></label>
                <label>Formation<select value={quoteForm?.courseId || ''} onChange={(e) => { const course = COMMERCIAL_COURSES[e.target.value]; setQuoteForm((current) => ({ ...current, courseId: e.target.value, unitPriceCents: course.priceAmountCents })); }}>{Object.entries(COMMERCIAL_COURSES).map(([v,c]) => <option key={v} value={v}>{c.title}</option>)}</select></label>
                <label>Quantité<input type="number" min="1" max="1000" value={quoteForm?.quantity || 1} onChange={(e) => update(setQuoteForm, 'quantity', e.target.value)} /></label>
                <label>Prix unitaire (€)<input type="number" min="0" step="1" value={(quoteForm?.unitPriceCents || 0) / 100} onChange={(e) => update(setQuoteForm, 'unitPriceCents', Math.round(Number(e.target.value) * 100))} /></label>
                <label>Valide jusqu’au<input type="date" required value={quoteForm?.validUntil || ''} onChange={(e) => update(setQuoteForm, 'validUntil', e.target.value)} /></label>
                <button className="btn btn-primary" disabled={Boolean(running) || ['won','lost'].includes(selected.status)}>Créer le devis</button>
              </form>
              <div className="admin-commercial__cards">{selectedQuotes.map((quote) => <article key={quote.id}><header><strong>{quote.quote_number}</strong><span>{QUOTE_STATUS_LABELS[quote.status]}</span></header><p>{quote.course_title} · {formatMoney(quote.total_price_cents)}</p><div><Link to={`/admin/commercial/devis/${quote.id}`}>Ouvrir / imprimer</Link>{quote.status === 'draft' && <button onClick={() => invoke('send_quote', { quoteId: quote.id })} disabled={Boolean(running)}>Envoyer</button>}{quote.status === 'sent' && <><button onClick={() => invoke('set_quote_status', { quoteId: quote.id, status: 'accepted' })} disabled={Boolean(running)}>Accepter</button><button onClick={() => invoke('set_quote_status', { quoteId: quote.id, status: 'refused' })} disabled={Boolean(running)}>Refuser</button></>}</div></article>)}</div>
            </details>

            <details><summary>Communications et relances</summary>
              <form className="admin-commercial__form" onSubmit={(event) => { event.preventDefault(); invoke('schedule_follow_up', followUpForm); }}>
                <label>Date prévue<input type="datetime-local" required value={followUpForm.scheduledFor} onChange={(e) => update(setFollowUpForm, 'scheduledFor', e.target.value)} /></label>
                <label>Objet<input required maxLength="300" value={followUpForm.subject} onChange={(e) => update(setFollowUpForm, 'subject', e.target.value)} /></label>
                <label className="is-wide">Message<textarea required rows="4" maxLength="10000" value={followUpForm.message} onChange={(e) => update(setFollowUpForm, 'message', e.target.value)} /></label>
                <button className="btn" disabled={Boolean(running) || ['won','lost'].includes(selected.status)}>Programmer sans envoi automatique</button>
              </form>
              <div className="admin-commercial__timeline">{selectedFollowUps.map((item) => <article key={item.id}><strong>Relance {item.status}</strong><span>{new Date(item.scheduled_for).toLocaleString('fr-FR')}</span>{item.status === 'scheduled' && <button onClick={() => invoke('send_follow_up', { followUpId: item.id })} disabled={Boolean(running)}>Déclencher l’envoi</button>}</article>)}{selectedCommunications.map((item) => <article key={item.id}><strong>{item.communication_type} · {item.delivery_status}</strong><span>{item.subject} — {new Date(item.prepared_at).toLocaleString('fr-FR')}</span></article>)}</div>
            </details>

            <details><summary>Conversion en inscription</summary>
              <section className="admin-commercial__conversion"><h3>Paiement direct Stripe</h3><p>Cette action vérifie l’achat et le droit actif existants, sans les recréer.</p><select value={stripePurchaseId} onChange={(e) => setStripePurchaseId(e.target.value)}><option value="">Sélectionner un achat payé</option>{matchingPurchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{COMMERCIAL_COURSES[purchase.course_id]?.title} · {new Date(purchase.purchased_at).toLocaleDateString('fr-FR')}</option>)}</select><button className="btn" disabled={!stripePurchaseId || Boolean(running)} onClick={() => invoke('convert_stripe', { purchaseId: stripePurchaseId })}>Lier l’achat existant</button></section>
              <form className="admin-commercial__form" onSubmit={convertAdministrative}><h3 className="is-wide">Inscription administrative {acceptedQuote ? `— devis ${acceptedQuote.quote_number}` : 'sans devis accepté'}</h3>
                <label>Prénom<input required value={enrollment?.learnerFirstName || ''} onChange={(e) => update(setEnrollment, 'learnerFirstName', e.target.value)} /></label><label>Nom<input required value={enrollment?.learnerLastName || ''} onChange={(e) => update(setEnrollment, 'learnerLastName', e.target.value)} /></label>
                <label>E-mail<input required type="email" value={enrollment?.learnerEmail || ''} onChange={(e) => update(setEnrollment, 'learnerEmail', e.target.value)} /></label>
                <label>Début<input required type="datetime-local" value={enrollment?.startsAt || ''} onChange={(e) => update(setEnrollment, 'startsAt', e.target.value)} /></label><label>Fin<input required type="datetime-local" value={enrollment?.endsAt || ''} onChange={(e) => update(setEnrollment, 'endsAt', e.target.value)} /></label>
                <button className="btn btn-primary" disabled={Boolean(running) || ['won','lost'].includes(selected.status) || (selectedQuotes.length > 0 && !acceptedQuote)}>Convertir via le dossier d’inscription existant</button>
              </form>
            </details>

            <details><summary>Historique complet</summary><ol className="admin-commercial__history">{selectedHistory.map((item) => <li key={item.id}><strong>{item.event_type}</strong><span>{new Date(item.created_at).toLocaleString('fr-FR')}</span>{item.previous_status && <small>{REQUEST_STATUS_LABELS[item.previous_status]} → {REQUEST_STATUS_LABELS[item.new_status]}</small>}</li>)}</ol></details>
          </>}
        </section>
      </div>
    </main>
  );
}
