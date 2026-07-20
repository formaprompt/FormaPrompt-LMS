import { Lightbulb, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { trackStudioEvent } from '../analytics';
import type { StudioPromptExample } from '../types';

interface PromptExamplesProps {
  examples: StudioPromptExample[];
  hasConflict: (example: StudioPromptExample) => boolean;
  onApply: (example: StudioPromptExample, mode: 'replace' | 'fill-empty') => void;
}

export function PromptExamples({ examples, hasConflict, onApply }: PromptExamplesProps) {
  const [pendingExample, setPendingExample] = useState<StudioPromptExample | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const applyExample = (example: StudioPromptExample, mode: 'replace' | 'fill-empty') => {
    onApply(example, mode);
    setAnnouncement(`${example.title} appliqué. Les champs restent modifiables et le prompt n’a pas été généré.`);
    trackStudioEvent('example_applied', { actionType: example.template ? 'template' : 'example' });
  };

  const chooseExample = (example: StudioPromptExample) => {
    if (hasConflict(example)) {
      setPendingExample(example);
      return;
    }
    applyExample(example, 'replace');
  };

  return (
    <section className="studio-prompt-examples" aria-labelledby="studio-prompt-examples-title">
      <div className="studio-prompt-examples-heading">
        <Lightbulb aria-hidden="true" />
        <div>
          <h3 id="studio-prompt-examples-title">Exemples de demandes</h3>
          <p>Choisissez un exemple pour préremplir votre demande, puis adaptez-le à votre situation.</p>
        </div>
      </div>
      <div className="studio-example-buttons">
        {examples.map((example) => (
          <div key={example.title} className={example.template ? 'studio-example-choice is-template' : 'studio-example-choice'}>
            <button type="button" aria-label={example.title} onClick={() => chooseExample(example)}>
              <WandSparkles aria-hidden="true" />
              {example.title}
              {example.template && <span className="studio-example-model-badge" aria-hidden="true">Modèle guidé</span>}
            </button>
            {example.template && (
              <details>
                <summary>Voir les variables à personnaliser</summary>
                <p>{example.template.text}</p>
                <ul>
                  {example.template.variables.map((variable) => (
                    <li key={variable.token}><code>{variable.token}</code> {variable.label}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {pendingExample && (
        <div className="studio-example-confirmation" role="alert">
          <p>Certains champs concernés contiennent déjà du texte. Comment souhaitez-vous appliquer ce point de départ ?</p>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                applyExample(pendingExample, 'replace');
                setPendingExample(null);
              }}
            >
              Remplacer avec ce modèle
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                applyExample(pendingExample, 'fill-empty');
                setPendingExample(null);
              }}
            >
              Conserver mes informations
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingExample(null)}>Annuler</button>
          </div>
        </div>
      )}
    </section>
  );
}
