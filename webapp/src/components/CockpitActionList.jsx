import { Link } from 'react-router-dom';
import { getActionDestination } from '../lib/cockpitAdministration';

const SEVERITY_LABELS = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Attention',
  low: 'Information',
};

function formatDeadline(action) {
  if (!action.due_at) {
    const days = Math.max(0, Math.floor(Number(action.age_seconds || 0) / 86400));
    return days > 0 ? `Ouvert depuis ${days} j` : 'Détecté récemment';
  }
  const value = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(action.due_at));
  return action.is_overdue ? `En retard depuis le ${value}` : `Échéance le ${value}`;
}

export default function CockpitActionList({ actions }) {
  if (!actions.length) {
    return (
      <div className="cockpit-empty" role="status">
        <strong>Aucune action prioritaire actuellement</strong>
        <span>Les dossiers suivis ne nécessitent pas d’intervention immédiate.</span>
      </div>
    );
  }

  return (
    <ol className="cockpit-actions">
      {actions.map((action) => {
        const destination = getActionDestination(action);
        return (
          <li key={`${action.domain}-${action.item_id}`} className={`cockpit-action is-${action.severity}`}>
            <div className="cockpit-action__content">
              <span className="cockpit-action__badge">{SEVERITY_LABELS[action.severity] || 'À traiter'}</span>
              <strong>{action.neutral_label}</strong>
              <span>{formatDeadline(action)}</span>
            </div>
            {destination && <Link className="cockpit-action__link" to={destination}>Traiter</Link>}
          </li>
        );
      })}
    </ol>
  );
}
