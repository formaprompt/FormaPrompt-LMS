import { useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isProtectedAccount, isRoleConflictError, isRolePermissionError, isRoleProtectedError, setAdminUserRole, USER_ROLE_LABELS } from '../lib/adminUserRolesApi';
import './AdminUserRoleControl.css';

const saveRole = (input) => setAdminUserRole(supabase, input);

export default function AdminUserRoleControl({ learner, disabled, onSaved, onPermissionDenied, onRefresh, updateRole = saveRole }) {
  const id = useId();
  const [selectedRole, setSelectedRole] = useState(learner.role || '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [serverProtected, setServerProtected] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);
  const confirmButton = useRef(null);
  const saveButton = useRef(null);
  const protectedAccount = serverProtected || isProtectedAccount(learner);
  const knownRole = Object.hasOwn(USER_ROLE_LABELS, learner.role);
  const blocked = disabled || busy || protectedAccount || conflict || !knownRole;
  const displayName = learner.fullName || learner.email;

  async function save() {
    if (pending.current || blocked || selectedRole === learner.role) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await updateRole({ userId: learner.userId, role: selectedRole, expectedRole: learner.role });
      setConfirming(false);
      await onSaved?.(result);
    } catch (error) {
      setConfirming(false);
      if (isRoleProtectedError(error)) {
        setServerProtected(true);
        setMessage('Ce compte est protégé par le serveur. Son rôle ne peut pas être rétrogradé.');
      } else if (isRolePermissionError(error)) {
        setMessage('Le serveur refuse cette modification. Vérifiez vos droits administrateur.');
        onPermissionDenied?.();
      } else if (isRoleConflictError(error)) {
        setConflict(true);
        setMessage('Le rôle a changé depuis le chargement. Actualisez l’annuaire avant de réessayer.');
      } else {
        setConflict(true);
        setMessage('Le changement de rôle n’a pas pu être confirmé. Actualisez l’annuaire pour vérifier le rôle.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function requestSave(event) {
    event.preventDefault();
    if (blocked || selectedRole === learner.role) return;
    setMessage('');
    setConfirming(true);
    window.setTimeout(() => confirmButton.current?.focus(), 0);
  }

  function cancel() {
    if (busy) return;
    setConfirming(false);
    saveButton.current?.focus();
  }

  return (
    <div className="admin-user-role">
      {protectedAccount && <p className="admin-user-role__protected">Compte protégé</p>}
      <form onSubmit={requestSave}>
        <label htmlFor={id}>Rôle de {displayName}</label>
        <div className="admin-user-role__fields">
          <select id={id} value={selectedRole} disabled={blocked || confirming} onChange={(event) => { setSelectedRole(event.target.value); setMessage(''); }}>
            {!knownRole && <option value={learner.role || ''}>Rôle inconnu</option>}
            {Object.entries(USER_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button ref={saveButton} type="submit" className="btn" disabled={blocked || confirming || selectedRole === learner.role}>Enregistrer le rôle</button>
        </div>
        <p className="admin-user-role__help">Le rôle Formateur / collaborateur reprend les droits du rôle Employé existant.</p>
      </form>
      {confirming && <div className="admin-user-role__confirmation" role="dialog" aria-labelledby={`${id}-confirmation`} aria-describedby={`${id}-details`} aria-busy={busy} onKeyDown={(event) => { if (event.key === 'Escape') cancel(); }}>
        <p id={`${id}-confirmation`}><strong>Confirmer le changement de rôle</strong></p>
        <p id={`${id}-details`}>{displayName} : {USER_ROLE_LABELS[learner.role]} → {USER_ROLE_LABELS[selectedRole]}.{selectedRole === 'admin' ? ' Ce compte pourra administrer le site.' : learner.role === 'admin' ? ' Ce compte perdra ses droits administrateur.' : ''}</p>
        <div className="admin-user-role__fields">
          <button ref={confirmButton} type="button" className="btn btn-primary" disabled={busy || disabled} onClick={save}>{busy ? 'Enregistrement…' : 'Confirmer le rôle'}</button>
          <button type="button" className="btn" disabled={busy} onClick={cancel}>Annuler</button>
        </div>
      </div>}
      {message && <p role="alert">{message}</p>}
      {!knownRole && <p role="alert">Le rôle actuel est inconnu. La modification est désactivée ; vérifiez ce compte avant de continuer.</p>}
      {conflict && onRefresh && <button type="button" className="btn" disabled={disabled || busy} onClick={onRefresh}>Actualiser l’annuaire</button>}
    </div>
  );
}
