import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function FormationBureautique() {
  return (
    <>
      <SEO
        title="Formation Bureautique Pro – FormaPrompt"
        description="Maîtrisez Word, Excel, PowerPoint, Outlook et Teams pour gagner en productivité."
        url="https://formaprompt.com/formation-bureautique"
        image="https://formaprompt.com/assets/formation%20bureautique.png"
      />
      <div className="container section">
      <div className="grid grid-cols-2" style={{alignItems: 'center', marginBottom: '2rem'}}>
        <div>
          <h1 className="mb-2">Formations Bureautique</h1>
          <p className="text-large mb-4" style={{ color: 'var(--color-primary)' }}>
            Gagner en autonomie avec Excel, Word, PowerPoint, Outlook, Teams et Microsoft 365
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/assets/formation bureautique.png" 
            alt="Formation Bureautique M365" 
            style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
          />
        </div>
      </div>
      
      <div className="card mb-4 text-center">
        <p className="mb-3">Les formations bureautiques FormaPrompt accompagnent les salariés, étudiants, demandeurs d'emploi et personnes en reconversion dans la maîtrise des outils numériques du quotidien.</p>
        <p className="mb-4">L'approche repose sur des exercices concrets, des situations professionnelles et une progression adaptée au niveau des participants.</p>

        <h3 className="mb-2">Objectif principal</h3>
        <div style={{ display: 'inline-block', textAlign: 'left', padding: '1rem', background: 'var(--color-bg-light)', borderLeft: '4px solid var(--color-primary)', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <p>Développer des compétences directement réutilisables dans les tâches administratives, pédagogiques et professionnelles.</p>
        </div>

        <h3 className="mb-2 mt-4">Modules proposés</h3>
        <p className="mb-3">Les formations peuvent être organisées séparément ou combinées dans un parcours bureautique complet.</p>
        <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Excel</h4>
            <p style={{ fontSize: '0.95rem' }}>Tableaux, formules, tris, filtres, graphiques, mise en forme conditionnelle, tableaux croisés dynamiques selon le niveau.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>Word</h4>
            <p style={{ fontSize: '0.95rem' }}>Mise en page, styles, sommaire automatique, modèles, documents longs, publipostage et bonnes pratiques de structuration.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#f97316', marginBottom: '0.5rem' }}>PowerPoint</h4>
            <p style={{ fontSize: '0.95rem' }}>Présentations claires, hiérarchie visuelle, masques, animations utiles et supports adaptés à une prise de parole.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#0ea5e9', marginBottom: '0.5rem' }}>Outlook</h4>
            <p style={{ fontSize: '0.95rem' }}>Gestion des mails, calendrier, règles, organisation, recherche, bonnes pratiques de communication professionnelle.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#8b5cf6', marginBottom: '0.5rem' }}>Teams</h4>
            <p style={{ fontSize: '0.95rem' }}>Réunions, canaux, fichiers partagés, collaboration, bonnes pratiques et usage avancé dans Microsoft 365.</p>
          </div>
          <div className="card" style={{ border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Microsoft 365</h4>
            <p style={{ fontSize: '0.95rem' }}>OneDrive, SharePoint, collaboration documentaire, coédition et organisation des fichiers professionnels.</p>
          </div>
        </div>

        <h3 className="mb-2 mt-4">Une formation adaptée au niveau réel des participants</h3>
        <p className="mb-3 text-left">La bureautique reste une compétence essentielle, mais les niveaux sont souvent très hétérogènes. La formation commence donc par l'identification des besoins : gagner du temps, produire des documents plus propres, fiabiliser un tableau, mieux collaborer ou préparer une évolution professionnelle.</p>
        <p className="mb-4 text-left">Les exercices sont construits à partir de situations proches du quotidien : suivi d'activité, compte rendu, présentation, tableau de bord simple, planning ou organisation d'équipe.</p>
        
        <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', textAlign: 'left' }}>
          <div style={{ padding: '1rem', borderLeft: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
            <strong>Débutant :</strong> Prendre confiance, comprendre l'interface, réaliser les manipulations essentielles.
          </div>
          <div style={{ padding: '1rem', borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
            <strong>Intermédiaire :</strong> Améliorer la méthode, automatiser certaines tâches et produire des documents plus fiables.
          </div>
          <div style={{ padding: '1rem', borderLeft: '3px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
            <strong>Avancé :</strong> Structurer des fichiers complexes, exploiter des données et optimiser les usages collaboratifs.
          </div>
        </div>

        <h3 className="mb-2 mt-4">Compétences visées</h3>
        <p className="mb-3">Les participants repartent avec des méthodes pratiques et directement applicables.</p>
        <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', flex: '1 1 200px', maxWidth: '250px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>1. Organiser</h4>
            <p style={{ fontSize: '0.9rem' }}>Classer l'information, structurer les fichiers et gagner en clarté.</p>
          </div>
          <div className="card" style={{ padding: '1.5rem', flex: '1 1 200px', maxWidth: '250px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>2. Produire</h4>
            <p style={{ fontSize: '0.9rem' }}>Créer des documents, tableaux et présentations professionnels.</p>
          </div>
          <div className="card" style={{ padding: '1.5rem', flex: '1 1 200px', maxWidth: '250px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>3. Automatiser</h4>
            <p style={{ fontSize: '0.9rem' }}>Réduire les tâches répétitives grâce aux fonctions adaptées.</p>
          </div>
          <div className="card" style={{ padding: '1.5rem', flex: '1 1 200px', maxWidth: '250px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>4. Collaborer</h4>
            <p style={{ fontSize: '0.9rem' }}>Utiliser les outils Microsoft 365 de manière plus efficace.</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--color-primary)', marginBottom: '2rem', textAlign: 'center' }}>
        <h3 className="mb-2">Construire un parcours bureautique adapté</h3>
        <p className="mb-4">Indiquez les outils concernés, le niveau des participants et les objectifs visés. Une proposition de formation peut être construite sur mesure.</p>
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
