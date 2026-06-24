import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';
import { Star } from 'lucide-react';

export default function Feedback() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    student_email: '',
    course_name: 'Acculturation IA',
    training_date: '',
    rating_overall: 5,
    rating_pedagogy: 5,
    rating_objectives: 5,
    rating_logistics: 5,
    public_testimonial: '',
    private_feedback: '',
    consent_marketing: false
  });
  
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    // Concaténer le prénom, nom et entreprise pour la base de données
    const student_name = `${formData.firstName} ${formData.lastName} ${formData.company ? `(${formData.company})` : ''}`.trim();

    const dataToSubmit = {
      student_name: student_name,
      student_email: formData.student_email,
      course_name: formData.course_name,
      training_date: formData.training_date,
      rating_overall: formData.rating_overall,
      rating_pedagogy: formData.rating_pedagogy,
      rating_objectives: formData.rating_objectives,
      rating_logistics: formData.rating_logistics,
      public_testimonial: formData.public_testimonial,
      private_feedback: formData.private_feedback,
      consent_marketing: formData.consent_marketing
    };

    const { error } = await supabase
      .from('satisfaction_surveys')
      .insert([dataToSubmit]);

    if (error) {
      console.error(error);
      setStatus('error');
    } else {
      setStatus('success');
    }
  };

  const renderStars = (field, label) => (
    <div className="mb-3">
      <label className="form-label mb-1">{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setFormData({...formData, [field]: star})}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', padding: '0',
              color: star <= formData[field] ? '#fbbf24' : '#e5e7eb'
            }}
          >
            <Star size={32} fill={star <= formData[field] ? '#fbbf24' : 'none'} strokeWidth={1} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <SEO
        title="Évaluation de fin de formation – FormaPrompt"
        description="Donnez-nous votre avis sur la formation que vous venez de suivre (Démarche Qualiopi)."
        url="https://www.formaprompt.com/feedback"
      />
      <div className="container section" style={{maxWidth: '800px'}}>
        <h1 className="text-center mb-2">Votre avis compte !</h1>
        <p className="text-center mb-4 text-large" style={{ color: 'var(--color-text-light)' }}>
          Dans le cadre de l'amélioration continue de nos formations (démarche qualité Qualiopi), nous vous remercions de bien vouloir évaluer la session que vous venez de suivre.
        </p>
        
        <div className="card">
          {status === 'success' ? (
            <div style={{ background: '#10b98120', color: '#10b981', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
              <h3 className="mb-2">Merci pour votre retour !</h3>
              <p>Votre évaluation a bien été prise en compte. Nous sommes ravis de vous avoir compté parmi nos stagiaires.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 mb-4">
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="firstName">Prénom</label>
                  <input type="text" id="firstName" required className="form-input" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="Jean" />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="lastName">Nom</label>
                  <input type="text" id="lastName" required className="form-input" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="Dupont" />
                </div>
              </div>

              <div className="grid grid-cols-2 mb-4">
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="company">Entreprise / Organisme (Optionnel)</label>
                  <input type="text" id="company" className="form-input" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} placeholder="Ma Société" />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="student_email">Votre email</label>
                  <input type="email" id="student_email" required className="form-input" value={formData.student_email} onChange={(e) => setFormData({...formData, student_email: e.target.value})} placeholder="jean.dupont@email.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 mb-4">
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="course_name">Intitulé de la formation suivie</label>
                  <select id="course_name" required className="form-input" value={formData.course_name} onChange={(e) => setFormData({...formData, course_name: e.target.value})}>
                    <option>Acculturation IA</option>
                    <option>Prompt Engineering</option>
                    <option>Bureautique Pro (Excel/Word)</option>
                    <option>Outils Microsoft 365 (Teams)</option>
                    <option>Autre / Sur-mesure</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="training_date">Date de fin de formation</label>
                  <input type="date" id="training_date" required className="form-input" value={formData.training_date} onChange={(e) => setFormData({...formData, training_date: e.target.value})} />
                </div>
              </div>

              <div style={{ background: 'var(--color-bg)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Évaluation des critères</h3>
                {renderStars('rating_overall', '1. Appréciation globale de la formation')}
                {renderStars('rating_pedagogy', '2. Qualité de la pédagogie, animation et clarté des explications')}
                {renderStars('rating_objectives', '3. Atteinte des objectifs professionnels annoncés')}
                {renderStars('rating_logistics', '4. Qualité des supports de cours et de l\'organisation matérielle')}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="public_testimonial">Un petit mot pour notre site ? (Optionnel)</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Recommanderiez-vous cette formation ? Qu'avez-vous le plus apprécié ?</p>
                <textarea id="public_testimonial" className="form-textarea" rows="3" placeholder="Ex: Formation très claire, je recommande !" value={formData.public_testimonial} onChange={(e) => setFormData({...formData, public_testimonial: e.target.value})}></textarea>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#1e1e1e', padding: '1rem', borderRadius: '8px' }}>
                <input 
                  type="checkbox" 
                  id="consent_marketing" 
                  checked={formData.consent_marketing} 
                  onChange={(e) => setFormData({...formData, consent_marketing: e.target.checked})} 
                  style={{ marginTop: '0.25rem', width: '18px', height: '18px' }}
                />
                <label htmlFor="consent_marketing" style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', cursor: 'pointer' }}>
                  J'accepte que mon avis soit diffusé sur le site web de FormaPrompt. Seuls mon prénom et l'initiale de mon nom apparaîtront pour garantir ma confidentialité.
                </label>
              </div>

              <div className="form-group" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <label className="form-label" htmlFor="private_feedback">Remarques ou axes d'amélioration (Strictement confidentiel)</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Qu'est-ce qui aurait pu être fait différemment ? Ces commentaires ne seront lus que par l'équipe pédagogique.</p>
                <textarea id="private_feedback" className="form-textarea" rows="3" placeholder="Vos suggestions d'amélioration..." value={formData.private_feedback} onChange={(e) => setFormData({...formData, private_feedback: e.target.value})}></textarea>
              </div>
              
              <button type="submit" disabled={status === 'loading'} className="btn btn-primary" style={{width: '100%', opacity: status === 'loading' ? 0.7 : 1, padding: '1rem', fontSize: '1.1rem'}}>
                {status === 'loading' ? 'Envoi en cours...' : 'Soumettre mon évaluation'}
              </button>
              {status === 'error' && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>Une erreur s'est produite lors de l'envoi de votre questionnaire.</p>}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
