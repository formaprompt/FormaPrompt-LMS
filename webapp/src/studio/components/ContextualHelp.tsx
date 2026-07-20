import { CircleHelp } from 'lucide-react';
import { trackStudioEvent } from '../analytics';
import { CROP_CONTEXTUAL_HELP } from '../contextualHelp';
import type { CropSection } from '../types';

export function ContextualHelp({ section }: { section: CropSection }) {
  const content = CROP_CONTEXTUAL_HELP[section];

  return (
    <details
      className="studio-contextual-help"
      onToggle={(event) => {
        if (event.currentTarget.open) trackStudioEvent('crop_help_opened', { actionType: section });
      }}
    >
      <summary><CircleHelp aria-hidden="true" /> {content.question}</summary>
      <div>
        <p><strong>Définition :</strong> {content.definition}</p>
        <p><strong>Erreur fréquente :</strong> {content.frequentError}</p>
        <p><strong>Exemple insuffisant :</strong> « {content.insufficientExample} »</p>
        <p><strong>Exemple amélioré :</strong> « {content.improvedExample} »</p>
      </div>
    </details>
  );
}
