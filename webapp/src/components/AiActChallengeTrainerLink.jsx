import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiActChallengeApi } from '../lib/aiActChallenge';

// La visibilité de ce lien ne donne aucun droit : chaque consultation du
// tableau formateur contrôle de nouveau l'habilitation côté serveur.
export default function AiActChallengeTrainerLink({ userId, api = aiActChallengeApi }) {
  const [permission, setPermission] = useState(null);
  useEffect(() => {
    let active = true;
    if (userId) {
      api('permissions', { course_id: 'formation-ia-act' })
        .then((permissions) => { if (active) setPermission({ userId, api, allowed:permissions?.can_train === true }); })
        .catch(() => { if (active) setPermission({ userId, api, allowed:false }); });
    }
    return () => { active = false; };
  }, [userId, api]);
  const allowed = userId && permission?.userId === userId && permission?.api === api && permission.allowed;
  return allowed ? <p><Link to="/formateur/ai-act-challenge">Suivi formateur AI ACT CHALLENGE</Link></p> : null;
}
