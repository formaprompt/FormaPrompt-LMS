import { Check } from 'lucide-react';
import type { StudioProgressState } from '../progress';

const steps = ['Cas d’usage', 'Contexte', 'Rôle', 'Objectif', 'Précisions', 'Résultat'];

export function StudioProgress({ progress }: { progress: StudioProgressState }) {
  return (
    <nav className="studio-progress" aria-label="Progression dans le Studio">
      <p className="studio-progress-mobile" aria-live="polite">
        {`Étape ${progress.activeStep} sur 6 — ${steps[progress.activeStep - 1]}`}
      </p>
      <ol className="studio-progress-list">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < progress.activeStep;
          const isActive = stepNumber === progress.activeStep;
          return (
            <li key={step} className={`${isComplete ? 'is-complete' : ''}${isActive ? ' is-active' : ''}`}>
              <span aria-hidden="true">{isComplete ? <Check /> : stepNumber}</span>
              <span>{step}</span>
              {isActive && <span className="sr-only">Étape active</span>}
              {isComplete && <span className="sr-only">Étape terminée</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
