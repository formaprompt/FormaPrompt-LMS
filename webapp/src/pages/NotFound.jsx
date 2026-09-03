import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NotFound() {
  return (
    <>
      <SEO
        title="Page introuvable – FormaPrompt"
        description="Cette page n’existe pas ou n’est plus disponible."
        robots="noindex, nofollow"
      />
      <section className="container section" style={{ maxWidth: '760px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Erreur 404</p>
        <h1>Cette page est introuvable</h1>
        <p>Vérifiez l’adresse ou revenez vers une ressource publique de FormaPrompt.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <Link className="btn btn-primary" to="/">Retour à l’accueil</Link>
          <Link className="btn btn-outline" to="/studio/">Découvrir le Studio</Link>
        </div>
      </section>
    </>
  );
}
