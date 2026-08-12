import { Link } from 'react-router-dom';
import { isCourseAccessOpen } from '../lib/courseAccessLifecycle';

export default function LearningPathAccessCard({ course, access, loading }) {
  if (loading || !isCourseAccessOpen(access)) return null;

  return (
    <section className="learner-demo-path" aria-labelledby="learner-demo-path-title">
      <div>
        <p className="learner-demo-path__eyebrow">Parcours de formation</p>
        <h3 id="learner-demo-path-title">{course.title}</h3>
        <p>Cinq modules courts pour progresser et reprendre automatiquement dans votre espace apprenant.</p>
      </div>
      <Link to={`/parcours/${course.id}`} className="btn btn-primary">
        Commencer ou reprendre
      </Link>
    </section>
  );
}
