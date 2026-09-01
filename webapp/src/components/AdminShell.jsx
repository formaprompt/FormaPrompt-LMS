import { NavLink } from 'react-router-dom';
import './AdminShell.css';

const navigation = [
  { label: 'Cockpit', to: '/admin' },
  { label: 'Commercial', to: '/admin/commercial' },
  { label: 'Diagnostics IA', to: '/admin/diagnostics' },
  { label: 'Promotions', to: '/admin/promotions' },
  { label: 'Pédagogique', to: '/admin/pedagogique' },
  { label: 'Qualité', to: '/admin/qualite' },
  { label: 'Finance', to: '/admin/finance' },
  { label: 'BPF', to: '/admin/bpf' },
];

export default function AdminShell({ children }) {
  return (
    <div className="admin-shell">
      <nav className="admin-shell__navigation" aria-label="Navigation de l’administration">
        <div className="container admin-shell__navigation-inner">
          {navigation.map((item) => item.disabled ? (
            <span key={item.label} className="admin-shell__link is-disabled" aria-disabled="true" title="Prévu dans un prochain lot">
              {item.label}
            </span>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) => `admin-shell__link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
