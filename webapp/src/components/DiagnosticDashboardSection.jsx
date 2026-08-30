import { CalendarClock, ClipboardList, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getClientDiagnosticState } from '../lib/diagnosticRestitution';

function formatAppointment(booking) {
  if (!booking?.starts_at) return { date: 'À planifier', time: 'Horaire à choisir' };
  const startsAt = new Date(booking.starts_at);
  const endsAt = booking.ends_at ? new Date(booking.ends_at) : null;
  const timeFormatter = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: 'Europe/Paris' });
  return {
    date: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(startsAt),
    time: endsAt ? `${timeFormatter.format(startsAt)} – ${timeFormatter.format(endsAt)}` : timeFormatter.format(startsAt),
  };
}

function questionnaireLabel(diagnostic) {
  if (diagnostic.questionnaire) return 'Transmis';
  if (diagnostic.booking?.status === 'booked') return 'À compléter';
  if (diagnostic.booking?.status === 'completed') return 'Non transmis';
  return 'Après réservation';
}

function restitutionLabel(diagnostic) {
  if (diagnostic.restitution?.status === 'published') return 'Disponible';
  if (diagnostic.booking?.status === 'completed') return 'En préparation';
  return 'Après réalisation';
}

function DiagnosticAction({ diagnostic, action }) {
  if (action === 'book') {
    return <Link className="btn diagnostic-dashboard-card__action" to={`/diagnostic-ia/reserver?order_id=${encodeURIComponent(diagnostic.order.id)}`}>Réserver mon diagnostic</Link>;
  }
  if (action === 'questionnaire') {
    return <Link className="btn diagnostic-dashboard-card__action" to={`/diagnostic-ia/questionnaire?booking_id=${encodeURIComponent(diagnostic.booking.id)}`}>Compléter le questionnaire</Link>;
  }
  if (action === 'restitution') {
    return <Link className="btn diagnostic-dashboard-card__action" to={`/diagnostic-ia/restitution?booking_id=${encodeURIComponent(diagnostic.booking.id)}`}>Consulter ma restitution</Link>;
  }
  return null;
}

export default function DiagnosticDashboardSection({ diagnostics, loading, error }) {
  return (
    <section className="diagnostic-dashboard" aria-labelledby="diagnostic-dashboard-title">
      <header className="diagnostic-dashboard__heading">
        <FileText aria-hidden="true" />
        <div>
          <p>Diagnostic IA Express</p>
          <h2 id="diagnostic-dashboard-title">Mes diagnostics IA</h2>
        </div>
      </header>

      {loading && <p className="diagnostic-dashboard__state" role="status">Chargement de vos diagnostics…</p>}
      {!loading && error && <p className="diagnostic-dashboard__state is-error" role="alert">Vos diagnostics ne peuvent pas être chargés pour le moment.</p>}
      {!loading && !error && diagnostics.length === 0 && <p className="diagnostic-dashboard__state">Vous n’avez aucun Diagnostic IA Express à consulter actuellement.</p>}

      {!loading && !error && diagnostics.length > 0 && (
        <div className="diagnostic-dashboard__grid">
          {diagnostics.map((diagnostic) => {
            const state = getClientDiagnosticState(diagnostic);
            const appointment = formatAppointment(diagnostic.booking);
            return (
              <article className={`diagnostic-dashboard-card is-${state.id}`} key={diagnostic.order.id}>
                <div className="diagnostic-dashboard-card__status"><span>{state.title}</span></div>
                <div className="diagnostic-dashboard-card__appointment">
                  <CalendarClock aria-hidden="true" />
                  <div><strong>{appointment.date}</strong><span>{appointment.time}</span></div>
                </div>
                <dl>
                  <div><dt><ClipboardList aria-hidden="true" /> Questionnaire</dt><dd>{questionnaireLabel(diagnostic)}</dd></div>
                  <div><dt><FileText aria-hidden="true" /> Restitution</dt><dd>{restitutionLabel(diagnostic)}</dd></div>
                </dl>
                <DiagnosticAction diagnostic={diagnostic} action={state.action} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
