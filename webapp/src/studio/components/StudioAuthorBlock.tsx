import { UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../../config/site';
import { STUDIO_LAST_UPDATED } from '../landingContent';

export function StudioAuthorBlock() {
  return (
    <aside className="studio-author-block" aria-labelledby="studio-author-title">
      <UserRoundCheck aria-hidden="true" />
      <div>
        <h2 id="studio-author-title">Une méthode conçue pour apprendre en pratiquant</h2>
        <p>
          FormaPrompt Studio a été conçu par {SITE_CONFIG.responsibleDisplayName}, formateur en bureautique, prompt engineering et intelligence artificielle.
          Son approche repose sur la méthode CROP afin de rendre la construction des prompts plus claire, progressive et pédagogique.
        </p>
        <p><Link to="/a-propos">Découvrir le parcours de {SITE_CONFIG.responsibleDisplayName}</Link> · Mise à jour du Studio : {STUDIO_LAST_UPDATED}</p>
      </div>
    </aside>
  );
}
