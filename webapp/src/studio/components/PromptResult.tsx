import { Check, Copy, PencilLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StudioDiagnostic } from '../types';
import { ScoreBreakdown } from './ScoreBreakdown';

interface PromptResultProps {
  prompt: string;
  diagnostic: StudioDiagnostic;
  isStale: boolean;
  resultHelp: string;
  recommendations: string[];
}

export function PromptResult({ prompt, diagnostic, isStale, resultHelp, recommendations }: PromptResultProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const resultTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    resultTitleRef.current?.focus();
  }, [diagnostic.total, prompt]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
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
        {copyStatus === 'success' && 'Le prompt a été copié dans le presse-papiers.'}
        {copyStatus === 'error' && 'La copie automatique a échoué. Sélectionnez le texte pour le copier manuellement.'}
      </p>

      {isStale && (
        <div className="studio-stale-notice" role="status">
          <PencilLine aria-hidden="true" />
          <p>Vous avez modifié un champ. Recalculez le score pour actualiser le diagnostic et le prompt.</p>
        </div>
      )}

      <pre className="studio-prompt-preview" tabIndex={0} aria-label="Prompt final à copier">
        <code>{prompt}</code>
      </pre>

      <ScoreBreakdown diagnostic={diagnostic} />

      <aside className="studio-category-recommendations" aria-labelledby="studio-category-recommendations-title">
        <h3 id="studio-category-recommendations-title">Conseils pour ce cas d’usage</h3>
        <ul>
          {recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
        </ul>
      </aside>

      <a className="studio-back-to-form" href="#studio-form">Revenir aux champs à améliorer</a>
    </section>
  );
}
