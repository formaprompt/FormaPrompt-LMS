import './CourseProgress.css';

function pluralizeExercise(count) {
  return count === 1 ? 'exercice' : 'exercices';
}

export default function CourseProgress({
  progress,
  compact = false,
  loading = false,
  headingLevel = 2,
}) {
  if (!progress?.total) return null;

  const Heading = `h${headingLevel}`;
  const completedLabel = `${progress.completed} ${pluralizeExercise(progress.completed)} terminé${progress.completed === 1 ? '' : 's'} sur ${progress.total}`;

  return (
    <section className={`course-progress${compact ? ' course-progress--compact' : ''}`} aria-label="Progression dans la formation">
      <div className="course-progress__heading">
        <Heading>Votre progression</Heading>
        {!loading && <strong>{progress.percentage} %</strong>}
      </div>

      {loading ? (
        <p className="course-progress__loading" role="status">Mise à jour de votre progression…</p>
      ) : (
        <>
          <progress
            className="course-progress__bar"
            value={progress.completed}
            max={progress.total}
            aria-label={completedLabel}
          >
            {progress.percentage} %
          </progress>
          <p className="course-progress__summary">{completedLabel}</p>
          <ul className="course-progress__details" aria-label="Détail de la progression">
            <li><strong>{progress.started}</strong> commencé{progress.started === 1 ? '' : 's'}</li>
            <li><strong>{progress.completed}</strong> terminé{progress.completed === 1 ? '' : 's'}</li>
            <li><strong>{progress.validated}</strong> validé{progress.validated === 1 ? '' : 's'} par le formateur</li>
          </ul>
          {!compact && (
            <p className="course-progress__help">
              Un exercice est compté comme terminé lorsque vous choisissez « Déclarer la réponse terminée ».
              La validation du formateur est indiquée séparément.
            </p>
          )}
        </>
      )}
    </section>
  );
}
