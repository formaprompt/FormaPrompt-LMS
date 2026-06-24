import { Link } from 'react-router-dom';
// import removed: logo will be referenced via public path
import { Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, role } = useAuth();

  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <img src="/assets/logo-new.png" alt="Logo FormaPrompt" style={{ height: '128px', objectFit: 'contain' }} />
        </Link>

        {/* Mobile menu button */}
        <button 
          className="mobile-menu-btn" 
          aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation */}
        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <Link to="/" onClick={() => setIsMenuOpen(false)}>Accueil</Link>
          
          <div className="dropdown">
            <span className="dropdown-title">Formations</span>
            <div className="dropdown-content">
              <Link to="/formation-ia-generative" onClick={() => setIsMenuOpen(false)}>IA Générative</Link>
              <Link to="/formation-prompt-engineering" onClick={() => setIsMenuOpen(false)}>Prompt Engineering</Link>
              <Link to="/formation-bureautique" onClick={() => setIsMenuOpen(false)}>Bureautique</Link>
              <Link to="/formation-organismes" onClick={() => setIsMenuOpen(false)}>Pour les OF</Link>
            </div>
          </div>
          
          <Link to="/disponibilites" onClick={() => setIsMenuOpen(false)}>Disponibilités</Link>
          <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}>À propos</Link>
          <Link to="/blog" onClick={() => setIsMenuOpen(false)}>Blog</Link>
          
          {user ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(role === 'admin' || role === 'employee') && (
                <Link to="/admin" className="btn" onClick={() => setIsMenuOpen(false)} style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}>
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="btn btn-primary" onClick={() => setIsMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} /> Mon Espace
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
