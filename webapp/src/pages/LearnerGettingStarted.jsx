import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import useLearnerOnboarding from '../components/useLearnerOnboarding';
import { markOnboardingVideoSeen } from '../lib/learnerOnboarding';
import SEO from '../components/SEO';
import '../components/LearnerOnboarding.css';

export default function LearnerGettingStarted() {
  const { user } = useAuth();
  return <GettingStartedContent key={user?.id || 'guest'} userId={user?.id} />;
}

function GettingStartedContent({ userId }) {
  const { config, loading } = useLearnerOnboarding(userId);
  if (!userId) return null;
  return (
    <div className="container learner-getting-started">
      <SEO title="Bien démarrer — Espace apprenant FormaPrompt" description="Les étapes pour utiliser votre espace apprenant FormaPrompt." robots="noindex, nofollow" />
      <p><Link to="/dashboard">Retour à mon espace apprenant</Link></p>
      <h1>Aide — Bien démarrer</h1>
      <p>Quelques repères pour trouver votre formation, utiliser les ressources et poursuivre votre travail.</p>
      {!loading && config.enabled && config.videoUrl && (
        <OnboardingVideo key={`${config.version}:${config.videoUrl}`} config={config} userId={userId} />
      )}
      {!loading && (!config.enabled || !config.videoUrl) && <p>Retrouvez les étapes dans le guide écrit ci-dessous.</p>}
      <section aria-labelledby="learner-written-guide-title">
        <h2 id="learner-written-guide-title">Les étapes pour bien démarrer</h2>
        <ol className="learner-guide-steps">
          <li><h3>Repérer votre compte et vos formations</h3><p>Votre adresse de connexion apparaît dans votre espace apprenant. Les formations achetées ou attribuées y sont affichées. Si un accès est indisponible, utilisez le lien de contact proposé.</p></li>
          <li><h3>Ouvrir votre formation</h3><p>Choisissez « Voir la formation », « Commencer ou reprendre » ou l’accès aux supports selon votre formation. Un questionnaire de positionnement peut être demandé avant le contenu. Si une étape de réservation apparaît, elle vous permet de consulter ou choisir vos séances.</p></li>
          <li><h3>Consulter les contenus et ressources</h3><p>Suivez les modules dans l’ordre proposé. Lancez vous-même les vidéos lorsqu’elles sont disponibles. Retrouvez les ressources et fichiers de travail dans les rubriques de votre formation. Votre position dans une vidéo n’est pas enregistrée automatiquement.</p></li>
          <li><h3>Enregistrer votre travail</h3><p>Pour les exercices disposant d’un champ de réponse, « Enregistrer le brouillon » permet de conserver votre travail. Choisissez « Déclarer la réponse terminée » après vérification. La validation du formateur est indiquée séparément. Dans les formations disposant d’exercices, la carte de votre formation dans l’espace apprenant affiche votre progression. Dans un parcours par modules, utilisez « Marquer comme terminé » lorsque vous avez fini le module.</p></li>
          <li><h3>Revenir et poursuivre</h3><p>Retournez à votre espace depuis le menu « Espace apprenant ». Dans les parcours proposant « Commencer ou reprendre », ce lien rouvre la dernière leçon consultée. Pour les autres formations, ouvrez à nouveau la formation et retrouvez vos réponses enregistrées.</p></li>
          <li><h3>Retrouver vos documents et demander de l’aide</h3><p>Les documents administratifs et attestations apparaissent dans votre espace lorsqu’ils sont mis à disposition. Ce guide reste accessible depuis « Aide ». Consultez aussi la <Link to="/faq">FAQ</Link> ou <Link to="/contact">contactez FormaPrompt</Link>.</p><p>Si vous avez oublié votre mot de passe, utilisez la procédure <Link to="/forgot-password">Mot de passe oublié</Link>. Ne transmettez jamais votre mot de passe par message.</p></li>
        </ol>
      </section>
    </div>
  );
}

function OnboardingVideo({ config, userId }) {
  const [videoError, setVideoError] = useState(false);
  const titleRef = useRef(null);
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#learner-intro-video') {
      titleRef.current?.focus();
    }
  }, [location.key, location.hash]);
  return (
    <section id="learner-intro-video" aria-labelledby="learner-intro-video-title">
      <h2 id="learner-intro-video-title" ref={titleRef} tabIndex={-1}>{config.title}</h2>
      <p>{config.description}</p>
      {config.durationLabel && <p>Durée : {config.durationLabel}</p>}
      {config.captionsEmbedded && <p className="learner-onboarding-note">Les sous-titres français sont intégrés à l’image de la vidéo.</p>}
      {config.captionsEmbedded && <p className="learner-onboarding-note">Sur téléphone, le plein écran en mode paysage facilite la lecture des sous-titres. Le guide écrit reste disponible ci-dessous.</p>}
      {videoError ? (
        <p role="status">La vidéo ne peut pas être chargée. Vous pouvez suivre le guide écrit ci-dessous.</p>
      ) : (
        <video controls preload="none" playsInline poster={config.thumbnailUrl || undefined}
          aria-label="Présentation de l’espace apprenant FormaPrompt"
          onPlaying={() => { markOnboardingVideoSeen(userId, config.version); }}
          onError={() => setVideoError(true)}>
          <source src={config.videoUrl} onError={() => setVideoError(true)} />
          {config.captionsUrl && <track kind="captions" src={config.captionsUrl} srcLang="fr" label="Français" default />}
          Votre navigateur ne peut pas lire cette vidéo. Le guide écrit ci-dessous reste disponible.
        </video>
      )}
    </section>
  );
}
