import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { StudioDiagnostic } from '../types';

interface ScoreBreakdownProps {
  diagnostic: StudioDiagnostic;
}

export function ScoreBreakdown({ diagnostic }: ScoreBreakdownProps) {
  return (
    <section className="studio-diagnostic" aria-labelledby="studio-diagnostic-title">
      <div className="studio-score-summary">
        <div className="studio-score-value" aria-label={`Score de qualité : ${diagnostic.total} sur 100`}>
          <strong>{diagnostic.total}</strong>
          <span>/100</span>
        </div>
        <div>
          <p className="studio-eyebrow">Diagnostic du prompt</p>
          <h3 id="studio-diagnostic-title">Score de qualité expliqué</h3>
          <p>{diagnostic.summary}</p>
        </div>
      </div>

      <progress value={diagnostic.total} max="100" aria-label={`Progression du score : ${diagnostic.total} sur 100`}>
        {diagnostic.total} %
      </progress>

      <div className="studio-score-grid">
        {diagnostic.criteria.map((criterion) => (
          <article key={criterion.id} className="studio-score-card">
            <div className="studio-score-card-heading">
              <h4>{criterion.label}</h4>
              <span>{`${criterion.earnedPoints}/${criterion.maxPoints} points`}</span>
            </div>
            <p>{criterion.description}</p>

            <details className="studio-score-calculation">
              <summary>Voir les repères de calcul</summary>
              <ul>{criterion.checkpoints.map((checkpoint) => <li key={checkpoint}>{checkpoint}</li>)}</ul>
            </details>

            <div className="studio-score-details is-present">
              <h5><CheckCircle2 aria-hidden="true" /> Éléments présents</h5>
              <ul>
                {criterion.present.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="studio-score-details is-missing">
              <h5><CircleAlert aria-hidden="true" /> Éléments manquants</h5>
              {criterion.missing.length > 0 ? (
                <ul>{criterion.missing.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : (
                <p>Aucun élément essentiel manquant pour ce critère.</p>
              )}
            </div>

            <p className="studio-score-recommendation">
              <strong>Recommandation :</strong> {criterion.recommendation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
