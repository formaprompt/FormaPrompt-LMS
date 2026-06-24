import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function CoursePlayer() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);

  useEffect(() => {
    async function verifyAccess() {
      if (!user) {
        navigate('/login');
        return;
      }

      // Vérifie si l'utilisateur possède cette formation précise
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', id);

      if (data && data.length > 0) {
        setAccessGranted(true);
      } else {
        // Redirige vers la page d'achat s'il n'a pas payé
        navigate(`/${id === 'formation-ia' ? 'formation-ia-generative' : ''}`);
      }
      setLoading(false);
    }

    verifyAccess();
  }, [id, user, navigate]);

  if (loading) return <div className="container section">Chargement sécurisé de la formation...</div>;
  if (!accessGranted) return null; // Le useEffect va le rediriger de toute façon

  return (
    <div className="container section">
      <h1>Lecteur de Formation</h1>
      <p style={{ color: '#10b981', marginBottom: '2rem' }}>✓ Accès vérifié et sécurisé.</p>
      
      <div style={{ background: '#000', borderRadius: '12px', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
        <p style={{ color: '#555' }}>[ Lecteur Vidéo (Vimeo / YouTube non répertorié) à insérer ici ]</p>
      </div>

      <div className="card">
        <h2>Ressources de la formation</h2>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          <li><a href="#" style={{ color: 'var(--primary-color)' }}>Télécharger le PDF de présentation</a></li>
          <li><a href="#" style={{ color: 'var(--primary-color)' }}>Fichier d'exercices Excel</a></li>
          <li><a href="#" style={{ color: 'var(--primary-color)' }}>Lexique de l'IA</a></li>
        </ul>
      </div>
    </div>
  );
}
