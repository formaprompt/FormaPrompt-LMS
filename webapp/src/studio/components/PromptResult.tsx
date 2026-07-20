import { Check, Copy, PencilLine, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StudioDiagnostic } from '../types';
import { ScoreBreakdown } from './ScoreBreakdown';

interface PromptResultProps {
  prompt: string;
  diagnostic: StudioDiagnostic;
  isStale: boolean;
  resultHelp: string;
  recommendations: string[];
  onEdit: () => void;
  onRestart: () => void;
  onClearDraft: () => void;
}

export function PromptResult({
  prompt,
  diagnostic,
  isStale,
  resultHelp,
  recommendations,
  onEdit,
  onRestart,
  onClearDraft,
}: PromptResultProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const promptPreviewRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    resultTitleRef.current?.focus();
  }, [diagnostic.total, prompt]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 4_000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  };

  const selectPrompt = () => {
    const selection = window.getSelection();
    if (!selection || !promptPreviewRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(promptPreviewRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
    promptPreviewRef.current.focus();
  };

  return (
    <section className="studio-result" aria-labelledby="studio-result-title">
      <div className="studio-result-heading">
        <div>
          <p className="studio-eyebrow">Résultat</p>
          <h2 id="studio-result-title" ref={resultTitleRef} tabIndex={-1}>Votre prompt structuré</h2>
          <p>{resultHelp}</p>
        </div>
        <button type="button" className="btn btn-primary studio-copy-button" onClick={copyPrompt}>
          {copyStatus === 'success' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copyStatus === 'success' ? 'Prompt copié' : 'Copier le prompt'}
        </button>
      </div>

      <p className="studio-copy-status" aria-live="polite">
        {copyStatus === 'success' && 'Prompt copié dans le presse-papiers.'}
        {copyStatus === 'error' && (
          <>
            La copie automatique a échoué.{' '}
            <button type="button" onClick={selectPrompt}>Sélectionner le prompt pour le copier manuellement</button>
          </>
        )}
      </p>

      {isStale && (
        <div className="studio-stale-notice" role="status">
          <PencilLine aria-hidden="true" />
          <p>Vous avez modifié un champ. Recalculez le score pour actualiser le diagnostic et le prompt.</p>
        </div>
      )}

      <pre ref={promptPreviewRef} className="studio-prompt-preview" tabIndex={0} aria-label="Prompt final à copier">
        <code>{prompt}</code>
      </pre>

      <ScoreBreakdown diagnostic={diagnostic} />

      <aside className="studio-category-recommendations" aria-labelledby="studio-category-recommendations-title">
        <h3 id="studio-category-recommendations-title">Conseils pour ce cas d’usage</h3>
        <ul>
          {recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
        </ul>
      </aside>

      <div className="studio-result-actions" aria-label="Actions sur le résultat">
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          <PencilLine aria-hidden="true" /> Modifier mes informations
        </button>
        <button type="button" className="btn btn-secondary" onClick={onRestart}>
          <RotateCcw aria-hidden="true" /> Recommencer
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClearDraft}>
          <Trash2 aria-hidden="true" /> Effacer le brouillon
        </button>
      </div>
    </section>
  );
}
