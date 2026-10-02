import { Link } from 'react-router-dom';
import useLearnerOnboarding from './useLearnerOnboarding';
import './LearnerOnboarding.css';

export default function LearnerWelcome({ userId, progressState }) {
  const { config, loading, seen } = useLearnerOnboarding(userId);
  if (!config.enabled) return null;
  const compact = loading || progressState !== 'new' || seen;
  return (
    <section className={`learner-welcome${compact ? ' learner-welcome--compact' : ''}`} aria-labelledby="learner-welcome-title">
      <div>
        <h2 id="learner-welcome-title">{compact ? 'Besoin de repères dans votre espace ?' : 'Bienvenue dans votre espace FormaPrompt'}</h2>
        <p>{compact ? 'Le guide Bien démarrer reste disponible à tout moment dans Aide.' : 'Découvrez en quelques minutes comment retrouver vos formations, reprendre votre parcours et utiliser votre espace apprenant.'}</p>
        {!compact && <p className="learner-onboarding-note">{config.videoUrl ? `Une courte vidéo vous accompagne${config.durationLabel ? ` (${config.durationLabel})` : ''}.` : 'Le guide écrit est disponible dès maintenant.'}</p>}
      </div>
      <Link className="btn btn-primary" to={config.videoUrl ? '/aide/bien-demarrer#learner-intro-video' : '/aide/bien-demarrer'}>{!compact && <span aria-hidden="true">▶ </span>}{compact ? 'Bien démarrer' : 'Découvrir mon espace'}</Link>
    </section>
  );
}
