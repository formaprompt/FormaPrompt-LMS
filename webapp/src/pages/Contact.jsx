import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';

export default function Contact() {
  const [searchParams] = useSearchParams();
  const isAiActRegistration = searchParams.get('formation') === 'ia-act';
  const initialFormData = {
    name: '',
    email: '',
    subject: isAiActRegistration ? 'Demande de programme' : 'Demande de devis',
    message: isAiActRegistration
      ? "Je souhaite recevoir les modalités d'inscription à la formation « IA : acculturation et préparation à la conformité AI Act » au tarif promotionnel de 187 €."
      : '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    const { error } = await supabase
      .from('contact_requests')
      .insert([formData]);

    if (error) {
      console.error(error);
      setStatus('error');
    } else {
      setStatus('success');
      setFormData(initialFormData);
    }
  };

  return (
    <>
      <SEO
        title="Contact – FormaPrompt"
        description="Contactez-nous pour développer vos compétences en IA et bureautique."
        url="https://www.formaprompt.com/contact"
        image="https://www.formaprompt.com/assets/contact.png"
      />
      <div className="container section" style={{maxWidth: '800px'}}>
      <h1 className="text-center mb-2">Contactez-nous</h1>
      <p className="text-center mb-4">Demandez un devis, téléchargez un programme ou posez-nous vos questions.</p>
      
      <div className="card">
        {status === 'success' ? (
          <div style={{ background: '#10b98120', color: '#10b981', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <h3>Message envoyé !</h3>
            <p>Nous vous répondrons dans les plus brefs délais.</p>
            <button onClick={() => setStatus('idle')} className="btn" style={{ marginTop: '1rem', background: 'transparent', border: '1px solid #10b981', color: '#10b981' }}>
              Envoyer un autre message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Nom / Entreprise</label>
              <input type="text" id="name" required className="form-input" placeholder="Votre nom" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email professionnel</label>
              <input type="email" id="email" required className="form-input" placeholder="votre@email.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="subject">Sujet de votre demande</label>
              <select id="subject" className="form-input" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})}>
                <option>Demande de devis</option>
                <option>Demande de programme</option>
                <option>Formation sur mesure</option>
                <option>Autre question</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="message">Message</label>
              <textarea id="message" required className="form-textarea" placeholder="Décrivez votre besoin..." value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})}></textarea>
            </div>
            
            <button type="submit" disabled={status === 'loading'} className="btn btn-primary" style={{width: '100%', opacity: status === 'loading' ? 0.7 : 1}}>
              {status === 'loading' ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </button>
            {status === 'error' && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>Une erreur s'est produite. Veuillez réessayer.</p>}
          </form>
        )}
      </div>
    </div>
    </>
  );
}
