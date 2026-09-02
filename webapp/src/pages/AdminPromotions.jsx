import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  PROMOTION_TARGET_OPTIONS, createPromotion, formatPromotionDiscount, listPromotions,
  promotionStatus, setPromotionActive, updatePromotion,
} from '../lib/promotionAdministration';
import './AdminPromotions.css';

const EMPTY_DRAFT = {
  code: '', description: '', discount_type: 'percent', discount_value: '', active: true,
  starts_at: '', ends_at: '', max_uses: '', max_uses_per_user: '', restricted_email: '',
  minimum_final_amount_cents: '', targets: [],
};

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function centsToEuros(value) {
  if (value === null || value === undefined) return '';
  return `${Math.trunc(Number(value) / 100)},${String(Math.abs(Number(value)) % 100).padStart(2, '0')}`;
}

function promotionToDraft(promotion) {
  return {
    code: promotion.code,
    description: promotion.description || '',
    discount_type: promotion.discount_type,
    discount_value: promotion.discount_type === 'fixed_amount'
      ? centsToEuros(promotion.discount_value) : String(promotion.discount_value),
    active: promotion.active,
    starts_at: toLocalDateTime(promotion.starts_at),
    ends_at: toLocalDateTime(promotion.ends_at),
    max_uses: promotion.max_uses ?? '',
    max_uses_per_user: promotion.max_uses_per_user ?? '',
    restricted_email: promotion.restricted_email || '',
    minimum_final_amount_cents: centsToEuros(promotion.minimum_final_amount_cents),
    targets: promotion.targets || [],
  };
}

function targetFingerprint(target) {
  return `${target.target_type}:${target.target_key}`;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sans limite';
}

function PromotionForm({ promotion, onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => promotion ? promotionToDraft(promotion) : { ...EMPTY_DRAFT });
  const [errors, setErrors] = useState({});
  const [technicalError, setTechnicalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [productKey, setProductKey] = useState('');
  const selectedTargets = useMemo(() => new Set(draft.targets.map(targetFingerprint)), [draft.targets]);

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleTarget(target) {
    const key = targetFingerprint(target);
    setDraft((current) => {
      const present = current.targets.some((item) => targetFingerprint(item) === key);
      if (present) return { ...current, targets: current.targets.filter((item) => targetFingerprint(item) !== key) };
      if (target.target_type === 'all') return { ...current, targets: [target] };
      return { ...current, targets: [...current.targets.filter((item) => item.target_type !== 'all'), target] };
    });
  }

  function addProduct() {
    const target = { target_type: 'product', target_key: productKey.trim().toLowerCase() };
    if (!target.target_key) return;
    if (!selectedTargets.has(targetFingerprint(target))) toggleTarget(target);
    setProductKey('');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setTechnicalError('');
    try {
      const result = promotion
        ? await updatePromotion(supabase, promotion.id, draft)
        : await createPromotion(supabase, draft);
      if (Object.keys(result.errors || {}).length) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      await onSaved();
    } catch (error) {
      setTechnicalError(error.message || 'La promotion n’a pas pu être enregistrée.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="promotion-form" onSubmit={submit} noValidate>
      <div className="promotion-form__heading">
        <div><p>Paramètres serveur</p><h2>{promotion ? `Modifier ${promotion.code}` : 'Créer une promotion'}</h2></div>
        <button type="button" className="promotion-button is-secondary" onClick={onCancel}>Annuler</button>
      </div>
      {technicalError && <p className="promotion-alert" role="alert">{technicalError}</p>}
      <div className="promotion-form__grid">
        <label>Code
          <input name="code" value={draft.code} onChange={updateField} disabled={Boolean(promotion)} autoComplete="off" />
          {promotion && <small>Le code est immuable. Créez une nouvelle promotion pour le remplacer.</small>}
          {errors.code && <span className="promotion-field-error">{errors.code}</span>}
        </label>
        <label>Description
          <input name="description" value={draft.description} onChange={updateField} maxLength="2000" />
        </label>
        <label>Type de remise
          <select name="discount_type" value={draft.discount_type} onChange={updateField}>
            <option value="percent">Pourcentage</option>
            <option value="fixed_amount">Montant fixe</option>
          </select>
        </label>
        <label>{draft.discount_type === 'percent' ? 'Pourcentage' : 'Montant fixe (€)'}
          <input name="discount_value" inputMode="decimal" value={draft.discount_value} onChange={updateField} />
          {errors.discount_value && <span className="promotion-field-error">{errors.discount_value}</span>}
        </label>
        <label>Début
          <input type="datetime-local" name="starts_at" value={draft.starts_at} onChange={updateField} />
        </label>
        <label>Fin
          <input type="datetime-local" name="ends_at" value={draft.ends_at} onChange={updateField} />
          {errors.ends_at && <span className="promotion-field-error">{errors.ends_at}</span>}
        </label>
        <label>Quota global
          <input type="number" min="1" step="1" name="max_uses" value={draft.max_uses} onChange={updateField} />
          {errors.max_uses && <span className="promotion-field-error">{errors.max_uses}</span>}
        </label>
        <label>Quota par utilisateur
          <input type="number" min="1" step="1" name="max_uses_per_user" value={draft.max_uses_per_user} onChange={updateField} />
          {errors.max_uses_per_user && <span className="promotion-field-error">{errors.max_uses_per_user}</span>}
        </label>
        <label>Restriction e-mail
          <input type="email" name="restricted_email" value={draft.restricted_email} onChange={updateField} autoComplete="off" />
          {errors.restricted_email && <span className="promotion-field-error">{errors.restricted_email}</span>}
        </label>
        <label>Montant final minimum (€)
          <input name="minimum_final_amount_cents" inputMode="decimal" value={draft.minimum_final_amount_cents} onChange={updateField} />
          {errors.minimum_final_amount_cents && <span className="promotion-field-error">{errors.minimum_final_amount_cents}</span>}
        </label>
      </div>
      {!promotion && <label className="promotion-form__active"><input type="checkbox" name="active" checked={draft.active} onChange={updateField} /> Activer dès que les dates le permettent</label>}
      <fieldset className="promotion-targets">
        <legend>Cibles</legend>
        <p>Choisissez des identifiants métier stables. Les formations sont raccordées ; la cible Diagnostic reste indisponible dans cette release.</p>
        <div className="promotion-targets__options">
          {PROMOTION_TARGET_OPTIONS.map((target) => (
            <label key={targetFingerprint(target)}>
              <input type="checkbox" checked={selectedTargets.has(targetFingerprint(target))} onChange={() => toggleTarget(target)} />
              {target.label}<small>{target.target_type} / {target.target_key}</small>
            </label>
          ))}
        </div>
        <div className="promotion-product-target">
          <label>Identifiant produit futur
            <input value={productKey} onChange={(event) => setProductKey(event.target.value)} placeholder="ex. audit-ia-2027" />
          </label>
          <button type="button" className="promotion-button is-secondary" onClick={addProduct}>Ajouter le produit</button>
        </div>
        {draft.targets.filter((target) => target.target_type === 'product').map((target) => (
          <button key={targetFingerprint(target)} type="button" className="promotion-target-chip" onClick={() => toggleTarget(target)}>
            {target.target_key} <span aria-hidden="true">×</span><span className="sr-only">Retirer</span>
          </button>
        ))}
        {errors.targets && <p className="promotion-field-error">{errors.targets}</p>}
      </fieldset>
      <button className="promotion-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la promotion'}</button>
    </form>
  );
}

export default function AdminPromotions() {
  const { role } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setPromotions(await listPromotions(supabase)); }
    catch (loadError) { setError(loadError.message || 'Les promotions ne peuvent pas être chargées.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (role !== 'admin') return undefined;
    const timeoutId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load, role]);

  async function saved() {
    setCreating(false); setEditing(null); await load();
  }

  async function toggleActive(promotion) {
    const action = promotion.active ? 'désactiver' : 'réactiver';
    if (promotion.active && !window.confirm(`Désactiver ${promotion.code} ? Les nouvelles réservations seront refusées.`)) return;
    setPendingAction(promotion.id);
    setError('');
    try { await setPromotionActive(supabase, promotion.id, !promotion.active); await load(); }
    catch (actionError) { setError(actionError.message || `Impossible de ${action} la promotion.`); }
    finally { setPendingAction(''); }
  }

  if (role !== 'admin') return <main className="container admin-promotions"><div className="promotion-alert" role="alert"><h1>Accès réservé</h1><p>La gestion des promotions est réservée à un administrateur strict.</p></div></main>;

  return (
    <main className="container admin-promotions">
      <header className="promotion-header">
        <div><p className="promotion-eyebrow">Moteur transversal FormaPrompt</p><h1>Promotions</h1><p>Gérez les campagnes sans modifier les prix catalogue Stripe.</p></div>
        {!creating && !editing && <button type="button" className="promotion-button" onClick={() => setCreating(true)}>Créer une promotion</button>}
      </header>
      {(creating || editing) && <PromotionForm promotion={editing} onCancel={() => { setCreating(false); setEditing(null); }} onSaved={saved} />}
      {loading && <p className="promotion-status" role="status">Chargement des promotions…</p>}
      {!loading && error && <div className="promotion-alert" role="alert"><p>{error}</p><button type="button" onClick={load}>Réessayer</button></div>}
      {!loading && !error && !promotions.length && <p className="promotion-empty">Aucune promotion enregistrée.</p>}
      {!loading && !error && promotions.length > 0 && (
        <div className="promotion-table-wrap">
          <table className="promotion-table">
            <caption className="sr-only">Promotions FormaPrompt</caption>
            <thead><tr><th>Code / remise</th><th>Cibles</th><th>Période</th><th>Utilisations</th><th>État</th><th>Actions</th></tr></thead>
            <tbody>{promotions.map((promotion) => (
              <tr key={promotion.id}>
                <td><strong>{promotion.code}</strong><span>{formatPromotionDiscount(promotion)}</span>{promotion.description && <small>{promotion.description}</small>}</td>
                <td><ul>{(promotion.targets || []).map((target) => <li key={targetFingerprint(target)}>{target.target_type} / {target.target_key}</li>)}</ul></td>
                <td><span>Du {formatDate(promotion.starts_at)}</span><span>au {formatDate(promotion.ends_at)}</span></td>
                <td><span>{promotion.consumed_uses} consommée(s)</span><span>{promotion.active_reservations} réservée(s)</span><span>{promotion.released_uses} libérée(s)</span>{promotion.remaining_uses !== null && <small>{promotion.remaining_uses} restante(s)</small>}</td>
                <td><span className={`promotion-state is-${promotionStatus(promotion).toLowerCase().replace(' ', '-')}`}>{promotionStatus(promotion)}</span>{promotion.restricted_email_present && <small>Restriction e-mail</small>}</td>
                <td><button type="button" className="promotion-link-button" onClick={() => { setCreating(false); setEditing(promotion); }}>Modifier</button><button type="button" className="promotion-link-button" disabled={pendingAction === promotion.id} onClick={() => toggleActive(promotion)}>{promotion.active ? 'Désactiver' : 'Réactiver'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
