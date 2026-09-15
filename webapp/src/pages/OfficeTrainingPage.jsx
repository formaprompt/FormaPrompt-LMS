import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseSummary from '../components/CourseSummary';
import OfficeEnrollment from '../components/OfficeEnrollment';
import { SITE_CONFIG } from '../config/site';
import { excelPrices as officePrices } from '../data/excelCourses';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness';
import './FormationOffice.css';

export default function OfficeTrainingPage({ tool, slug, heading, lead, courses, compatibility }) {
  const canonical = `${SITE_CONFIG.baseUrl}/${slug}`;
  const levels = courses.map(course => course.level).join(' et ');
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_CONFIG.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Formations Bureautique', item: `${SITE_CONFIG.baseUrl}/formation-bureautique` },
      { '@type': 'ListItem', position: 3, name: `Formation ${tool}`, item: canonical },
    ],
  };

  return (
    <div className="office-page">
      <SEO
        title={`${heading} | FormaPrompt`}
        description={`${heading}. Programme de 14 heures, exercices professionnels et tarifs communs aux formations bureautiques.`}
        url={canonical}
        image={`${SITE_CONFIG.baseUrl}/assets/formation%20bureautique.png`}
        jsonLd={breadcrumb}
      />

      <section className="office-hero">
        <div className="container">
          <nav aria-label="Fil d’Ariane" className="office-breadcrumb">
            <Link to="/">Accueil</Link><span aria-hidden="true">/</span>
            <Link to="/formation-bureautique">Bureautique</Link><span aria-hidden="true">/</span>
            <span>{tool}</span>
          </nav>
          <p className="office-eyebrow">Formation bureautique · Microsoft 365</p>
          <h1>{heading}</h1>
          <p className="office-lead">{lead}</p>
          <div className="office-actions">
            <a className="btn office-btn-light" href="#programmes">Consulter le programme</a>
            <a className="btn office-btn-ghost" href="#tarifs">Voir les tarifs</a>
          </div>
          <CourseSummary
            id={`${tool.toLowerCase()}-summary`}
            items={[
              { label: 'Durée', value: '14 heures · 2 jours ou 4 demi-journées' },
              { label: 'Niveau', value: levels },
              { label: 'Modalités', value: 'Présentiel ou classe virtuelle, selon l’organisation convenue' },
              { label: 'Tarif inter', value: '690 € par participant' },
            ]}
          />
        </div>
      </section>

      <section className="office-section container" id="programmes" aria-labelledby={`${tool.toLowerCase()}-programmes`}>
        <p className="office-eyebrow">Une progression guidée et concrète</p>
        <h2 id={`${tool.toLowerCase()}-programmes`}>{courses.length > 1 ? `Choisissez votre niveau ${tool}` : `Programme ${tool} ${courses[0].level}`}</h2>
        <p className="office-intro">Chaque formation alterne démonstrations courtes, pratique guidée, exercices progressifs et production finale. Un positionnement initial permet de confirmer le niveau adapté.</p>
        <div className="office-programmes">
          {courses.map(course => (
            <article className="office-card office-programme" key={course.id} aria-label={`${tool} ${course.level} - ${course.title}`}>
              <p className="office-duration">{tool} {course.level} · 14 h</p>
              <h3>{course.title}</h3>
              <div className="office-programme-context">
                <p><strong>Public visé</strong>{course.audience}</p>
                <p><strong>Prérequis</strong>{course.prerequisites}</p>
              </div>
              <p className="office-objective"><strong>Objectif pédagogique :</strong> {course.objective}</p>
              <details>
                <summary>Voir le programme détaillé</summary>
                <ol className="office-sequences">
                  {course.sequences.map(sequence => (
                    <li key={sequence.title}><h4>{sequence.title}</h4><p>{sequence.content}</p></li>
                  ))}
                </ol>
              </details>
              <p className="office-outcome"><strong>Application pratique :</strong> {course.outcome}</p>
              <OfficeEnrollment tool={tool} course={course} />
            </article>
          ))}
        </div>
        <article className="office-evaluation" aria-labelledby={`${tool.toLowerCase()}-evaluation`}>
          <h3 id={`${tool.toLowerCase()}-evaluation`}>Évaluation des acquis</h3>
          <p>Le positionnement initial sert à confirmer le niveau adapté et reste distinct de l’évaluation finale. La production finale est contrôlée avec une grille de critères portant sur la qualité, la lisibilité et les compétences prévues au programme.</p>
        </article>
        <aside className="office-note" aria-labelledby={`${tool.toLowerCase()}-compatibility`}>
          <h3 id={`${tool.toLowerCase()}-compatibility`}>Version du logiciel et accessibilité</h3>
          <p>{compatibility}</p>
          <p>Signalez vos besoins d’adaptation avant la formation afin d’étudier le rythme, les supports et les modalités d’accompagnement possibles.</p>
        </aside>
      </section>

      <section className="office-section office-tinted" id="tarifs" aria-labelledby={`${tool.toLowerCase()}-tarifs`}>
        <div className="container">
          <p className="office-eyebrow">La grille commune aux formations de 14 heures</p>
          <h2 id={`${tool.toLowerCase()}-tarifs`}>Choisissez votre modalité de formation</h2>
          <div className="office-grid">
            {officePrices.map(offer => (
              <article className="office-card office-price-card" key={offer.mode}>
                <h3>{offer.mode}</h3>
                <p className="office-price">{offer.price}</p>
                <p className="office-price-unit">{offer.unit} · 14 h</p>
                <p>{offer.description}</p>
              </article>
            ))}
          </div>
          <p className="office-tax">{FORMAPROMPT_TAX.statement}.</p>
          <p className="office-intro">Les dates et l’organisation sont confirmées après échange.</p>
          <div className="office-actions"><Link to="/contact" className="btn btn-primary">Demander un devis ou des dates</Link></div>
        </div>
      </section>

      <section className="office-section container office-closing" aria-labelledby={`${tool.toLowerCase()}-contact`}>
        <h2 id={`${tool.toLowerCase()}-contact`}>Préparons votre formation {tool}</h2>
        <p>Précisez le niveau actuel, les documents à produire, la version du logiciel et le nombre de participants. FormaPrompt pourra confirmer le programme et les modalités adaptés.</p>
        <div className="office-actions">
          <Link to="/contact" className="btn btn-primary">Parler de mon besoin</Link>
          <Link to="/formation-bureautique" className="office-text-link">Toutes les formations bureautiques</Link>
        </div>
      </section>
    </div>
  );
}
