import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  FolderCheck,
  GraduationCap,
  PenLine,
} from 'lucide-react';

const ICONS = {
  attendance: PenLine,
  'unscheduled-hours': CalendarClock,
  'upcoming-sessions': CalendarDays,
  availability: CalendarPlus,
  'training-readiness': ClipboardCheck,
  'upcoming-trainings': GraduationCap,
  'current-recent-trainings': BookOpenCheck,
  'training-closing': FolderCheck,
  questionnaires: ClipboardList,
  evaluations: BadgeCheck,
};

const MAX_VISIBLE_ITEMS = 5;

function OperationalCard({ section }) {
  const Icon = ICONS[section.id] || ClipboardList;
  const visibleItems = section.items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = Math.max(0, section.items.length - visibleItems.length);

  return (
    <article className={`cockpit-operation-card is-${section.tone}${section.wide ? ' is-wide' : ''}`}>
      <header>
        <div>
          <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
          <h3>{section.title}</h3>
        </div>
        <span aria-label={`${section.count} élément${section.count === 1 ? '' : 's'}`}>{section.count}</span>
      </header>
      <p className="cockpit-operation-card__summary">{section.summary}</p>

      {visibleItems.length ? (
        <ul className="cockpit-operation-list">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <Link to={item.href}>{item.actionLabel || 'Ouvrir'}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="cockpit-operation-card__empty" role="status">
          <BadgeCheck aria-hidden="true" size={30} />
          <span>{section.emptyLabel}</span>
        </div>
      )}

      {(section.href || hiddenCount > 0) && (
        <footer>
          {hiddenCount > 0 && <span>{hiddenCount} autre{hiddenCount > 1 ? 's' : ''} à consulter</span>}
          {section.href && <Link to={section.href}>{section.actionLabel || 'Tout voir'}</Link>}
        </footer>
      )}
    </article>
  );
}

export default function OperationalCockpit({ sections = [] }) {
  return (
    <section className="cockpit-operations-section" aria-labelledby="daily-pilotage-title">
      <div className="cockpit-section-heading">
        <div>
          <p>À faire et à contrôler</p>
          <h2 id="daily-pilotage-title">Pilotage quotidien</h2>
        </div>
      </div>
      <div className="cockpit-operations-grid">
        {sections.map((section) => <OperationalCard key={section.id} section={section} />)}
      </div>
    </section>
  );
}
