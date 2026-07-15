import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';
import SEO from '../components/SEO';

export default function FormationIA() {
  const { user } = useAuth();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  // Le vrai lien de paiement Stripe
  const stripePaymentLink = "https://buy.stripe.com/test_14A7sM74SctQ3v28NogjC00";
  // On ajoute l'ID de l'utilisateur au lien pour que Stripe sache qui a payé
  const checkoutUrl = user ? `${stripePaymentLink}?client_reference_id=${user.id}` : '/login';

  useEffect(() => {
    async function checkPurchase() {
      if (!user) {
        setHasPurchased(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', 'formation-ia');

      if (data && data.length > 0) {
        setHasPurchased(true);
      }
      setLoading(false);
    }

    checkPurchase();
  }, [user]);

  return (
    <div className="container section">
  <SEO
    title="Formation IA Générative – FormaPrompt"
    description="Formation professionnelle en IA générative pour dirigeants, salariés et étudiants."
    url="https://www.formaprompt.fr/formation-ia-generative"
    image="https://www.formaprompt.fr/assets/acculturation-ia.png"
  />
      <div className="grid grid-cols-2" style={{alignItems: 'center', marginBottom: '2rem'}}>
        <div>
          <h1 className="mb-2">Formation IA Générative</h1>
          <p className="mb-4 text-large">Pour professionnels, dirigeants et salariés.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <img src="/assets/acculturation-ia.png" alt="Acculturation à l'IA" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
        </div>
      </div>
      
      <div className="card mb-4 text-center">
        <h2 style={{color: 'var(--color-primary)', marginBottom: '1rem'}}>Comprendre et utiliser l'IA générative avec méthode</h2>
        <p className="mb-3">Cette formation aide les participants à découvrir les usages concrets de l'intelligence artificielle générative, à comprendre ses limites et à l'utiliser de manière responsable dans un contexte professionnel ou pédagogique.</p>
        <p className="mb-4">L'objectif n'est pas de présenter l'IA comme une solution magique, mais comme un outil de travail qui demande méthode, recul critique et vérification.</p>

        <h3 className="mb-2">Objectif principal</h3>
        <div style={{ display: 'inline-block', textAlign: 'left', padding: '1rem', background: 'var(--color-bg-light)', borderLeft: '4px solid var(--color-primary)', borderRadius: '4px', marginBottom: '1rem' }}>
          <p>Identifier les bons usages de l'IA générative, produire des résultats exploitables et adopter une posture responsable.</p>
        </div>

        <h3 className="mb-2 mt-4">À qui s'adresse cette formation ?</h3>
        <p className="mb-3">La formation est adaptable selon le niveau des participants et le contexte d'intervention.</p>
        <ul className="mb-4" style={{ display: 'inline-block', textAlign: 'left', listStyleType: 'disc', paddingLeft: '1.5rem' }}>
          <li className="mb-2"><strong>Professionnels :</strong> Salariés, dirigeants, équipes administratives ou métiers souhaitant intégrer l'IA dans leurs pratiques quotidiennes.</li>
          <li className="mb-2"><strong>Organismes de formation :</strong> Formateurs, responsables pédagogiques ou coordinateurs souhaitant comprendre les usages pédagogiques de l'IA.</li>
          <li className="mb-2"><strong>Étudiants et reconversion :</strong> Publics en apprentissage ou transition professionnelle qui souhaitent développer une compétence numérique actuelle.</li>
        </ul>

        <h3 className="mb-2 mt-4">Programme indicatif</h3>
        <p className="mb-3">Le contenu peut être adapté en demi-journée, journée complète ou parcours sur mesure.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', textAlign: 'left' }}>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>1. Comprendre l'IA générative</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Définition simple de l'IA générative</li>
              <li>Différences entre moteur de recherche, chatbot et assistant IA</li>
              <li>Exemples d'usages : texte, image, synthèse, idées, support pédagogique</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>2. Utiliser l'IA dans un cadre pro</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Rédiger, reformuler, synthétiser et structurer une information</li>
              <li>Préparer un plan, une trame, un support ou une analyse</li>
              <li>Comparer plusieurs réponses et améliorer les résultats</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>3. Identifier les limites</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Erreurs, approximations et hallucinations</li>
              <li>Biais possibles dans les réponses</li>
              <li>Importance de la vérification humaine</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>4. Adopter une pratique responsable</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Confidentialité et données sensibles</li>
              <li>Usage raisonné dans le travail et la formation</li>
              <li>Construction d'une charte ou de bonnes pratiques internes</li>
            </ul>
          </div>
        </div>

        <h3 className="mb-2 mt-4">Compétences visées</h3>
        <p className="mb-3">À l'issue de la formation, les participants sont capables d'utiliser l'IA avec davantage de méthode, de prudence et d'efficacité.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>1. Identifier :</strong> Reconnaître les usages pertinents de l'IA.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>2. Formuler :</strong> Exprimer une demande claire et exploitable.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>3. Vérifier :</strong> Contrôler la qualité et les limites des réponses.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>4. Réutiliser :</strong> Intégrer l'IA de manière responsable.</div>
        </div>
      </div>

      <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--color-primary)', marginBottom: '2rem' }}>
        <h3 className="mb-2">Construire une formation IA adaptée à votre public</h3>
        <p className="mb-4">Indiquez votre contexte, le niveau des participants et vos objectifs. Une proposition de formation pourra être ajustée à vos besoins.</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!loading && hasPurchased ? (
            <Link to="/course/formation-ia" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}>
              ▶ Accéder à ma formation en ligne
            </Link>
          ) : (
            <a href={checkoutUrl} className="btn btn-primary">
              {user ? 'Acheter cette formation (497€)' : 'Se connecter pour acheter'}
            </a>
          )}
          <Link to="/contact" className="btn" style={{ background: 'transparent', border: '1px solid var(--color-primary)' }}>
            Demander un devis OF / Sur-mesure
          </Link>
        </div>
      </div>
    </div>
  );
}
