import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { getBookingCourse } from '../data/bookingCatalog'
import { supabase } from '../lib/supabaseClient'
import './WithdrawalRequest.css'

const DECLARATION = 'Je vous informe par la présente de ma décision de me rétracter du contrat identifié ci-dessus.'

function courseLabel(courseId) {
  try {
    return getBookingCourse(courseId).shortTitle
  } catch {
    return courseId
  }
}

export default function WithdrawalRequest() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [form, setForm] = useState({
    purchase_id: '',
    first_name: user?.user_metadata?.first_name || '',
    last_name: user?.user_metadata?.last_name || '',
    acknowledgement_email: user?.email || '',
  })

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false

    async function loadPurchases() {
      const { data, error: purchaseError } = await supabase
        .from('purchases')
        .select('id, course_id, purchased_at')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false })
      if (cancelled) return
      if (purchaseError) setError('Impossible de charger vos commandes pour le moment.')
      else {
        setPurchases(data || [])
        setForm((current) => ({ ...current, purchase_id: current.purchase_id || data?.[0]?.id || '' }))
      }
      setLoading(false)
    }

    loadPurchases()
    return () => { cancelled = true }
  }, [user])

  async function submitRequest(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data, error: requestError } = await supabase.functions.invoke('submit-withdrawal-request', {
        body: { ...form, declaration: DECLARATION },
      })
      if (requestError || !data?.receipt) throw requestError || new Error('Accusé absent')
      setReceipt(data.receipt)
    } catch {
      console.error('withdrawal_request_submission_failed')
      setError('La demande n’a pas pu être enregistrée. Contactez FormaPrompt si le problème persiste.')
    } finally {
      setSubmitting(false)
    }
  }

  function downloadReceipt() {
    if (!receipt) return
    const text = [
      'FormaPrompt — Accusé de réception de rétractation',
      `Référence : ${receipt.id}`,
      `Reçue le : ${new Date(receipt.received_at).toLocaleString('fr-FR')}`,
      `Identité déclarée : ${receipt.claimant_first_name} ${receipt.claimant_last_name}`,
      `Référence de commande/contrat : ${receipt.purchase_id}`,
      `Formation : ${courseLabel(receipt.course_id)}`,
      `Adresse d’accusé : ${receipt.acknowledgement_email}`,
      `Déclaration : ${receipt.declaration}`,
      `Statut : ${receipt.status}`,
      '',
      'Cette réception ne déclenche ni remboursement automatique ni suppression de l’accès. La demande sera instruite.',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `retractation-formaprompt-${receipt.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <SEO
        title="Exercer mon droit de rétractation – FormaPrompt"
        description="Fonctionnalité en ligne pour transmettre une demande de rétractation à FormaPrompt."
        url="https://formaprompt.com/retractation"
      />
      <main className="container section withdrawal-page">
        <h1>Renoncer au contrat ici</h1>
        <p>
          Cette fonctionnalité enregistre votre demande. Elle ne déclenche pas automatiquement un remboursement,
          une suppression de compte ou une modification de votre accès avant instruction.
        </p>

        {!user ? (
          <div className="withdrawal-card">
            <p>Connectez-vous avec le compte utilisé lors de la commande pour identifier le contrat.</p>
            <Link className="btn btn-primary" to="/login">Se connecter</Link>
            <p>Vous pouvez également adresser une déclaration dénuée d’ambiguïté via la page <Link to="/contact">Contact</Link>.</p>
          </div>
        ) : receipt ? (
          <section className="withdrawal-card" aria-live="polite">
            <h2>Demande enregistrée</h2>
            <p><strong>Référence :</strong> {receipt.id}</p>
            <p><strong>Date et heure serveur :</strong> {new Date(receipt.received_at).toLocaleString('fr-FR')}</p>
            <p><strong>Identité déclarée :</strong> {receipt.claimant_first_name} {receipt.claimant_last_name}</p>
            <p><strong>Référence de commande/contrat :</strong> {receipt.purchase_id}</p>
            <p>La déclaration de rétractation a été reçue. Cette réception ne vaut pas acceptation d’un remboursement.</p>
            {receipt.acknowledgement_delivery_status === 'sent' ? (
              <p>L’accusé électronique a été envoyé à {receipt.acknowledgement_email}.</p>
            ) : (
              <p>L’envoi électronique n’a pas pu être confirmé. Votre demande reste enregistrée et l’accusé demeure téléchargeable ci-dessous.</p>
            )}
            <p>Conservez l’accusé de réception sur votre appareil.</p>
            <button type="button" className="btn btn-primary" onClick={downloadReceipt}>Télécharger l’accusé de réception</button>
          </section>
        ) : (
          <form className="withdrawal-card withdrawal-form" onSubmit={submitRequest}>
            <label htmlFor="withdrawal-purchase">Contrat concerné</label>
            <select
              id="withdrawal-purchase"
              value={form.purchase_id}
              onChange={(event) => setForm({ ...form, purchase_id: event.target.value })}
              required
              disabled={loading || purchases.length === 0}
            >
              {purchases.length === 0 && <option value="">Aucune commande disponible</option>}
              {purchases.map((purchase) => (
                <option key={purchase.id} value={purchase.id}>
                  {courseLabel(purchase.course_id)} — {new Date(purchase.purchased_at).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>

            <div className="withdrawal-form__names">
              <label htmlFor="withdrawal-first-name">Prénom</label>
              <input id="withdrawal-first-name" value={form.first_name} maxLength={100} required onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              <label htmlFor="withdrawal-last-name">Nom</label>
              <input id="withdrawal-last-name" value={form.last_name} maxLength={100} required onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
            </div>

            <label htmlFor="withdrawal-email">Adresse électronique pour l’accusé de réception</label>
            <input id="withdrawal-email" type="email" value={form.acknowledgement_email} maxLength={254} required onChange={(event) => setForm({ ...form, acknowledgement_email: event.target.value })} />

            <p className="withdrawal-form__declaration">{DECLARATION}</p>
            {error && <p role="alert" className="withdrawal-form__error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting || loading || purchases.length === 0}>
              {submitting ? 'Enregistrement…' : 'Confirmer la rétractation'}
            </button>
          </form>
        )}
        {error && receipt && <p role="alert" className="withdrawal-form__error">{error}</p>}
      </main>
    </>
  )
}
