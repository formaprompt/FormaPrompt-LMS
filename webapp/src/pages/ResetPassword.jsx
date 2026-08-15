import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { securePasswordUpdate } from '../lib/passwordSecurity';
import './Auth.css';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier si l'utilisateur est bien arrivé ici via le lien de réinitialisation
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Password recovery intent received.");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      const result = await securePasswordUpdate(supabase, password);
      setPassword('');
      setConfirmPassword('');
      if (result.warning) {
        setMessage(`Mot de passe mis à jour. ${result.warning}`);
      } else {
        navigate('/dashboard');
      }
    } catch (updateError) {
      setError(updateError.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Nouveau mot de passe</h1>
        <p className="auth-subtitle">Saisissez votre nouveau mot de passe ci-dessous.</p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-info" role="status">{message}</div>}

        {message ? (
          <button type="button" className="auth-btn" onClick={() => navigate('/dashboard')}>Continuer vers votre espace</button>
        ) : <form onSubmit={handleUpdatePassword} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">Nouveau mot de passe</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={12}
              />
              <button 
                type="button" 
                className="password-toggle-btn" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <small>Utilisez au moins 12 caractères et un mot de passe unique.</small>
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={12}
              />
              <button 
                type="button" 
                className="password-toggle-btn" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Mise à jour en cours...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>}
      </div>
    </div>
  );
}
