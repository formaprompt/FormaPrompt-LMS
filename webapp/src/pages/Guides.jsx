import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3 } from 'lucide-react';
import SEO from '../components/SEO';
import { practicalGuides } from '../data/practicalGuides';
import './Guides.css';

export default function Guides() {
  const canonicalUrl = 'https://formaprompt.com/guides';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Guides pratiques FormaPrompt', url: canonicalUrl, inLanguage: 'fr-FR' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://formaprompt.com/' },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: canonicalUrl },
      ] },
    ],
  };

  return <div className="guides-page">
    <SEO title="Guides pratiques IA et prompt engineering – FormaPrompt" description="Des guides FormaPrompt pour comprendre l’IA générative, structurer un prompt et examiner les premiers repères de l’AI Act." url={canonicalUrl} jsonLd={jsonLd} />
    <section className="guides-hero" aria-labelledby="guides-title">
      <div className="container guides-hero-inner">
        <p className="guides-eyebrow"><BookOpen size={18} /> Guides pratiques</p>
        <h1 id="guides-title">Mieux utiliser l’IA, sans lui confier ce qui doit rester humain.</h1>
        <p>Des repères courts pour tester, formuler une demande et vérifier un résultat dans un cadre professionnel.</p>
      </div>
    </section>
    <section className="container guides-list-section" aria-label="Les guides FormaPrompt">
      <div className="guides-card-grid">
        {practicalGuides.map((guide, index) => <article className="guides-index-card" key={guide.slug}>
          <p className="guides-card-number" aria-hidden="true">0{index + 1}</p>
          <p className="guides-tag">{guide.label}</p>
          <h2><Link to={`/guides/${guide.slug}`}>{guide.title}</Link></h2>
          <p>{guide.description}</p>
          <div className="guides-card-footer"><span><Clock3 size={16} /> {guide.readingTime}</span><Link to={`/guides/${guide.slug}`}>Lire le guide <ArrowRight size={17} /></Link></div>
        </article>)}
      </div>
    </section>
  </div>;
}
