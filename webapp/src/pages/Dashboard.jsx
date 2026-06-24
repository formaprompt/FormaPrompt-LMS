import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Petit dictionnaire pour afficher le beau nom de la formation
const courseNames = {
  'formation-ia': 'Formation IA Générative',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function fetchPurchases() {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        setPurchases(data);
      }
      setLoading(false);
    }

    fetchPurchases();
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="container" style={{ padding: '4rem 1rem', minHeight: '60vh' }}>
      <h1 style={{ marginBottom: '2rem' }}>Mon Espace Élève</h1>
      
      <div style={{ background: '#1e1e1e', color: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ color: '#fff' }}>Bienvenue, {user.email} !</h2>
        <p style={{ color: '#aaa', marginTop: '1rem', marginBottom: '2rem' }}>
          Vous retrouverez ici toutes les formations que vous avez achetées.
        </p>
        
        {loading ? (
          <p>Chargement de vos formations...</p>
        ) : purchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <h3 style={{ marginBottom: '1rem', color: '#fff', fontSize: '1.5rem' }}>Vous n'avez pas encore de formation</h3>
            <p style={{ color: '#aaa', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
              Découvrez nos programmes conçus pour booster votre productivité et maîtriser les outils numériques de demain.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>IA Générative</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Maîtrisez ChatGPT, Midjourney et les outils d'IA pour votre entreprise.</p>
                <Link to="/formation-ia-generative" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Prompt Engineering</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Apprenez à formuler des requêtes parfaites pour obtenir exactement ce que vous voulez.</p>
                <Link to="/formation-prompt-engineering" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Bureautique Pro</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Excel, Word, PowerPoint : gagnez en efficacité et en rapidité au quotidien.</p>
                <Link to="/formation-bureautique" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {purchases.map((purchase) => (
              <div key={purchase.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', color: '#fff' }}>{courseNames[purchase.course_id] || purchase.course_id}</h3>
                <Link to={`/course/${purchase.course_id}`} className="btn btn-primary" style={{ marginTop: 'auto', textAlign: 'center', background: '#10b981', borderColor: '#10b981' }}>
                  ▶ Voir la formation
                </Link>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={signOut}
          className="btn"
          style={{ marginTop: '3rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
