import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ChevronRight, Download, Lightbulb } from 'lucide-react';
import SEO from './SEO';
import { guideDownloads } from '../data/guideDownloads';
import '../pages/GuideGPT56.css';
import './ToolGuide.css';

export function SourceLink({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (nouvel onglet)</span></a>;
}

function CopyPrompt({ prompt }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.map(([label, content]) => `${label} : ${content}`).join('\n\n'));
      setMessage('Consigne copiée. Vous pouvez la coller dans votre outil.');
    } catch {
      setMessage('Copie indisponible. Sélectionnez le texte de la consigne pour le copier.');
    }
  }
  return <div className="tool-guide-copy"><button type="button" onClick={copy}>Copier la consigne</button><p role="status">{message}</p></div>;
}

export function GuideCases({ cases, id, title = 'Quatre cas pratiques avec des prompts CROP', reopenSelectedCase = false }) {
  const [selected, setSelected] = useState(0);
  const panels = useRef([]);
  function selectCase(index) {
    setSelected(index);
    if (reopenSelectedCase) {
      panels.current.forEach((panel, panelIndex) => { if (panel) panel.open = panelIndex === index; });
    }
  }
  return <section className="gpt-section container" id={`${id}-cas`} aria-labelledby={`${id}-cas-title`}>
    <div className="gpt-section-heading"><span className="gpt-step">À vous de choisir</span><h2 id={`${id}-cas-title`}>{title}</h2><p>CROP : Contexte, Rôle, Objectif, Précisions. Adaptez les crochets avec des informations fictives, publiques ou autorisées.{id === 'claude' && ' Les réglages proposés sont des conseils pédagogiques à tester.'}</p></div>
    <div className="gpt-chooser">
      <div className="gpt-choices" role="group" aria-label="Choisir une situation de travail">{cases.map((item, index) => <button type="button" key={item.title} aria-pressed={selected === index} aria-controls={`${id}-case-${index}`} className={selected === index ? 'active' : ''} onClick={() => selectCase(index)}><span><strong>{item.title}</strong><small>{item.need}</small></span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>
      <div className="tool-guide-panels">{cases.map((item, index) => <details ref={panel => { panels.current[index] = panel; }} id={`${id}-case-${index}`} className="gpt-recommendation" key={item.title} open={selected === index}>
        <summary>{item.title}</summary><p className="gpt-reco-label">Un point de départ</p><p><strong>Fonction :</strong> {item.feature}</p>{item.setting && <p><strong>Réglage :</strong> {item.setting}</p>}
        <div className="tool-guide-prompt">{item.prompt.map(([label, content]) => <p key={label}><strong>{label} :</strong> {content}</p>)}</div>
        <CopyPrompt prompt={item.prompt} />
        <p className="tool-guide-check"><Check size={20} aria-hidden="true" /><span><strong>Contrôle humain :</strong> {item.check}</span></p>
      </details>)}</div>
    </div>
    <p className="tool-guide-under">Préparez votre demande dans le <Link to="/studio/">Studio FormaPrompt</Link>. {id === 'claude' ? "Si une option n'apparaît pas dans votre compte, conservez les réglages disponibles." : "Vérifiez les conditions d'accès avant de reproduire un cas dans votre application."}</p>
  </section>;
}

export default function ToolGuide({ id, title, seoTitle, description, lead, steps, memory, sections, children, sourceDate = '2026-10-31' }) {
  const url = `https://formaprompt.com/guides/${id}-guide-pratique`;
  const download = guideDownloads[id];
  const sourceDateLabel = new Date(`${sourceDate}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: title, description, inLanguage: 'fr-FR', mainEntityOfPage: url, dateModified: sourceDate, author: { '@type': 'Person', name: 'Thierry FREZARD' }, publisher: { '@type': 'Organization', name: 'FormaPrompt' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://formaprompt.com/' }, { '@type': 'ListItem', position: 2, name: 'Guides pratiques', item: 'https://formaprompt.com/guides' }, { '@type': 'ListItem', position: 3, name: title, item: url }] },
  ] };
  return <>
    <SEO title={seoTitle} description={description} url={url} type="article" jsonLd={jsonLd} />
    <noscript dangerouslySetInnerHTML={{ __html: '<style>.advertising-consent, .tool-guide .gpt-choices, .tool-guide-copy { display: none !important; }</style>' }} />
    <div className={`gpt-guide tool-guide tool-guide-${id}`}>
      <section className="gpt-hero" aria-labelledby={`${id}-title`}><div className="container gpt-hero-inner">
        <img className="tool-guide-print-logo" src="/assets/logo-new.png" width="80" height="80" alt="FormaPrompt" />
        <Link className="tool-guide-back" to="/guides">Tous les guides pratiques</Link>
        <p className="gpt-eyebrow"><BookOpen size={18} aria-hidden="true" /> Guide pratique FormaPrompt</p><h1 id={`${id}-title`}>{title}</h1><p className="gpt-hero-lead">{lead}</p>
        <div className="gpt-equation">{steps.map((step, index) => <div key={step}><strong>{index + 1}</strong><span>{step}</span></div>)}</div>
        <a className="gpt-scroll-link" href={`#${id}-cas`}>Choisir mon cas pratique <ChevronRight size={18} aria-hidden="true" /></a>
        <p className="tool-guide-date">Sources officielles consultées le {sourceDateLabel}</p>
        <p className="tool-guide-pdf-return">Retrouver ce guide sur FormaPrompt : <a href={url}>{url}</a></p>
      </div></section>
      <nav className="tool-guide-toc container" aria-label="Dans ce guide">{sections.map(([anchor, label]) => <a key={anchor} href={`#${id}-${anchor}`}>{label}</a>)}</nav>
      <div className="container"><div className="gpt-memory-tip"><Lightbulb size={28} aria-hidden="true" /><div><strong>Le repère simple</strong><p>{memory}</p></div></div></div>
      {children}
      <section className="tool-guide-cta container" aria-labelledby={`${id}-practice`}><h2 id={`${id}-practice`}>Pratiquer avec FormaPrompt</h2><p>Choisissez une tâche cette semaine, préparez un prompt CROP et notez les corrections nécessaires. Pour être accompagné dans la pratique et la vérification des résultats, découvrez le parcours e-learning.</p><Link className="btn btn-primary" to="/formation-ia-generative-elearning">Découvrir la formation IA générative <ArrowRight size={18} aria-hidden="true" /></Link></section>
      {download && <section className="tool-guide-download container" aria-labelledby={`${id}-download-title`}><div><p className="gpt-step">À conserver</p><h2 id={`${id}-download-title`}>Télécharger le guide en PDF</h2><p>Retrouvez le guide complet, les tableaux, les cas pratiques et les sources dans un document gratuit à consulter ou à imprimer.</p><a className="btn btn-primary" href={download.href} download={download.filename}><Download size={19} aria-hidden="true" /> Télécharger le guide {download.name} en PDF</a><p className="tool-guide-download-note">Le PDF correspond aux informations datées de cet article. Les offres et les interfaces peuvent évoluer.</p></div></section>}
    </div>
  </>;
}
