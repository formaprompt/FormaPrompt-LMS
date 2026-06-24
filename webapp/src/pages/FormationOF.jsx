import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function FormationOF() {
  return (
    <>
      <SEO
        title="Formation IA pour Formateurs (RS6891) – FormaPrompt"
        description="Certification RS6891 pour formateurs. Apprenez à produire et réviser des contenus pédagogiques avec l'IA."
        url="https://www.formaprompt.com/formation-ia-formateur"
        image="https://www.formaprompt.com/assets/ia-formateur.jpg"
      />
      <div className="container section">
      <div className="grid grid-cols-2" style={{ alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="mb-2" style={{ fontSize: '2.2rem' }}>IA Générative pour Formateurs</h1>
          <p className="text-large mb-3" style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
            Produire et Réviser des Contenus Pédagogiques de Qualité
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: '500' }}>⏱ Durée : 21 heures (3 jours)</span>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: '500' }}>🎓 Formation Certifiante</span>
            <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: '500' }}>📌 Réf : F07-AIFORM-C03</span>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/assets/ia-formateur.jpg" 
            alt="Formation IA pour Formateurs" 
            style={{ maxWidth: '100%', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} 
            onError={(e) => { e.target.style.display = 'none'; }} 
          />
        </div>
      </div>
      
      <div className="card mb-4 text-center">
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #10b981', marginBottom: '2rem', textAlign: 'left' }}>
          <h3 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Certification RS6891 (CertifIAG)</h3>
          <p style={{ margin: 0 }}>
            Cette formation permet l'accès à la certification RS6891 en partenariat avec <strong>Manager Solution Calais</strong>. Elle inclut la production d’un dossier certifiable et la préparation complète à la soutenance.
          </p>
        </div>

        <h3 className="mb-2">Objectifs de la formation</h3>
        <p className="mb-4">Cette formation certifiante permet aux formateurs et ingénieurs pédagogiques d’utiliser l’Intelligence Artificielle Générative (IAG) de manière professionnelle et éthique.</p>

        <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#10b981', marginBottom: '0.5rem' }}>1. Sélectionner les outils</h4>
            <p style={{ fontSize: '0.95rem' }}>Comparer les outils selon leurs fonctionnalités, limitations et coûts, et choisir l'outil pertinent pour un besoin pédagogique donné.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>2. Prompting avancé</h4>
            <p style={{ fontSize: '0.95rem' }}>Construire des prompts structurés (contexte, rôle, actions, format) et mener un dialogue itératif pour affiner la production.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#f97316', marginBottom: '0.5rem' }}>3. Produire des contenus</h4>
            <p style={{ fontSize: '0.95rem' }}>Générer textes, visuels ou supports exploitables en formation, et les adapter aux objectifs pédagogiques et au public visé.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#0ea5e9', marginBottom: '0.5rem' }}>4. Réviser et améliorer</h4>
            <p style={{ fontSize: '0.95rem' }}>Modifier les prompts pour améliorer le style ou la structure, et comparer l'efficacité pédagogique des différentes variantes.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb', gridColumn: '1 / -1' }}>
            <h4 style={{ color: '#8b5cf6', marginBottom: '0.5rem' }}>5. Éthique et Sécurité</h4>
            <p style={{ fontSize: '0.95rem' }}>Identifier les biais, appliquer les bonnes pratiques RGPD et garantir un usage responsable selon le cadre du référentiel RS6891.</p>
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: '1.5rem', textAlign: 'left', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Prérequis</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.95rem' }}>
              <li>Avoir une expérience en formation ou en conception pédagogique.</li>
              <li>Aisance globale avec les outils numériques.</li>
            </ul>
          </div>
          <div className="card" style={{ padding: '1.5rem', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Public visé</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.95rem' }}>
              <li>Formateurs (indépendants ou internes)</li>
              <li>Ingénieurs pédagogiques</li>
              <li>Concepteurs en Organisme de Formation (OF)</li>
              <li>Responsables pédagogiques</li>
            </ul>
          </div>
        </div>

        <h3 className="mb-2 mt-4 text-left">Programme de la formation</h3>
        <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>Jour 1 – Analyse des besoins & Prompt Engineering</h4>
            <ul style={{ listStyleType: 'circle', paddingLeft: '1.5rem', fontSize: '0.95rem', margin: 0 }}>
              <li>Analyse d’un besoin de commanditaire.</li>
              <li>Rédaction de la synthèse formelle (attendue au RS6891).</li>
              <li>Construction du tableau comparatif des outils IA.</li>
              <li>Bases du prompt engineering pour la pédagogie.</li>
              <li>Premières expérimentations IA et captures de conversation.</li>
            </ul>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Jour 2 – Production multimédia & Révision des contenus</h4>
            <ul style={{ listStyleType: 'circle', paddingLeft: '1.5rem', fontSize: '0.95rem', margin: 0 }}>
              <li>Production via IA : supports Word/PPT, schémas, quiz, vidéos.</li>
              <li>Création d’un module complet conforme au cahier des charges.</li>
              <li>Régénération de contenu, variantes stylistiques, améliorations.</li>
              <li>Comparaison des versions IA via un tableau qualité (exigence RS6891).</li>
            </ul>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>Jour 3 – Éthique, risques & préparation certification</h4>
            <ul style={{ listStyleType: 'circle', paddingLeft: '1.5rem', fontSize: '0.95rem', margin: 0 }}>
              <li>Identification des risques : biais, RGPD, sécurité, CGU.</li>
              <li>Rédaction de la partie 'Analyse des risques' du rapport.</li>
              <li>Construction du dossier final (10 pages).</li>
              <li>Préparation à l’oral : support, pitch, session blanche.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: '1.5rem', textAlign: 'left', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>Modalités pédagogiques</h4>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
              Alternance d'apports théoriques, démonstrations guidées, exercices pratiques, et mises en situation. Les participants produisent et révisent leurs propres contenus. Accompagnement individualisé avec progression active et participative.
            </p>
          </div>
          <div>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>Modalités d'évaluation</h4>
            <ul style={{ listStyleType: 'square', paddingLeft: '1rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <li>Évaluations formatives (quiz, exercices).</li>
              <li>Production d’un contenu généré avec l'IA (C1 à C4).</li>
              <li>Soutenance orale finale : analyse des risques et démonstration (C5).</li>
              <li>Remise d’une attestation et accès à la certification RS6891.</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--color-primary)', marginBottom: '2rem', textAlign: 'center' }}>
        <h3 className="mb-2">Prêt à intégrer l'IA dans vos formations ?</h3>
        <p className="mb-4">Contactez-nous pour planifier votre session et préparer votre certification.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/contact" className="btn btn-primary">
            Demander un devis
          </Link>
          <Link to="/" className="btn" style={{ background: 'transparent', border: '1px solid var(--text-secondary)' }}>
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
