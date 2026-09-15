import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import './AdminShell.css';

const navigation = [
  { label: 'Cockpit', to: '/admin' },
  { label: 'Apprenants', to: '/admin/pedagogique?onglet=users', adminOnly: true },
  { label: 'Commercial', to: '/admin/commercial' },
  { label: 'Promotions', to: '/admin/promotions' },
  { label: 'Diagnostics IA', to: '/admin/diagnostics' },
  { label: 'Pédagogique', to: '/admin/pedagogique' },
  { label: 'Qualité', to: '/admin/qualite' },
  { label: 'Finance', to: '/admin/finance' },
  { label: 'BPF', to: '/admin/bpf' },
];

export default function AdminShell({ children }) {
  const { role } = useAuth();
  const location = useLocation();
  const requestedTab = new URLSearchParams(location.search).get('onglet');

  function isCurrent(item) {
    if (item.label === 'Apprenants') return location.pathname.startsWith('/admin/apprenants/') || (location.pathname === '/admin/pedagogique' && requestedTab === 'users');
    if (item.label === 'Pédagogique') return location.pathname === '/admin/pedagogique' && requestedTab !== 'users';
    return location.pathname === item.to;
  }

  return (
    <div className="admin-shell">
      <nav className="admin-shell__navigation" aria-label="Navigation de l’administration">
        <div className="container admin-shell__navigation-inner">
          {navigation.filter((item) => !item.adminOnly || role === 'admin').map((item) => item.disabled ? (
            <span key={item.label} className="admin-shell__link is-disabled" aria-disabled="true" title="Prévu dans un prochain lot">
              {item.label}
            </span>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className={`admin-shell__link${isCurrent(item) ? ' is-active' : ''}`}
              aria-current={isCurrent(item) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
