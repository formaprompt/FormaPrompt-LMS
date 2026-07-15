import { Link } from 'react-router-dom';
import { Bot, BookOpen, Monitor, CheckCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Home.css';
import SEO from '../components/SEO';

const SUPERPROF_PROFILE_URL = 'https://www.superprof.fr/formez-prompt-engineering-revolutionnez-facon-dinteragir-lia.html';

// Courts extraits de recommandations publiques, avec attribution et lien vers la source.
const superprofRecommendations = [
  {
    id: 'superprof-ivan',
    student_name: 'Ivan',
    course_name: 'Recommandation publiée sur Superprof',
    rating_overall: null,
    public_testimonial: 'Super sympa et il explique très bien.',
    source_url: SUPERPROF_PROFILE_URL,
  },
  {
    id: 'superprof-sayed',
    student_name: 'Sayed',
    course_name: 'Recommandation publiée sur Superprof',
    rating_overall: null,
    public_testimonial: "Très intelligent tant dans l’enseignement que dans les connaissances.",
    source_url: SUPERPROF_PROFILE_URL,
  },
  {
    id: 'superprof-eugenie',
    student_name: 'Eugénie',
    course_name: 'Recommandation publiée sur Superprof',
    rating_overall: null,
    public_testimonial: 'À l’écoute et attentionné.',
    source_url: SUPERPROF_PROFILE_URL,
  },
];

export default function Home() {
  const [testimonials, setTestimonials] = useState([]);

  useEffect(() => {
    async function fetchTestimonials() {
      const { data } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);
        
      let displayTestimonials = data || [];
      
      // Si moins de 3 avis FormaPrompt sont publiés, compléter avec les recommandations publiques sourcées.
      if (displayTestimonials.length < 3) {
        const needed = 3 - displayTestimonials.length;
        displayTestimonials = [...displayTestimonials, ...superprofRecommendations.slice(0, needed)];
      }
      
      setTestimonials(displayTestimonials);
    }
    fetchTestimonials();
  }, []);

  // Fonction pour formater le nom : "Jean Dupont" -> "Jean D."
  const formatName = (fullName) => {
    const parts = fullName.trim().split(' ');
    if (parts.length > 1) {
      const lastName = parts.pop();
      return `${parts.join(' ')} ${lastName.charAt(0)}.`;
    }
    return fullName;
  };

  return (
    <>
      <SEO
        title="FormaPrompt – Formation IA, Prompt Engineering, Bureautique"
        description="Plateforme de formation professionnelle en IA générative, Prompt Engineering et outils bureautiques. Découvrez nos programmes certifiants."
        url="https://www.formaprompt.fr/"
        image="https://www.formaprompt.fr/assets/photo%20page%20d'accueil.png"
      />
      <div className="home">
        {/* Hero Section */}
        <section className="hero">
          <div className="container hero-container">
            <div className="grid grid-cols-2" style={{alignItems: 'center', gap: '3rem'}}>
              <div className="hero-content" style={{textAlign: 'left', margin: '0', maxWidth: '100%'}}>
                <h1 style={{textAlign: 'left'}}>Maîtrisez l'IA et les Outils Numériques</h1>
                <p className="hero-subtitle" style={{textAlign: 'left'}}>
                  FormaPrompt forme les professionnels, étudiants et personnes en reconversion aux usages concrets de l'IA générative, du prompt engineering et des outils bureautiques.
                </p>
                <div className="hero-actions" style={{justifyContent: 'flex-start'}}>
                  <Link to="/contact" className="btn btn-primary">Demander un programme</Link>
                  <Link to="/a-propos" className="btn btn-outline">Découvrir FormaPrompt</Link>
                </div>
              </div>
              <div className="hero-image-container" style={{position: 'relative'}}>
                <div style={{
                  position: 'absolute',
                  top: '-15px',
                  right: '-15px',
                  bottom: '15px',
                  left: '15px',
                  background: 'var(--color-primary-light)',
                  borderRadius: '16px',
                  opacity: '0.2',
                  zIndex: '0'
                }}></div>
                <img
                  src="/assets/photo page d'accueil.png"
                  alt="Session de formation FormaPrompt"
                  style={{
                    width: '100%',
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    position: 'relative',
                    zIndex: '1',
                    border: '4px solid white'
                  }}
                />
              </div>
            </div>
          </div>
        </section>
        {/* Services Section */}
        <section className="section section-light">
          <div className="container">
            <div className="text-center mb-8">
              <h2>Nos Domaines de Formation</h2>
              <p style={{color: 'var(--color-text-light)'}}>Des parcours adaptés pour développer vos compétences numériques</p>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {/* Offer 1 */}
              <div className="card">
                <Bot size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Acculturation IA Générative</h3>
                <p className="mb-3">Comprendre les usages, les limites, les risques et les bonnes pratiques pour intégrer l'IA dans votre quotidien professionnel.</p>
                <Link to="/formation-ia-generative" className="link-arrow">En savoir plus &rarr;</Link>
              </div>
              {/* Offer 2 */}
              <div className="card">
                <BookOpen size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Prompt Engineering</h3>
                <p className="mb-3">Apprendre à construire de bons prompts, créer des workflows et produire des livrables fiables avec ChatGPT, Copilot ou Claude.</p>
                <Link to="/formation-prompt-engineering" className="link-arrow">En savoir plus &rarr;</Link>
              </div>
              {/* Offer 3 */}
              <div className="card">
                <Monitor size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Bureautique Pro</h3>
                <p className="mb-3">Maîtriser Word, Excel, PowerPoint, Outlook et Teams pour gagner en efficacité et en productivité.</p>
                <Link to="/formation-bureautique" className="link-arrow">En savoir plus &rarr;</Link>
              </div>
              {/* Offer 4 */}
              <div className="card">
                <ShieldCheck size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Acculturation IA &amp; AI Act</h3>
                <p className="mb-3">Comprendre les obligations essentielles et préparer un premier plan d'action avant l'échéance-clé du 2 août 2026.</p>
                <Link to="/formation-ia-act-conformite" className="link-arrow">Découvrir la formation 4 h &rarr;</Link>
              </div>
            </div>
          </div>
        </section>
        {/* Pourquoi choisir FormaPrompt Section */}
        <section className="section section-light">
          <div className="container">
            <div className="text-center mb-8">
              <h2>Pourquoi choisir FormaPrompt ?</h2>
              <p style={{color: 'var(--color-text-light)', maxWidth: '800px', margin: '0 auto'}}>
                FormaPrompt propose des formations centrées sur les usages réels. L'objectif n'est pas seulement de présenter des outils, mais d'aider chaque participant à comprendre comment les utiliser avec méthode, autonomie et discernement.
              </p>
              <p style={{color: 'var(--color-text-light)', maxWidth: '800px', margin: '1rem auto 0'}}>
                Les formations sont construites avec une attention particulière portée à la pédagogie, à la clarté des explications et à la progression des apprentissages.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem' }}>
              <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Approche claire et progressive</h3>
                <p>Des contenus expliqués étape par étape, accessibles même aux personnes moins à l'aise avec le numérique.</p>
              </div>
              <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Exercices pratiques</h3>
                <p>Des manipulations, exemples et cas d'usage pour favoriser l'apprentissage actif.</p>
              </div>
              <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Double expertise IA et bureautique</h3>
                <p>Une articulation pertinente entre les outils bureautiques traditionnels et l'IA générative.</p>
              </div>
              <div className="card" style={{ flex: '1 1 350px', maxWidth: '450px' }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Usages responsables</h3>
                <p>Vérification des résultats, confidentialité des données, compréhension des limites des outils et développement de l'esprit critique.</p>
              </div>
            </div>
          </div>
        </section>
        {/* Publics Section */}
        <section className="section">
          <div className="container">
            <div className="grid grid-cols-2" style={{alignItems: 'center'}}>
              <div>
                <h2 className="mb-3">A qui s'adressent nos formations ?</h2>
                <p className="mb-4">Notre approche s'adapte à vos besoins spécifiques, que vous soyez un professionnel en activité ou en recherche d'opportunités.</p>
                <ul className="feature-list">
                  <li><CheckCircle size={20} color="var(--color-primary)" /> <strong>Dirigeants de PME :</strong> Formez vos équipes à utiliser l'IA de manière utile.</li>
                  <li><CheckCircle size={20} color="var(--color-primary)" /> <strong>Organismes de formation :</strong> Enrichissez votre offre pédagogique.</li>
                  <li><CheckCircle size={20} color="var(--color-primary)" /> <strong>Salariés &amp; Reconversion :</strong> Développez des compétences mobilisables.</li>
                  <li><CheckCircle size={20} color="var(--color-primary)" /> <strong>Collectivités :</strong> Sensibilisation aux usages responsables (RGPD, IA Act).</li>
                </ul>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img
                  src="/assets/a_qui_sadresse_nos_formations.png"
                  alt="Public visé par les formations FormaPrompt"
                  loading="lazy"
                  style={{ maxWidth: '100%', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            </div>
          </div>
        </section>
        {/* Témoignages Section */}
        <section className="section section-light">
          <div className="container">
            <div className="text-center mb-8">
              <h2>Ce qu'ils en pensent</h2>
               <p style={{color: 'var(--color-text-light)'}}>Découvrez des retours d’apprenants et des recommandations publiques sourcées</p>
            </div>
            <div className="grid grid-cols-3">
              {testimonials.map((t, index) => (
                <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {Number.isFinite(t.rating_overall) && (
                      <div aria-label={`Note : ${t.rating_overall} sur 5`} style={{ display: 'flex', gap: '4px', marginBottom: '1rem', color: '#fbbf24' }}>
                        {'★'.repeat(t.rating_overall)}{'☆'.repeat(5 - t.rating_overall)}
                      </div>
                    )}
                    <p style={{ fontStyle: 'italic', marginBottom: '1.5rem', color: 'var(--color-text)' }}>
                      "{t.public_testimonial}"
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: index % 3 === 0 ? 'var(--color-primary)' : index % 3 === 1 ? 'var(--color-secondary)' : 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                      {t.student_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: '0', fontSize: '1rem' }}>{formatName(t.student_name)}</h4>
                      {t.source_url ? (
                        <a
                          href={t.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', textDecoration: 'underline' }}
                        >
                          {t.course_name}
                        </a>
                      ) : (
                        <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--color-text-light)' }}>{t.course_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* CTA Section */}
        <section className="section section-dark text-center">
          <div className="container">
            <h2 className="mb-2">Prêt à développer vos compétences ?</h2>
            <p className="mb-4" style={{maxWidth: '600px', margin: '0 auto 2rem'}}>
              Contactez-nous pour évaluer vos besoins et construire une formation sur-mesure adaptée à vos objectifs et à votre niveau.
            </p>
            <Link to="/contact" className="btn btn-primary" style={{backgroundColor: 'white', color: 'var(--color-secondary)'}}>
              Demander un devis
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
