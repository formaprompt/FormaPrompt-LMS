import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseSummary from '../components/CourseSummary';
import ExcelEnrollment from '../components/ExcelEnrollment';
import { SITE_CONFIG } from '../config/site';
import { excelCourses, excelPrices } from '../data/excelCourses';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness';
import './FormationExcel.css';

const canonical = `${SITE_CONFIG.baseUrl}/formation-excel`;
const breadcrumbs = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_CONFIG.baseUrl },
    { '@type': 'ListItem', position: 2, name: 'Formations Bureautique', item: `${SITE_CONFIG.baseUrl}/formation-bureautique` },
    { '@type': 'ListItem', position: 3, name: 'Formations Excel', item: canonical },
  ],
};

export default function FormationExcel() {
  return (
    <div className="excel-page">
      <SEO
        title="Formations Excel : Initiation, Perfectionnement, Avancé | FormaPrompt"
        description="Choisissez votre formation Excel : Initiation, Perfectionnement ou Avancé. 14 h par niveau, exercices professionnels. Inter 690 €, intra et individuel."
        url={canonical}
        image={`${SITE_CONFIG.baseUrl}/assets/formation%20bureautique.png`}
        jsonLd={breadcrumbs}
      />
      <section className="excel-hero">
        <div className="container">
          <nav aria-label="Fil d’Ariane" className="excel-breadcrumb">
            <Link to="/">Accueil</Link><span aria-hidden="true">/</span>
            <Link to="/formation-bureautique">Bureautique</Link><span aria-hidden="true">/</span>
            <span aria-current="page">Excel</span>
          </nav>
          <p className="excel-eyebrow">Bureautique · Microsoft Excel</p>
          <h1>Formations Excel&nbsp;:<br />le bon niveau pour vos usages</h1>
          <p className="excel-lead">Créer ses premiers tableaux, fiabiliser ses données ou concevoir des analyses dynamiques : trois formations pour progresser à partir de vos acquis.</p>
          <div className="excel-actions">
            <a className="btn excel-btn-light" href="#choisir">Quel niveau choisir ?</a>
            <a className="btn excel-btn-ghost" href="#tarifs">Voir les tarifs</a>
          </div>
          <CourseSummary id="excel-en-bref" items={[
            { label: 'Durée par niveau', value: '14 heures · 2 jours de 7 heures' },
            { label: 'Organisation', value: 'Possibilité de 4 demi-journées' },
            { label: 'Formats', value: 'Inter, intra ou individuel' },
          ]} />
        </div>
      </section>

      <section className="excel-section container" id="choisir" aria-labelledby="excel-choisir">
        <p className="excel-eyebrow">Votre point de départ</p>
        <h2 id="excel-choisir">Quel niveau Excel choisir ?</h2>
        <p className="excel-intro">Choisissez selon ce que vous savez déjà faire. Chaque niveau est une formation de 14 heures ; il n’est pas nécessaire de suivre les trois si vous en maîtrisez déjà les prérequis.</p>
        <div className="excel-grid">
          {excelCourses.map((course, index) => (
            <article className="excel-card excel-level-card" key={course.id}>
              <span className="excel-step" aria-hidden="true">0{index + 1}</span>
              <h3>{course.level}</h3>
              <p>{course.situation}</p>
              <p className="excel-promise">« {course.promise} »</p>
              <a href={`#${course.id}`} className="excel-text-link">Voir le niveau {course.level.toLowerCase()} <span aria-hidden="true">→</span></a>
            </article>
          ))}
        </div>
        <p className="excel-help">Un doute entre deux niveaux ? <Link to="/contact">Échangeons sur vos usages et vos acquis.</Link></p>
      </section>

      <section className="excel-section excel-tinted" aria-labelledby="excel-programmes">
        <div className="container">
          <p className="excel-eyebrow">Les trois programmes</p>
          <h2 id="excel-programmes">Des compétences concrètes, une progression claire</h2>
          <p className="excel-intro">Pour les salariés, indépendants, personnes en reconversion ou en recherche d’emploi qui utilisent Excel dans un contexte professionnel.</p>
          <div className="excel-programmes">
            {excelCourses.map((course) => (
              <article className="excel-card excel-programme" id={course.id} key={course.id} aria-labelledby={`${course.id}-titre`}>
                <p className="excel-duration">14 h · 2 jours · ou 4 demi-journées</p>
                <h3 id={`${course.id}-titre`}>Excel {course.level} - {course.title}</h3>
                <p className="excel-objective"><strong>Objectif :</strong> {course.objective}</p>
                <div className="excel-programme-context">
                  <p><strong>Public visé</strong>{course.audience}</p>
                  <p><strong>Prérequis</strong>{course.prerequisites}</p>
                </div>
                <details>
                  <summary>Programme et compétences — {course.level}</summary>
                  <ol className="excel-sequences">
                    {course.sequences.map((sequence) => (
                      <li key={sequence.title}><h4>{sequence.title}</h4><p>{sequence.content}</p></li>
                    ))}
                  </ol>
                  <p className="excel-boundary"><strong>Limites du programme.</strong> {course.boundary}</p>
                </details>
                <p className="excel-outcome"><strong>Application pratique :</strong> {course.outcome}</p>
                <ExcelEnrollment course={course} />
              </article>
            ))}
          </div>
          <aside className="excel-note" aria-labelledby="excel-versions">
            <h3 id="excel-versions">Microsoft 365 et compatibilité avec vos fichiers</h3>
            <p>RECHERCHEV et RECHERCHEH restent enseignées en Perfectionnement, notamment pour Excel 2016 et les fichiers historiques. RECHERCHEX complète ces méthodes sur les versions compatibles.</p>
            <p>Le niveau Avancé privilégie Excel Microsoft 365 : les fonctions récentes, dont les tableaux dynamiques et LAMBDA, dépendent de votre version. Précisez votre version d’Excel lors de la demande pour vérifier son adéquation au programme.</p>
          </aside>
        </div>
      </section>

      <section className="excel-section container" id="tarifs" aria-labelledby="excel-tarifs">
        <p className="excel-eyebrow">Un tarif commun aux trois niveaux</p>
        <h2 id="excel-tarifs">Choisissez votre modalité de formation</h2>
        <p className="excel-intro">Ces tarifs s’appliquent à une formation de 14 heures, au niveau Initiation, Perfectionnement ou Avancé.</p>
        <div className="excel-grid">
          {excelPrices.map((offer) => (
            <article className="excel-card excel-price-card" key={offer.mode}>
              <h3>{offer.mode}</h3>
              <p className="excel-price">{offer.price}</p>
              <p className="excel-price-unit">{offer.unit} · 14 h</p>
              <p>{offer.description}</p>
            </article>
          ))}
        </div>
        <p className="excel-tax">{FORMAPROMPT_TAX.statement}.</p>
        <div className="excel-actions"><a className="btn btn-primary" href="#choisir">Choisir mon niveau et m’inscrire</a></div>
      </section>

      <section className="excel-section excel-tinted" aria-labelledby="excel-modalites">
        <div className="container">
          <h2 id="excel-modalites">Apprendre par la pratique</h2>
          <div className="excel-grid excel-grid-two">
            <article className="excel-card">
              <h3>Exercices et évaluations</h3>
              <p>La progression alterne explications, démonstrations et exercices sur des situations professionnelles : suivi d’activité, calculs, recherche d’informations ou analyse de données, selon le niveau.</p>
              <p>Un positionnement avant la formation permet de vérifier les prérequis. Des évaluations progressives et un cas pratique final permettent de vérifier les compétences acquises.</p>
            </article>
            <article className="excel-card">
              <h3>Organisation et accessibilité</h3>
              <p>Présentiel ou distanciel, selon l’organisation convenue. Chaque niveau représente 14 heures : 2 jours de 7 heures, avec la possibilité de 4 demi-journées.</p>
              <p>Les dates, le lieu ou les conditions de connexion et la version d’Excel sont à préciser lors de la demande. Signalez vos besoins d’adaptation pour étudier les modalités d’accueil et d’accompagnement.</p>
              <Link to="/contact" className="excel-text-link">Préparer ma formation</Link>
            </article>
          </div>
          <aside className="excel-note" aria-labelledby="excel-tosa">
            <h3 id="excel-tosa">Et la certification TOSA Excel ?</h3>
            <p>La certification officielle TOSA Excel peut être envisagée comme une option ou un prolongement, distinct de la formation FormaPrompt. Ses conditions d’accès et de passage sont à examiner séparément. La formation ne garantit aucun score à la certification.</p>
          </aside>
        </div>
      </section>

      <section className="excel-section container excel-closing" aria-labelledby="excel-contact">
        <h2 id="excel-contact">Construisons votre parcours Excel</h2>
        <p>Indiquez votre niveau actuel, vos objectifs, votre version d’Excel et le nombre de participants. Nous pourrons préciser la formation et les modalités adaptées.</p>
        <div className="excel-actions">
          <Link to="/contact" className="btn btn-primary">Parler de mon projet</Link>
          <Link to="/formation-bureautique" className="excel-text-link">Toutes les formations bureautiques</Link>
        </div>
      </section>
    </div>
  );
}
