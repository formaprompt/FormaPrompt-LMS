import { Check, ChevronDown, Copy, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trackStudioEvent } from '../analytics';
import { copyPromptToClipboard } from '../externalAi';
import type { StudioPromptPreview } from '../engine/promptPreview';
import type { StudioDiagnostic, StudioImprovementSuggestion } from '../types';
import { ImprovementSuggestions } from './ImprovementSuggestions';
import { LiveCropScore } from './LiveCropScore';
import { LivePromptPreview } from './LivePromptPreview';

interface StudioLivePanelProps {
  preview: StudioPromptPreview;
  diagnostic: StudioDiagnostic;
  suggestions: StudioImprovementSuggestion[];
  copyablePrompt: string | null;
  onFocusField: (fieldName: string) => void;
}

export function StudioLivePanel({ preview, diagnostic, suggestions, copyablePrompt, onFocusField }: StudioLivePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 4_000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const copyPrompt = async () => {
    if (!copyablePrompt) return;
    try {
      await copyPromptToClipboard(copyablePrompt);
      setCopyStatus('success');
      trackStudioEvent('prompt_copied', { actionType: 'live-preview' });
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <div className="studio-live-panel-wrapper">
      <button
        type="button"
        className="studio-mobile-preview-toggle"
        aria-expanded={isOpen}
        aria-controls="studio-live-panel"
        onClick={() => {
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState) trackStudioEvent('preview_opened');
        }}
      >
        <span><Eye aria-hidden="true" /> Score actuel : {diagnostic.total}/100 — Voir mon prompt en cours</span>
        <ChevronDown aria-hidden="true" />
      </button>

      <aside id="studio-live-panel" className={`studio-live-panel${isOpen ? ' is-open' : ''}`} aria-label="Prévisualisation et score en direct">
        <LivePromptPreview preview={preview} />
        <LiveCropScore diagnostic={diagnostic} />
        <ImprovementSuggestions suggestions={suggestions} onFocusField={onFocusField} />

        {copyablePrompt && (
          <button type="button" className="btn btn-primary studio-live-copy" onClick={copyPrompt}>
            {copyStatus === 'success' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copyStatus === 'success' ? 'Prompt copié' : 'Copier le prompt'}
          </button>
        )}
        {!copyablePrompt && <p className="studio-live-copy-help">Complétez les champs obligatoires pour rendre le prompt copiable.</p>}
        <p className="studio-live-copy-status" aria-live="polite">
          {copyStatus === 'success' && 'Prompt copié dans le presse-papiers.'}
          {copyStatus === 'error' && 'La copie automatique a échoué. Utilisez le résultat final pour sélectionner le prompt manuellement.'}
        </p>
      </aside>
    </div>
  );
}
