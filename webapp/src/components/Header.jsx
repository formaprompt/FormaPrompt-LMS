import { Link } from 'react-router-dom';
// import removed: logo will be referenced via public path
import { Menu, ShieldCheck, X, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import './Header.css';

function NavigationGroup({ id, label, children }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  return (
    <div className="dropdown" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" className="dropdown-title" aria-expanded={open}
        aria-controls={id} onClick={() => setOpen(!open)}>
        {label} <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id={id} className="dropdown-content" hidden={!open} onClick={(event) => {
        if (event.target.closest('a')) setOpen(false);
      }}>{children}</div>
    </div>
  );
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const { user, role } = useAuth();

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1201px)');
    const closeOnDesktop = () => { if (desktop.matches) setIsMenuOpen(false); };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [isMenuOpen]);

  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <img
            src="/assets/logo-new.png"
            alt="Logo FormaPrompt"
            width="96"
            height="64"
            decoding="async"
            fetchPriority="low"
          />
        </Link>

        <div className="mobile-header-actions">
          {user && (role === 'admin' || role === 'employee') && (
            <Link to="/admin" className="mobile-account-shortcut" onClick={() => setIsMenuOpen(false)}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}
          {user && (
            <Link to="/dashboard" className="mobile-account-shortcut mobile-account-shortcut--primary" onClick={() => setIsMenuOpen(false)}>
              <User size={18} aria-hidden="true" />
              <span>Espace apprenant</span>
            </Link>
          )}
          <button
            ref={menuButton}
            type="button"
            className="mobile-menu-btn"
            aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={isMenuOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Navigation principale" id="primary-navigation" className={`nav ${isMenuOpen ? 'nav-open' : ''}`} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== menuButton.current) setIsMenuOpen(false);
        }}>
          <Link to="/" onClick={() => setIsMenuOpen(false)}>Accueil</Link>
          <Link to="/diagnostic-ia" onClick={() => setIsMenuOpen(false)}>Diagnostic IA</Link>
          
          <NavigationGroup id="navigation-formations" label="Formations">
              <Link to="/formation-ia-generative" onClick={() => setIsMenuOpen(false)}>IA Générative</Link>
              <Link to="/formation-ia-act-conformite" onClick={() => setIsMenuOpen(false)}>IA &amp; AI Act</Link>
              <Link to="/formation-prompt-engineering" onClick={() => setIsMenuOpen(false)}>Prompt Engineering</Link>
              <Link to="/formation-bureautique" onClick={() => setIsMenuOpen(false)}>Bureautique</Link>
              <Link to="/formation-organismes" onClick={() => setIsMenuOpen(false)}>Pour les OF</Link>
          </NavigationGroup>
          
          <NavigationGroup id="navigation-ressources" label="Outils et ressources">
              <Link to="/studio" onClick={() => setIsMenuOpen(false)}>Studio — outil gratuit</Link>
              <Link to="/blog" onClick={() => setIsMenuOpen(false)}>Blog</Link>
              <Link to="/guide-gpt-5-6-codex" onClick={() => setIsMenuOpen(false)}>Guide GPT‑5.6</Link>
          </NavigationGroup>
          <NavigationGroup id="navigation-informations" label="Informations">
            <Link to="/disponibilites" onClick={() => setIsMenuOpen(false)}>Disponibilités</Link>
            <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}>À propos</Link>
          </NavigationGroup>
          <Link to="/contact" onClick={() => setIsMenuOpen(false)}>Contact</Link>
          
          {user ? (
            <div className="nav-account-actions">
              {(role === 'admin' || role === 'employee') && (
                <Link to="/admin" className="btn" onClick={() => setIsMenuOpen(false)} style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}>
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="btn btn-primary" onClick={() => setIsMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} /> Espace apprenant
              </Link>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary" onClick={() => setIsMenuOpen(false)}>
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
