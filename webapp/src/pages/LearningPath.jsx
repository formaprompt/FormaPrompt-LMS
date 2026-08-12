import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CourseProgress from '../components/CourseProgress';
import { useAuth } from '../contexts/useAuth';
import { learningPathCatalog } from '../data/learningPathCatalog';
import { fetchCourseAccessEntitlement } from '../lib/courseAccess';
import { isCourseAccessOpen, learnerAccessMessage } from '../lib/courseAccessLifecycle';
import { getLearningPathProgress, getResumeLessonId } from '../lib/learningProgress';
import { supabase } from '../lib/supabaseClient';
import './LearningPath.css';

export default function LearningPath() {
  const { slug, lessonId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const course = learningPathCatalog[slug];
  const [progressRows, setProgressRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [courseAccess, setCourseAccess] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);

  const currentLessonIndex = course?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1;
  const currentLesson = currentLessonIndex >= 0 ? course.lessons[currentLessonIndex] : null;
  const progress = useMemo(
    () => getLearningPathProgress(course?.lessons, progressRows),
    [course, progressRows],
  );
  const currentProgress = progressRows.find((row) => row.lesson_id === currentLesson?.id);

  useEffect(() => {
    if (!course) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let active = true;

    async function loadProgress() {
      setLoading(true);
      setError('');
      setAccessChecked(false);

      const { data: entitlement, error: accessError } = await fetchCourseAccessEntitlement({
        userId: user.id,
        courseId: course.requiredCourseAccessId,
      });

      if (!active) return;
      setCourseAccess(entitlement);
      setAccessChecked(true);

      if (accessError) {
        console.error("Vérification du droit d'accès impossible :", accessError);
        setError("Votre droit d'accès n'a pas pu être vérifié. Réessayez dans quelques instants.");
        setLoading(false);
        return;
      }

      if (!isCourseAccessOpen(entitlement)) {
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('course_lesson_progress')
        .select('course_id, lesson_id, status, progress_percent, last_viewed_at, completed_at')
        .eq('user_id', user.id)
        .eq('course_id', course.id)
        .order('last_viewed_at', { ascending: false });

      if (!active) return;
      if (loadError) {
        console.error('Chargement de la progression impossible :', loadError);
        setError("Votre progression n'a pas pu être chargée. Réessayez dans quelques instants.");
        setLoading(false);
        return;
      }

      const rows = data || [];
      setProgressRows(rows);
      const requestedLessonExists = course.lessons.some((lesson) => lesson.id === lessonId);
      const destination = requestedLessonExists ? lessonId : getResumeLessonId(course.lessons, rows);
      if (destination !== lessonId) {
        navigate(`/parcours/${course.id}/${destination}`, { replace: true });
      }
      setLoading(false);
    }

    loadProgress();
    return () => { active = false; };
  }, [course, lessonId, navigate, user.id]);

  useEffect(() => {
    if (loading || !currentLesson || error || !isCourseAccessOpen(courseAccess)) return;

    const existing = progressRows.find((row) => row.lesson_id === currentLesson.id);
    const viewedAt = new Date().toISOString();
    const nextRow = {
      user_id: user.id,
      course_id: course.id,
      lesson_id: currentLesson.id,
      status: existing?.status || 'in_progress',
      progress_percent: existing?.progress_percent || 0,
      last_viewed_at: viewedAt,
      completed_at: existing?.completed_at || null,
    };

    supabase
      .from('course_lesson_progress')
      .upsert(nextRow, { onConflict: 'user_id,course_id,lesson_id' })
      .then(({ error: saveError }) => {
        if (saveError) {
          console.error('Enregistrement de la consultation impossible :', saveError);
          setError("La reprise automatique n'a pas pu être enregistrée.");
          return;
        }
        setProgressRows((current) => [
          ...current.filter((row) => row.lesson_id !== currentLesson.id),
          nextRow,
        ]);
      });
  // La consultation est enregistrée uniquement lors du changement de leçon.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, courseAccess, currentLesson?.id, error, loading, user.id]);

  async function markCompleted() {
    if (!currentLesson || saving || !isCourseAccessOpen(courseAccess)) return;
    setSaving(true);
    setError('');
    const completedAt = new Date().toISOString();
    const completedRow = {
      user_id: user.id,
      course_id: course.id,
      lesson_id: currentLesson.id,
      status: 'completed',
      progress_percent: 100,
      last_viewed_at: completedAt,
      completed_at: completedAt,
    };
    const { error: saveError } = await supabase
      .from('course_lesson_progress')
      .upsert(completedRow, { onConflict: 'user_id,course_id,lesson_id' });

    if (saveError) {
      console.error('Validation de la leçon impossible :', saveError);
      setError("La leçon n'a pas été marquée comme terminée.");
    } else {
      setProgressRows((current) => [
        ...current.filter((row) => row.lesson_id !== currentLesson.id),
        completedRow,
      ]);
    }
    setSaving(false);
  }

  if (!course || loading) {
    return <div className="container section" role="status">Chargement de votre parcours…</div>;
  }

  if (error) {
    return <div className="container section" role="alert">{error}</div>;
  }

  if (accessChecked && !isCourseAccessOpen(courseAccess)) {
    const deniedStatus = courseAccess?.status === 'active' ? 'expired' : courseAccess?.status;
    return (
      <div className="container learning-path">
        <section className="learning-path__access-denied" role="alert">
          <p className="learning-path__eyebrow">Accès indisponible</p>
          <h1>{course.title}</h1>
          <p>{learnerAccessMessage(deniedStatus) || "Vous ne disposez pas d’un droit d’accès actif à cette formation."}</p>
          <div className="learning-path__access-actions">
            <Link className="btn btn-primary" to="/dashboard">Retour à mon espace apprenant</Link>
            <Link className="btn btn-outline" to="/contact">Contacter FormaPrompt</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!currentLesson) {
    return <div className="container section" role="alert">Ce module est indisponible.</div>;
  }

  const previousLesson = course.lessons[currentLessonIndex - 1];
  const nextLesson = course.lessons[currentLessonIndex + 1];

  return (
    <div className="container learning-path">
      <nav className="learning-path__breadcrumb" aria-label="Fil d’Ariane">
        <Link to="/dashboard">Espace apprenant</Link><span aria-hidden="true">/</span><span>{course.title}</span>
      </nav>

      <header className="learning-path__header">
        <div>
          <p className="learning-path__eyebrow">Parcours de formation</p>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
        </div>
        <CourseProgress progress={progress} compact />
      </header>

      {error && <p className="learning-path__error" role="alert">{error}</p>}

      <div className="learning-path__layout">
        <aside className="learning-path__sidebar" aria-label="Modules de la formation">
          <h2>Modules</h2>
          <ol>
            {course.lessons.map((lesson, index) => {
              const lessonProgress = progressRows.find((row) => row.lesson_id === lesson.id);
              return (
                <li key={lesson.id}>
                  <Link
                    to={`/parcours/${course.id}/${lesson.id}`}
                    aria-current={lesson.id === currentLesson.id ? 'step' : undefined}
                  >
                    <span className="learning-path__module-number" aria-hidden="true">
                      {lessonProgress?.status === 'completed' ? <Check size={16} /> : index + 1}
                    </span>
                    <span>{lesson.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>

        <article className="learning-path__lesson">
          <p className="learning-path__lesson-position">Module {currentLessonIndex + 1} sur {course.lessons.length}</p>
          <h2>{currentLesson.title}</h2>
          <p className="learning-path__duration"><Clock3 size={17} aria-hidden="true" /> {currentLesson.duration}</p>
          <p className="learning-path__introduction">{currentLesson.introduction}</p>

          <section>
            <h3>Exemple</h3>
            <p>{currentLesson.example}</p>
          </section>
          <section className="learning-path__activity">
            <h3>À vous de jouer</h3>
            <p>{currentLesson.activity}</p>
          </section>

          <div className="learning-path__completion">
            {currentProgress?.status === 'completed' ? (
              <p><Check size={18} aria-hidden="true" /> Module terminé et enregistré dans votre progression.</p>
            ) : (
              <button type="button" className="btn btn-primary" onClick={markCompleted} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Marquer comme terminé'}
              </button>
            )}
          </div>

          <nav className="learning-path__lesson-navigation" aria-label="Navigation entre les modules">
            {previousLesson ? (
              <Link className="btn btn-outline" to={`/parcours/${course.id}/${previousLesson.id}`}>
                <ChevronLeft size={18} aria-hidden="true" /> Module précédent
              </Link>
            ) : <span />}
            {nextLesson ? (
              <Link className="btn btn-primary" to={`/parcours/${course.id}/${nextLesson.id}`}>
                Module suivant <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <Link className="btn btn-primary" to="/dashboard">Retour à mon espace</Link>
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}
