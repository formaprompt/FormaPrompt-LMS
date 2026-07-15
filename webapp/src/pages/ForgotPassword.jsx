import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    });

    if (error) {
      setError("Une erreur s'est produite. Veuillez vérifier votre adresse e-mail.");
    } else {
      setMessage("Un e-mail de réinitialisation vous a été envoyé. Veuillez vérifier votre boîte de réception (et vos spams).");
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Mot de passe oublié ?</h1>
        <p className="auth-subtitle">Saisissez votre e-mail pour recevoir un lien de réinitialisation.</p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div style={{ background: '#10b98120', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>{message}</div>}

        <form onSubmit={handleResetPassword} className="auth-form">
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
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="auth-links">
          <p>Je me souviens de mon mot de passe ! <Link to="/login">Se connecter</Link></p>
        </div>
      </div>
    </div>
  );
}
