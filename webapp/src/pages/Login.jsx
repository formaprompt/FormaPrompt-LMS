import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/useAuth';
import './Auth.css';

const AUTH_TIMEOUT_MS = 15_000;

function signInWithTimeout(credentials) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS);
  });

  return Promise.race([
    supabase.auth.signInWithPassword(credentials),
    timeout,
  ]).finally(() => window.clearTimeout(timeoutId));
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginConfirmed, setLoginConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : role === 'admin' || role === 'employee'
      ? '/admin'
      : '/dashboard';
  const registerPath = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? `/register?redirect=${encodeURIComponent(requestedRedirect)}`
    : '/register';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginConfirmed(false);
    setError('');

    try {
      const { data, error: signInError } = await signInWithTimeout({
        email,
        password,
      });

      if (signInError) {
        setError('Identifiants incorrects. Veuillez réessayer.');
        return;
      }

      if (!data.session) {
        setError("La connexion n'a pas pu être confirmée. Veuillez réessayer.");
        return;
      }

      // AuthContext récupère ensuite le profil et son rôle. Attendre cette
      // synchronisation évite que la route /admin ne renvoie prématurément
      // un administrateur vers l'espace apprenant.
      setLoginConfirmed(true);
    } catch (signInError) {
      console.error('Connexion Supabase impossible :', signInError);
      setError('Le service de connexion ne répond pas. Veuillez réessayer dans quelques instants.');
    } finally {
      setLoading(false);
    }
  };

  if (user && role) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Bon retour !</h1>
        <p className="auth-subtitle">Connectez-vous à votre espace apprenant</p>

        {searchParams.get('session') === 'expired' && (
          <div className="auth-info">Votre session a expiré ou a été fermée dans un autre onglet. Reconnectez-vous pour continuer votre réservation.</div>
        )}
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.9rem', color: '#10b981', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
          </div>
          <button type="submit" className="auth-btn" disabled={loading || loginConfirmed}>
            {loginConfirmed ? 'Ouverture de votre espace…' : loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="auth-links">
          <p>Pas encore de compte ? <Link to={registerPath}>S'inscrire</Link></p>
        </div>
      </div>
    </div>
  );
}
