import { Link } from 'react-router-dom';
import { Bot, BookOpen, Monitor, CheckCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Home.css';
import SEO from '../components/SEO';
import { SITE_CONFIG } from '../config/site';
import { STUDIO_PRIVACY_COPY } from '../config/studioPrivacy';

const SUPERPROF_PROFILE_URL = SITE_CONFIG.socialProfiles.superprof;

const homeStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_CONFIG.baseUrl}/#organization`,
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.urls.home,
      logo: SITE_CONFIG.assets.logo,
      description: 'Organisme de formation professionnelle en intelligence artificielle générative, prompt engineering et outils bureautiques.',
      founder: {
        '@type': 'Person',
        name: SITE_CONFIG.responsibleName,
      },
      sameAs: [SUPERPROF_PROFILE_URL],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_CONFIG.baseUrl}/#website`,
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.urls.home,
      inLanguage: 'fr-FR',
      publisher: {
        '@id': `${SITE_CONFIG.baseUrl}/#organization`,
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_CONFIG.urls.studio}#application`,
      name: 'FormaPrompt Studio',
      url: SITE_CONFIG.urls.studio,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Navigateur web',
      inLanguage: 'fr-FR',
      isAccessibleForFree: true,
      description: 'Outil pédagogique gratuit pour structurer un prompt avec la méthode CROP, obtenir un score expliqué et repérer les informations manquantes.',
      publisher: {
        '@id': `${SITE_CONFIG.baseUrl}/#organization`,
      },
    },
  ],
};

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
        title="FormaPrompt | Formations IA, prompts et bureautique"
        description="Formations en IA générative, prompt engineering et bureautique. Découvrez les parcours FormaPrompt et le Diagnostic IA Express pour préciser vos besoins."
        url={SITE_CONFIG.urls.home}
        image={SITE_CONFIG.assets.logo}
        jsonLd={homeStructuredData}
      />
      <div className="home">
        {/* Hero Section */}
        <section className="hero">
          <div className="container hero-container">
            <div className="grid grid-cols-2" style={{alignItems: 'center', gap: '3rem'}}>
              <div className="hero-content" style={{textAlign: 'left', margin: '0', maxWidth: '100%'}}>
                <h1 style={{textAlign: 'left'}}>Formations en IA, Prompt Engineering et Bureautique</h1>
                <p className="hero-subtitle" style={{textAlign: 'left'}}>
                  FormaPrompt forme les professionnels, étudiants et personnes en reconversion aux usages concrets de l'IA générative, du prompt engineering et des outils bureautiques.
                </p>
                <div className="hero-actions" style={{justifyContent: 'flex-start'}}>
                  <a href="#formations" className="btn btn-primary">Voir les formations</a>
                  <Link to="/diagnostic-ia" className="btn btn-outline">Découvrir le Diagnostic IA</Link>
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
                  src="/assets/photo page d'accueil.png?v=20260809"
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
        <section id="formations" className="section section-light" aria-labelledby="home-formations-title">
          <div className="container">
            <div className="text-center mb-8">
              <h2 id="home-formations-title">Choisissez votre formation</h2>
              <p style={{color: 'var(--color-text-light)'}}>Consultez le programme, les modalités et le tarif de chaque parcours. Selon la formation, inscrivez-vous en ligne ou demandez un devis adapté à votre besoin.</p>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {/* Offer 1 */}
              <div className="card">
                <Bot size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">IA générative</h3>
                <p className="mb-3">Un parcours accompagné de 10 heures pour comprendre les usages, pratiquer avec méthode, vérifier les résultats et protéger les données.</p>
                <Link to="/formation-ia-generative" className="link-arrow">Découvrir la formation 10 h &rarr;</Link>
              </div>
              {/* Offer 2 */}
              <div className="card">
                <BookOpen size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Prompt Engineering</h3>
                <p className="mb-3">Apprendre à construire de bons prompts, créer des workflows et produire des livrables fiables avec ChatGPT, Copilot ou Claude.</p>
                <Link to="/formation-prompt-engineering" className="link-arrow">Voir le programme Prompt Engineering &rarr;</Link>
              </div>
              {/* Offer 3 */}
              <div className="card">
                <Monitor size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Bureautique Pro</h3>
                <p className="mb-3">Maîtriser Word, Excel, PowerPoint, Outlook et Teams pour gagner en efficacité et en productivité.</p>
                <Link to="/formation-bureautique" className="link-arrow">Voir les formations bureautiques &rarr;</Link>
              </div>
              {/* Offer 4 */}
              <div className="card">
                <ShieldCheck size={40} color="var(--color-primary)" className="mb-2" />
                <h3 className="card-title">Acculturation IA &amp; AI Act</h3>
                <p className="mb-3">Comprendre les enjeux de l'AI Act et préparer un premier plan d'action pour des usages professionnels responsables.</p>
                <Link to="/formation-ia-act-conformite" className="link-arrow">Découvrir la formation 4 h &rarr;</Link>
              </div>
            </div>
          </div>
        </section>
        {/* FormaPrompt Studio Section */}
        <section className="section home-studio" aria-labelledby="home-studio-title">
          <div className="container">
            <div className="home-studio-card">
              <div className="home-studio-content">
                <p className="home-studio-eyebrow">
                  <Sparkles size={20} aria-hidden="true" />
                  Outil gratuit, accessible à tous
                </p>
                <h2 id="home-studio-title">Structurez vos prompts avec FormaPrompt Studio</h2>
                <p>
                  Le Studio vous guide avec la méthode CROP — Contexte, Rôle, Objectif et Précisions — pour construire un prompt professionnel, obtenir un score de qualité expliqué et repérer les informations manquantes.
                </p>
                <ul className="home-studio-benefits">
                  <li><CheckCircle size={20} aria-hidden="true" /> Seize cas d’usage pour écrire, transmettre, analyser, créer et construire.</li>
                  <li><CheckCircle size={20} aria-hidden="true" /> Une analyse de votre prompt, sans appel à un fournisseur externe.</li>
                  <li><CheckCircle size={20} aria-hidden="true" /> {STUDIO_PRIVACY_COPY.home}</li>
                </ul>
                <div className="home-studio-actions">
                  <Link to="/studio" className="btn btn-primary">Essayer gratuitement le Studio</Link>
                  <Link to="/formation-prompt-engineering" className="link-arrow">Découvrir la formation Prompt Engineering &rarr;</Link>
                </div>
              </div>
              <aside className="home-studio-method" aria-label="Les quatre composantes de la méthode CROP">
                <p className="home-studio-method-title">Méthode CROP</p>
                <ol>
                  <li><strong>C</strong><span>Contexte</span></li>
                  <li><strong>R</strong><span>Rôle</span></li>
                  <li><strong>O</strong><span>Objectif</span></li>
                  <li><strong>P</strong><span>Précisions</span></li>
                </ol>
                <p>Construisez, diagnostiquez, améliorez puis copiez votre prompt.</p>
              </aside>
            </div>
          </div>
        </section>
        {/* Pourquoi choisir FormaPrompt Section */}
        <section className="section home-orientation" aria-labelledby="home-orientation-title">
          <div className="container">
            <h2 id="home-orientation-title">Un accompagnement selon votre besoin</h2>
            <div className="grid grid-cols-2">
              <article className="card">
                <h3>Diagnostic IA Express : préciser vos priorités</h3>
                <p>Un accompagnement individuel à distance de 90 minutes pour analyser vos tâches, identifier trois opportunités IA prioritaires et construire un plan d'action. Ce service est distinct d'une formation et de l'analyse de prompts proposée par le Studio.</p>
                <Link to="/diagnostic-ia" className="link-arrow">Voir le déroulement et le tarif du Diagnostic IA &rarr;</Link>
              </article>
              <article id="training-lab" className="card">
                <h3>Training Lab : pratiquer en formation</h3>
                <p>Le Training Lab est un espace de pratique réservé aux apprenants. Il ne s'agit pas d'un outil public comme le Studio : ses modalités d'accès sont communiquées dans le cadre de la formation concernée.</p>
                <p>Déjà inscrit ? Retrouvez vos formations et vos ressources dans votre espace apprenant.</p>
                <Link to="/dashboard" className="link-arrow">Retrouver mon espace apprenant &rarr;</Link>
              </article>
            </div>
          </div>
        </section>
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
                  src="/assets/a_qui_sadresse_nos_formations.png?v=20260809"
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
