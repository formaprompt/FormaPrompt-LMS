import { Link } from 'react-router-dom';
import { Award, Target, Users, BookOpen, CheckCircle } from 'lucide-react';
import SEO from '../components/SEO';
import { SITE_CONFIG } from '../config/site';

export default function About() {
  return (
    <>
      <SEO
        title="À propos – FormaPrompt"
        description="Découvrez la mission, l'équipe et les valeurs de FormaPrompt pour rendre l'IA et la bureautique accessibles à tous."
        url={SITE_CONFIG.urls.about}
        image={SITE_CONFIG.assets.portrait}
      />
      <div className="container section">
      {/* Hero Section */}
      <div className="grid grid-cols-2 mb-8" style={{ alignItems: 'center', gap: '4rem' }}>
        <div>
          <h1 className="mb-2" style={{ color: 'var(--color-primary)', fontSize: '2.5rem' }}>
            Rendre l'IA accessible à tous
          </h1>
          <p className="text-large mb-4" style={{ color: 'var(--color-text-light)', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Derrière FormaPrompt se trouve une conviction forte : l'intelligence artificielle ne doit pas être réservée à une élite technique. Elle doit devenir un outil du quotidien, maîtrisé par tous les professionnels.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <Link to="/contact" className="btn btn-primary">
              Me contacter
            </Link>
            <Link to="/disponibilites" className="btn btn-outline">
              Voir mes disponibilités
            </Link>
          </div>
        </div>
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ 
            position: 'absolute', 
            top: '-20px', 
            left: '-20px', 
            right: '20px', 
            bottom: '20px', 
            background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary-dark) 100%)', 
            borderRadius: '24px', 
            opacity: '0.1', 
            zIndex: '-1' 
          }}></div>
          <img 
            src="/assets/Photo_thierry_frezard.jpg" 
            alt="Thierry FREZARD, Formateur Expert" 
            style={{ 
              width: '100%', 
              maxWidth: '450px', 
              borderRadius: '24px', 
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              border: '4px solid white'
            }} 
          />
        </div>
      </div>

      {/* Profile Section */}
      <div className="card mb-8" style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-2" style={{ gap: '3rem' }}>
          <div>
            <h2 className="mb-3" style={{ fontSize: '1.8rem' }}>{SITE_CONFIG.responsibleName}</h2>
            <h3 className="mb-4" style={{ color: 'var(--color-text-light)', fontSize: '1.1rem', fontWeight: '500' }}>
              Formateur Professionnel d'Adultes & Fondateur de FormaPrompt
            </h3>
            <p className="mb-3">
              Actif dans le domaine de la formation depuis plus de <strong>15 ans</strong>, j'ai eu l'opportunité d'accompagner une grande diversité de publics au sein de nombreux centres de formation reconnus : <em>SJT, ABC formation continue, A3C Hazebrouck, Manager's solutions Calais, Enablers, Senza, Evogue</em>, et bien d'autres.
            </p>
            <p className="mb-3">
              J'ai créé FormaPrompt pour répondre à un besoin crucial : démystifier l'Intelligence Artificielle et outiller concrètement les travailleurs d'aujourd'hui.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <div style={{ padding: '1rem', background: 'var(--color-primary-light)', color: 'white', borderRadius: '50%' }}>
                <Users size={28} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--color-primary)' }}>+500</h4>
                <p style={{ margin: 0, color: 'var(--color-text-light)' }}>Personnes formées (IA & Bureautique)</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <div style={{ padding: '1rem', background: 'var(--color-primary-light)', color: 'white', borderRadius: '50%' }}>
                <Award size={28} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--color-primary)' }}>15 ans</h4>
                <p style={{ margin: 0, color: 'var(--color-text-light)' }}>D'expérience en formation continue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology & Certifications */}
      <h2 className="text-center mb-4 mt-8">Ma promesse pédagogique & Mon expertise</h2>
      <div className="grid grid-cols-3 mb-8">
        
        <div className="card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <Target size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Le Sur-Mesure Absolu</h3>
          <p style={{ color: 'var(--color-text-light)' }}>
            Je ne délivre jamais un cours magistral standard. J'adapte toutes mes formations aux personnes qui les suivent en les personnalisant au maximum, selon leur niveau, leur métier et leurs objectifs concrets.
          </p>
        </div>

        <div className="card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <BookOpen size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Pédagogie Éprouvée</h3>
          <p style={{ color: 'var(--color-text-light)' }}>
            Titulaire du titre <strong>FPA (Formateur Professionnel d'Adultes)</strong>, ma méthode d'apprentissage est structurée, progressive et garantie de faire acquérir de véritables compétences, conformes aux exigences des OF.
          </p>
        </div>

        <div className="card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <CheckCircle size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Certifications IA</h3>
          <p style={{ color: 'var(--color-text-light)' }}>
            Je suis un formateur officiellement certifié sur l'Intelligence Artificielle, détenteur de la <strong>CertifIAG (par Certifopac)</strong> ainsi que de la <strong>Certification Google Prompt Engineering</strong>.
          </p>
        </div>

      </div>

      {/* Call to Action */}
      <div className="card text-center section-dark" style={{ background: 'var(--color-secondary)', padding: '4rem 2rem', borderRadius: '24px' }}>
        <h2 style={{ color: 'white', marginBottom: '1.5rem' }}>Organismes de Formation, travaillons ensemble !</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '700px', margin: '0 auto 2rem auto', fontSize: '1.1rem' }}>
          Vous cherchez un formateur indépendant, fiable et expert pour animer vos sessions en Bureautique ou Intelligence Artificielle ? 
          Consultez mon agenda pour bloquer une date, ou contactez-moi directement pour échanger sur vos besoins.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/disponibilites" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
            Consulter mes disponibilités
          </Link>
          <Link to="/contact" className="btn" style={{ background: 'transparent', border: '2px solid white', color: 'white', padding: '1rem 2rem', fontSize: '1.1rem' }}>
            Demander un devis
          </Link>
        </div>
      </div>

    </div>
    </>
  );
}
