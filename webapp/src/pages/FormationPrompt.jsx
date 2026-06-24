import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function FormationPrompt() {
  return (
    <>
      <SEO
        title="Formation Prompt Engineering – FormaPrompt"
        description="Apprenez à créer des prompts efficaces et à exploiter les modèles IA en entreprise."
        url="https://www.formaprompt.com/formation-prompt-engineering"
        image="https://www.formaprompt.com/assets/Formation prompt engineering.png"
      />
      <div className="container section">
      <div className="grid grid-cols-2" style={{alignItems: 'center', marginBottom: '2rem'}}>
        <div>
          <h1 className="mb-2">Formation Prompt Engineering</h1>
          <p className="mb-4 text-large">Pour professionnels, formateurs et étudiants.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/assets/Formation prompt engineering.png" 
            alt="Formation Prompt Engineering" 
            style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
          />
        </div>
      </div>
      
      <div className="card mb-4 text-center">
        <h2 style={{color: 'var(--color-primary)', marginBottom: '1rem'}}>Apprendre à construire des prompts efficaces et utiles</h2>
        <p className="mb-3">Le prompt engineering ne consiste pas à collectionner des formules toutes faites. Il s'agit d'apprendre à formuler une demande claire, contextualisée et exploitable pour obtenir de meilleurs résultats avec l'IA générative.</p>
        <p className="mb-4">Cette formation aide les participants à passer d'un usage intuitif de l'IA à une méthode de travail plus structurée.</p>

        <h3 className="mb-2">Résultat attendu</h3>
        <div style={{ display: 'inline-block', textAlign: 'left', padding: '1rem', background: 'var(--color-bg-light)', borderLeft: '4px solid var(--color-primary)', borderRadius: '4px', marginBottom: '1rem' }}>
          <p>Savoir créer, tester et améliorer des prompts adaptés à un objectif précis.</p>
        </div>

        <h3 className="mb-2 mt-4">Pourquoi se former au prompt engineering ?</h3>
        <p className="mb-3">Un bon résultat dépend rarement d'une seule phrase. Il dépend surtout de la clarté du contexte, des contraintes, du rôle demandé à l'IA et du format attendu.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', textAlign: 'left' }}>
          <div className="card" style={{ flex: '1 1 300px', maxWidth: '400px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>Clarifier ses demandes</h4>
            <p>Transformer une idée vague en consigne précise, structurée et compréhensible.</p>
          </div>
          <div className="card" style={{ flex: '1 1 300px', maxWidth: '400px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>Gagner en qualité</h4>
            <p>Obtenir des réponses plus cohérentes, mieux organisées et mieux adaptées au besoin.</p>
          </div>
          <div className="card" style={{ flex: '1 1 300px', maxWidth: '400px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>Construire des méthodes</h4>
            <p>Créer des prompts réutilisables et des workflows applicables dans son activité.</p>
          </div>
        </div>

        <h3 className="mb-2 mt-4">Programme indicatif</h3>
        <p className="mb-3">Le programme peut être adapté aux métiers, aux outils utilisés et au niveau des participants.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', textAlign: 'left' }}>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>1. Comprendre le rôle du prompt</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Différence entre question simple et consigne structurée</li>
              <li>Rôle du contexte, de l'objectif et du format attendu</li>
              <li>Comprendre pourquoi certains prompts échouent</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>2. Construire une consigne efficace</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Définir le rôle de l'IA</li>
              <li>Préciser le public, le niveau et les contraintes</li>
              <li>Demander une structure de réponse exploitable</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>3. Améliorer les réponses</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Analyser une réponse obtenue</li>
              <li>Reformuler et itérer</li>
              <li>Comparer plusieurs versions</li>
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>4. Créer des workflows</h4>
            <ul style={{ paddingLeft: '1rem', fontSize: '0.95rem', listStyleType: 'circle' }}>
              <li>Enchaîner plusieurs prompts</li>
              <li>Créer une méthode de travail réutilisable</li>
              <li>Adapter les prompts à des cas professionnels concrets</li>
            </ul>
          </div>
        </div>

        <h3 className="mb-2 mt-4">Exemples d'applications</h3>
        <p className="mb-3">La formation s'appuie sur des cas d'usage concrets pour éviter une approche trop théorique.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>1. Rédaction :</strong> Structurer un mail, un compte rendu, une synthèse ou un plan.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>2. Formation :</strong> Créer un scénario, un quiz, un exercice ou une fiche pédagogique.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>3. Analyse :</strong> Comparer des idées, organiser des informations ou préparer une décision.</div>
          <div className="card" style={{ padding: '1rem', flex: '1 1 200px', maxWidth: '300px' }}><strong>4. Production :</strong> Obtenir un livrable clair, relu, structuré et adapté au destinataire.</div>
        </div>
      </div>

      <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--color-primary)', marginBottom: '2rem' }}>
        <h3 className="mb-2">Former vos équipes à une utilisation structurée de l'IA</h3>
        <p className="mb-4">Cette formation peut être adaptée à vos métiers, à vos outils et aux livrables que vos équipes produisent au quotidien.</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/contact" className="btn btn-primary">
            Demander un devis
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
