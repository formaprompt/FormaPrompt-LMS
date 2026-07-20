import type { StudioDiagnostic } from '../types';

function getCropScoreState(score: number) {
  if (score >= 85) return 'Prompt très détaillé';
  if (score >= 65) return 'Prompt bien structuré';
  if (score >= 40) return 'Base correcte';
  return 'À compléter';
}

export function LiveCropScore({ diagnostic }: { diagnostic: StudioDiagnostic }) {
  return (
    <section className="studio-live-score" aria-labelledby="studio-live-score-title">
      <div className="studio-live-score-heading">
        <div>
          <p className="studio-eyebrow">Score CROP actuel</p>
          <h3 id="studio-live-score-title">{getCropScoreState(diagnostic.total)}</h3>
        </div>
        <p className="studio-live-score-value" aria-label={`Score actuel : ${diagnostic.total} sur 100`}>
          <strong>{diagnostic.total}</strong><span>/100</span>
        </p>
      </div>
      <progress value={diagnostic.total} max="100">{diagnostic.total} %</progress>
      <ul className="studio-live-score-criteria">
        {diagnostic.criteria.map((criterion) => (
          <li key={criterion.id}>
            <span>{criterion.label}</span>
            <strong>{criterion.earnedPoints}/{criterion.maxPoints}</strong>
          </li>
        ))}
      </ul>
      <p className="studio-live-score-disclaimer">
        Ce score évalue la structure du prompt selon la méthode CROP. Il ne garantit pas l’exactitude de la réponse produite par une IA.
      </p>
    </section>
  );
}
