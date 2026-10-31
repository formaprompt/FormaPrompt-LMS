import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { loadIagPositioning } from '../lib/iagPositioningApi.js';
import IagInitialQuestionnaire from './IagInitialQuestionnaire.jsx';

export default function IagCourseGate({ children }) {
  const { user } = useAuth();
  if (!user?.id) return <section className="container section"><p role="alert">Connectez-vous pour retrouver ce cours.</p><a href="/login">Se connecter</a></section>;
  return <CourseGateSession key={user.id} ownerId={user.id}>{children}</CourseGateSession>;
}

function CourseGateSession({ children, ownerId }) {
  const [state, setState] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(value => value + 1);
  useEffect(() => {
    let current = true;
    loadIagPositioning(supabase).then(positioning => {
      if (current) setState({ revision, error: '', positioning });
    }).catch(error => {
      if (current) setState({ revision, error: error.message || 'Lecture du questionnaire indisponible.', positioning: null });
    });
    return () => { current = false; };
  }, [revision]);
  if (state?.revision !== revision) return <div className="container section" role="status">Chargement de votre point de départ…</div>;
  if (state.error) return <section className="container section"><p role="alert">{state.error}</p><button type="button" onClick={reload}>Réessayer</button><p><a href="/dashboard">Mon espace apprenant</a></p></section>;
  if (!state.positioning?.completed) return <IagInitialQuestionnaire key={`${ownerId}-${revision}`} supabase={supabase} initial={state.positioning} onComplete={reload} onReload={reload} />;
  return children;
}
