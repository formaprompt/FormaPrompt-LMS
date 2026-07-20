import { Lightbulb, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import type { StudioPromptExample } from '../types';

interface PromptExamplesProps {
  examples: StudioPromptExample[];
  hasConflict: (example: StudioPromptExample) => boolean;
  onApply: (example: StudioPromptExample) => void;
}

export function PromptExamples({ examples, hasConflict, onApply }: PromptExamplesProps) {
  const [pendingExample, setPendingExample] = useState<StudioPromptExample | null>(null);

  const chooseExample = (example: StudioPromptExample) => {
    if (hasConflict(example)) {
      setPendingExample(example);
      return;
    }
    onApply(example);
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
          <button key={example.title} type="button" onClick={() => chooseExample(example)}>
            <WandSparkles aria-hidden="true" />
            {example.title}
          </button>
        ))}
      </div>

      {pendingExample && (
        <div className="studio-example-confirmation" role="alert">
          <p>Certains champs concernés contiennent déjà du texte. Souhaitez-vous les remplacer par cet exemple ?</p>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onApply(pendingExample);
                setPendingExample(null);
              }}
            >
              Remplacer les champs concernés
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingExample(null)}>
              Conserver ma saisie
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
