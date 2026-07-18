import { Link } from 'react-router-dom';
// import removed: logo will be referenced via public path
import { Menu, ShieldCheck, X, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import './Header.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, role } = useAuth();

  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <img src="/assets/logo-new.png" alt="Logo FormaPrompt" />
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
        <nav id="primary-navigation" className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <Link to="/" onClick={() => setIsMenuOpen(false)}>Accueil</Link>
          <Link to="/studio" onClick={() => setIsMenuOpen(false)}>Studio</Link>
          
          <div className="dropdown">
            <span className="dropdown-title">Formations</span>
            <div className="dropdown-content">
              <Link to="/formation-ia-generative" onClick={() => setIsMenuOpen(false)}>IA Générative</Link>
              <Link to="/formation-ia-act-conformite" onClick={() => setIsMenuOpen(false)}>IA &amp; AI Act</Link>
              <Link to="/formation-prompt-engineering" onClick={() => setIsMenuOpen(false)}>Prompt Engineering</Link>
              <Link to="/formation-bureautique" onClick={() => setIsMenuOpen(false)}>Bureautique</Link>
              <Link to="/formation-organismes" onClick={() => setIsMenuOpen(false)}>Pour les OF</Link>
            </div>
          </div>
          
          <Link to="/disponibilites" onClick={() => setIsMenuOpen(false)}>Disponibilités</Link>
          <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}>À propos</Link>
          <div className="dropdown">
            <span className="dropdown-title">Ressources</span>
            <div className="dropdown-content">
              <Link to="/blog" onClick={() => setIsMenuOpen(false)}>Blog</Link>
              <Link to="/guide-gpt-5-6-codex" onClick={() => setIsMenuOpen(false)}>Guide GPT‑5.6</Link>
            </div>
          </div>
          
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
