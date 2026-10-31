import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Clock3, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { createIagLearningApi } from '../lib/iagLearningApi.js';
import { createIagLearningSession } from '../lib/iagLearningSession.js';
import { iagAnchor } from '../lib/iagStructuredPolicy.js';
import IagStructuredLesson from './IagStructuredLesson.jsx';
import IagAssessmentPanel from './IagAssessmentPanel.jsx';
import IagCertificatePanel from './IagCertificatePanel.jsx';
import '../pages/CoursePlayer.css';
import './CourseProgress.css';
import './IagLearningPlayer.css';

// Navigation labels from the approved presentation; lesson metadata stays on the server.
const stageLabels = { 1: 'Prendre ses repères', 2: 'Écrire un courriel', 3: 'Rechercher et vérifier', 4: 'Travailler sur des documents', 5: 'Organiser son travail', 6: 'Créer un visuel utile', 7: 'Décomposer une tâche' };

export default function IagLearningPlayer() {
  const { user } = useAuth();
  if (!user?.id) return <section className="container section"><p role="alert">Connectez-vous pour retrouver vos leçons.</p><a href="/login">Se connecter</a></section>;
  return <LearningSession key={user.id} ownerId={user.id} />;
}
function LearningSession({ ownerId }) {
  const navigate = useNavigate();
  const api = useMemo(() => createIagLearningApi(supabase), []);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('home');
  const [worksOpened, setWorksOpened] = useState(false);
  const [homeAnchor, setHomeAnchor] = useState(null);
  const reader = useRef(null);
  const loadingMessage = useRef(null);
  const errorMessage = useRef(null);
  const readerPosition = useRef(null);
  const scope = useMemo(() => ({ api, ownerId }), [api, ownerId]);
  useEffect(() => {
    let controller;
    controller = createIagLearningSession({ api, ownerId, onState: state => setResult({ scope, controller, state }) });
    controller.load();
    return () => controller.dispose();
  }, [api, ownerId, scope]);
  const current = result?.scope === scope && result.state.ownerId === ownerId;
  const controller = current ? result.controller : null;
  const state = current ? result.state : { phase: 'loading', course: null, progress: null };
  useEffect(() => {
    if (state.phase === 'error') {
      errorMessage.current?.scrollIntoView({ block: 'start' });
      readerPosition.current = null;
      return;
    }
    if (!state.course || !state.progress) {
      loadingMessage.current?.scrollIntoView({ block: 'start' });
      readerPosition.current = null;
      return;
    }
    if (view !== 'lesson') {
      readerPosition.current = null;
      return;
    }
    if (state.phase === 'loading-document') {
      if (!readerPosition.current?.loading) reader.current?.scrollIntoView({ block: 'start' });
      readerPosition.current = { loading: true };
      return;
    }
    if (state.phase !== 'ready' || !state.document) return;
    // A save or a media refresh must not replay the last navigation scroll.
    if (readerPosition.current?.document === state.document && readerPosition.current.anchorId === state.anchorId) return;
    const anchor = state.anchorId && document.getElementById(iagAnchor(state.document.id, state.anchorId));
    (anchor || reader.current)?.scrollIntoView({ block: 'start' });
    readerPosition.current = { document: state.document, anchorId: state.anchorId };
  }, [state.anchorId, state.document, state.phase, state.course, state.progress, view]);

  useEffect(() => {
    if (view === 'home' && homeAnchor) document.getElementById(homeAnchor)?.scrollIntoView({ block: 'start' });
  }, [view, homeAnchor]);
  useEffect(() => {
    // Capture the element while mounted; ref.current may be null on cleanup.
    const element = reader.current;
    return () => element?.querySelectorAll('video').forEach(video => video.pause());
  }, [view, state.document?.id]);
  if (state.phase === 'error') return <div className="container section iag-learning-player"><section ref={errorMessage} id="iag-reader-error"><p role="alert">{state.error}</p><button type="button" onClick={() => controller.load(state.lessonId)}>Réessayer le chargement</button><p><a href="/dashboard">Mon espace apprenant</a></p></section></div>;
  if (!state.course || !state.progress) return <div className="container section iag-learning-player"><section ref={loadingMessage} id="iag-reader-loading" role="status">Chargement sécurisé de vos leçons et de votre reprise.</section></div>;
  const total = state.course.modules.length;
  const completed = state.progress.lessons.filter(item => item.status === 'completed').length;
  const busy = state.phase !== 'ready';
  const selectedIndex = state.course.modules.findIndex(item => item.id === state.lessonId);
  const selected = state.course.modules[selectedIndex];
  const finished = state.progress.lessons.some(item => item.lessonId === state.lessonId && item.status === 'completed');
  const stages = [...new Set(state.course.modules.map(module => module.stage))];
  function showHome(anchor = null) {
    if (view === 'home' && anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    setHomeAnchor(anchor); setView('home');
  }
  function showWorks() { setWorksOpened(true); setView('works'); }
  function selectLesson(lessonId) { setView('lesson'); void controller.select(lessonId); }
  function openDocument(id, anchor = null) {
    if (id === state.document?.id) {
      const target = anchor && iagAnchor(id, anchor);
      (target && document.getElementById(target) || reader.current)?.scrollIntoView({ block: 'start' });
      return;
    }
    setView('lesson'); void controller.openDocument(id, anchor);
  }
  function action(id) { showHome(id === 'iag-course-outline' ? 'iag-outline' : 'iag-progress'); }
  return <div className="container course-player-container iag-learning-player">
    <a href="/dashboard" className="iag-player-back">← Retour à mon espace apprenant</a>
    <header className="course-header"><p className="course-eyebrow">Votre parcours FormaPrompt</p><h1 className="course-title">{state.course.title}</h1>
      <div className="course-header-actions"><span className="access-badge"><ShieldCheck size={16} aria-hidden="true" /> Accès personnel au parcours</span><span className="course-duration-badge"><Clock3 size={16} aria-hidden="true" /> Environ 13 heures · {total} leçons</span></div>
      <p className="iag-player-duration">{state.course.durationLabel}. Cette durée est indicative ; vous avancez à votre rythme.</p>
    </header>
    <nav className="iag-player-screen-nav" aria-label="Naviguer dans ma formation">
      <button type="button" aria-current={view === 'home' ? 'page' : undefined} onClick={() => showHome()}>Accueil du cours</button>
      <button type="button" aria-current={view === 'lesson' ? 'page' : undefined} onClick={() => setView('lesson')}>Ma leçon en cours</button>
      <button type="button" aria-current={view === 'works' ? 'page' : undefined} onClick={showWorks}>Mes trois travaux</button>
    </nav>

    <div hidden={view !== 'home'}>
      <section id="iag-progress" className="course-progress" aria-labelledby="iag-progress-title">
        <div className="course-progress__heading"><h2 id="iag-progress-title">Votre progression</h2><strong>{Math.round(completed / total * 100)} %</strong></div>
        <progress className="course-progress__bar" value={completed} max={total} aria-label={`${completed} leçon${completed === 1 ? '' : 's'} terminée${completed === 1 ? '' : 's'} sur ${total}`} />
        <p className="course-progress__summary">{completed} leçon{completed === 1 ? '' : 's'} terminée{completed === 1 ? '' : 's'} sur {total}</p>
        <ul className="course-progress__details"><li>{total} leçons dans le parcours</li><li>Trois travaux à remettre séparément</li><li>Validation humaine des travaux</li></ul>
        <p className="course-progress__help">Vous indiquez quand votre lecture et votre activité personnelle sont terminées. Ce suivi ne mesure pas votre présence et ne valide pas vos compétences. Retrouvez vos remises et les décisions du formateur dans « Mes trois travaux ».</p>
      </section>

      <section className="course-onboarding" aria-labelledby="iag-how-title">
        <div className="course-onboarding__heading"><span className="course-onboarding__icon" aria-hidden="true"><BookOpen /></span><div><p className="course-eyebrow">Vos repères pour apprendre</p><h2 id="iag-how-title">Comment suivre votre formation</h2><p>Le questionnaire de départ est obligatoire avant l’accès aux leçons. Il n’est pas noté. Avancez ensuite une étape à la fois, en conservant vos essais.</p></div></div>
        <ol className="course-onboarding__steps">{[['Lire', 'Commencez par les objectifs et les explications de la leçon.'], ['Regarder', 'Lancez la démonstration, mettez en pause et reprenez à votre rythme.'], ['Faire', 'Réalisez l’exercice sur un cas fictif avant de consulter le corrigé.'], ['Conserver', 'Gardez vos demandes, vos réponses et les vérifications dans votre dossier.'], ['Remettre au formateur', 'À trois étapes, envoyez un travail pour recevoir un retour écrit personnalisé.']].map(([title, description], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
        <div className="course-onboarding__reminders"><h3>Trois repères utiles</h3><ul><li>Travaillez sur des données fictives, sans information confidentielle.</li><li>FormaPrompt Studio reste facultatif, mais conseillé !</li><li>Une leçon terminée ne valide pas automatiquement un travail.</li></ul></div>
        <div className="course-onboarding__reminders"><h3>Assistance</h3><p>Pour une difficulté de connexion ou une question sur votre parcours, contactez Thierry FREZARD à <a href="mailto:thierry@formaprompt.com">thierry@formaprompt.com</a>. Une réponse vous est apportée sous deux jours ouvrés. Les corrections des travaux restent prévues sous deux jours calendaires après réception.</p></div>
        <button type="button" className="btn course-onboarding__action" disabled={busy} onClick={() => setView('lesson')}>Reprendre ma leçon : {selected?.title}</button>
      </section>

      <section id="iag-outline" className="learning-path-section" aria-labelledby="iag-outline-title"><div className="learning-path-heading"><p className="course-eyebrow">Parcours pédagogique</p><h2 id="iag-outline-title" className="current-module-title">{total} leçons en {stages.length} étapes</h2><p>Ouvrez une étape puis choisissez votre leçon. Votre dernière lecture est retrouvée à la prochaine connexion.</p></div>
        <div className="learning-module-list">{stages.map(stage => {
          const modules = state.course.modules.filter(module => module.stage === stage);
          return <details key={stage} className="learning-module" open={selected?.stage === stage}><summary><span className="learning-module-number">{stage}</span><span className="learning-module-heading"><strong>{stageLabels[stage] || `Étape ${stage}`}</strong><span>{modules.length} leçon{modules.length === 1 ? '' : 's'}</span></span><span className="learning-module-duration"><BookOpen size={17} aria-hidden="true" /></span></summary>
            <div className="learning-module-content"><ol className="iag-player-lesson-list">{modules.map(module => <li key={module.id}><div><strong>{module.number && `${module.number}. `}{module.title}</strong>{module.duration && <p>{module.duration}</p>}{state.progress.lessons.some(row => row.lessonId === module.id && row.status === 'completed') && <span className="iag-player-lesson-status">Leçon indiquée comme terminée</span>}</div><button className="btn module-resource-link" type="button" disabled={busy} aria-label={`Ouvrir la leçon : ${module.title}`} aria-current={module.id === state.lessonId ? 'step' : undefined} onClick={() => selectLesson(module.id)}>Ouvrir la leçon</button></li>)}</ol></div>
          </details>;
        })}</div>
      </section>

      <section className="module-recap-card"><h2>Vos certificats FormaPrompt</h2><h3>Fin de formation</h3><p>Avec un accès actif, après le questionnaire obligatoire et la déclaration de votre identité, vous pouvez demander votre certificat lorsque les {total} leçons sont indiquées comme terminées.</p><h3>Réussite</h3><p>La mention Réussite demande les trois validations humaines du formateur et les essais réels attendus, dont deux assistants texte distincts pour le troisième travail. Aucun seuil de note ne la déclenche automatiquement.</p>
        <details className="iag-player-certificate-details"><summary>Consulter mon identité, mes demandes et mes certificats</summary><IagCertificatePanel userId={ownerId} supabase={supabase} onIssued={issuance => navigate(`/course/formation-ia-generative-elearning/certificats/${encodeURIComponent(issuance.id)}`)} /></details>
      </section>
      <section className="module-recap-card"><h2>Mes trois travaux</h2><p>Retrouvez les consignes, vos remises et les retours du formateur. Les validations des travaux sont distinctes de votre progression de lecture.</p><button type="button" className="btn btn-primary" onClick={showWorks}>Préparer mes travaux</button></section>
    </div>

    {view === 'lesson' && <section ref={reader} id="iag-reader" className="iag-player-reader" aria-label="Lecture de la leçon" aria-busy={busy}>
      <button type="button" className="btn module-resource-link" onClick={() => showHome('iag-outline')}>← Retour au plan du cours</button>
      <p className="course-eyebrow iag-player-current">Étape {selected?.stage} · Leçon {selectedIndex + 1} sur {total}</p>
      {!state.document ? <p role="status">Chargement du document privé.</p> : <IagStructuredLesson key={`${ownerId}:${state.lessonId}:${state.document.id}`} document={state.document} lessonId={state.lessonId} api={api} externalLinks={state.course.structuredContent.externalLinks} onDocument={openDocument} onAction={action} headingOffset={1} />}
      <section className="module-recap-card"><h2>Où en suis-je ?</h2><p>Après votre lecture et votre activité personnelle, indiquez que vous avez terminé cette leçon. La validation d’un travail par le formateur reste une étape distincte.</p><button className="btn btn-primary" type="button" disabled={busy || finished} onClick={() => void controller.complete()}>{state.phase === 'saving' ? 'Enregistrement…' : finished ? 'Leçon indiquée comme terminée' : 'J’ai terminé cette leçon'}</button></section>
      <div className="iag-player-neighbours">{selectedIndex > 0 && <button type="button" className="btn module-resource-link" disabled={busy} onClick={() => selectLesson(state.course.modules[selectedIndex - 1].id)}>← Leçon précédente</button>}{selectedIndex < total - 1 && <button type="button" className="btn module-resource-link" disabled={busy} onClick={() => selectLesson(state.course.modules[selectedIndex + 1].id)}>Leçon suivante →</button>}<button className="btn module-resource-link" type="button" onClick={showWorks}>Mes travaux à remettre</button></div>
    </section>}

    {worksOpened && <section hidden={view !== 'works'} className="iag-player-works" aria-label="Travaux et retours du formateur"><p className="course-eyebrow">Préparer, remettre et reprendre</p><p>Trois corrections écrites personnalisées sont comprises, sous deux jours calendaires après réception, week-ends et jours fériés compris. Une nouvelle remise du même travail est incluse pour chacun.</p><IagAssessmentPanel supabase={supabase} userId={ownerId} /></section>}
  </div>;
}

