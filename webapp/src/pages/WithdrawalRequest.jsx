import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { getBookingCourse } from '../data/bookingCatalog'
import { supabase } from '../lib/supabaseClient'
import './WithdrawalRequest.css'

const DECLARATION = 'Je vous informe par la présente de ma décision de me rétracter du contrat identifié ci-dessus.'

function courseLabel(courseId) {
  if (courseId === 'diagnostic-ia-express') return 'Diagnostic IA Express'
  try {
    return getBookingCourse(courseId).shortTitle
  } catch {
    return courseId
  }
}

export default function WithdrawalRequest() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [form, setForm] = useState({
    contract_reference: '',
    first_name: user?.user_metadata?.first_name || '',
    last_name: user?.user_metadata?.last_name || '',
    acknowledgement_email: user?.email || '',
  })

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false

    async function loadContracts() {
      const [purchaseResult, diagnosticResult] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, course_id, purchased_at')
          .eq('user_id', user.id)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('diagnostic_ia_orders')
          .select('id, paid_at, status, sales_context')
          .eq('user_id', user.id)
          .eq('sales_context', 'personal')
          .in('status', ['paid', 'disputed'])
          .order('paid_at', { ascending: false }),
      ])
      if (cancelled) return
      if (purchaseResult.error || diagnosticResult.error) setError('Impossible de charger vos commandes pour le moment.')
      else {
        const availableContracts = [
          ...(purchaseResult.data || []).map((purchase) => ({
            reference: `purchase:${purchase.id}`,
            id: purchase.id,
            type: 'purchase',
            label: courseLabel(purchase.course_id),
            date: purchase.purchased_at,
          })),
          ...(diagnosticResult.data || []).map((order) => ({
            reference: `diagnostic:${order.id}`,
            id: order.id,
            type: 'diagnostic',
            label: 'Diagnostic IA Express',
            date: order.paid_at,
          })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date))
        setContracts(availableContracts)
        setForm((current) => ({
          ...current,
          contract_reference: current.contract_reference || availableContracts[0]?.reference || '',
        }))
      }
      setLoading(false)
    }

    loadContracts()
    return () => { cancelled = true }
  }, [user])

  async function submitRequest(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const [contractType, contractId] = form.contract_reference.split(':')
      const contractPayload = contractType === 'diagnostic'
        ? { diagnostic_order_id: contractId }
        : { purchase_id: contractId }
      const { data, error: requestError } = await supabase.functions.invoke('submit-withdrawal-request', {
        body: {
          ...contractPayload,
          first_name: form.first_name,
          last_name: form.last_name,
          acknowledgement_email: form.acknowledgement_email,
          declaration: DECLARATION,
        },
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
      `Référence de commande/contrat : ${receipt.diagnostic_order_id || receipt.purchase_id}`,
      `Prestation : ${courseLabel(receipt.course_id)}`,
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
        robots="noindex, nofollow"
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
            <p><strong>Référence de commande/contrat :</strong> {receipt.diagnostic_order_id || receipt.purchase_id}</p>
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
              value={form.contract_reference}
              onChange={(event) => setForm({ ...form, contract_reference: event.target.value })}
              required
              disabled={loading || contracts.length === 0}
            >
              {contracts.length === 0 && <option value="">Aucune commande disponible</option>}
              {contracts.map((contract) => (
                <option key={contract.reference} value={contract.reference}>
                  {contract.label} — {new Date(contract.date).toLocaleDateString('fr-FR')}
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
            <button type="submit" className="btn btn-primary" disabled={submitting || loading || contracts.length === 0}>
              {submitting ? 'Enregistrement…' : 'Confirmer la rétractation'}
            </button>
          </form>
        )}
        {error && receipt && <p role="alert" className="withdrawal-form__error">{error}</p>}
      </main>
    </>
  )
}
