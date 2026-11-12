import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const progressColumns = 'course_id, lesson_id, status, progress_percent, last_viewed_at, completed_at';

function mergeProgressRow(rows, incoming) {
  const previous = rows.find((row) => row.lesson_id === incoming.lesson_id);
  if (!previous) return [...rows, incoming];

  // Une réponse de consultation peut arriver après une validation plus récente.
  const incomingIsNewer = Date.parse(incoming.last_viewed_at) >= Date.parse(previous.last_viewed_at);
  const latest = incomingIsNewer ? incoming : previous;
  const completed = [previous, incoming].find((row) => row.status === 'completed');
  const merged = completed ? { ...completed, last_viewed_at: latest.last_viewed_at } : latest;
  return rows.map((row) => row.lesson_id === incoming.lesson_id ? merged : row);
}

async function saveLessonProgress({ userId, courseId, lessonId, complete = false }) {
  const viewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('course_lesson_progress')
    .upsert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      status: complete ? 'completed' : 'in_progress',
      progress_percent: complete ? 100 : 0,
      last_viewed_at: viewedAt,
      completed_at: complete ? viewedAt : null,
    }, { onConflict: 'user_id,course_id,lesson_id' })
    .select(progressColumns)
    .single();

  if (error) throw error;
  return data;
}

export default function LearningPath() {
  const { slug, lessonId } = useParams();
  const { user } = useAuth();
  return <LearningPathContent key={`${user.id}:${slug}`} slug={slug} lessonId={lessonId} userId={user.id} />;
}

function LearningPathContent({ slug, lessonId, userId }) {
  const navigate = useNavigate();
  const course = learningPathCatalog[slug];
  const [progressRows, setProgressRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedLessonId, setLoadedLessonId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [viewErrorLessonId, setViewErrorLessonId] = useState(null);
  const [viewRetry, setViewRetry] = useState(0);
  const [completionStates, setCompletionStates] = useState({});
  const completionsInFlight = useRef(new Set());
  const savedProgressRevision = useRef(0);
  const [courseAccess, setCourseAccess] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);

  const currentLessonIndex = course?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1;
  const currentLesson = currentLessonIndex >= 0 ? course.lessons[currentLessonIndex] : null;
  const progress = useMemo(
    () => getLearningPathProgress(course?.lessons, progressRows),
    [course, progressRows],
  );
  const currentProgress = progressRows.find((row) => row.lesson_id === currentLesson?.id);
  const applySavedProgress = useCallback((row) => {
    savedProgressRevision.current += 1;
    setProgressRows((current) => mergeProgressRow(current, row));
  }, []);

  useEffect(() => {
    if (!course) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let active = true;

    async function loadProgress() {
      setLoading(true);
      setLoadError('');
      setAccessChecked(false);

      const { data: entitlement, error: accessError } = await fetchCourseAccessEntitlement({
        userId,
        courseId: course.requiredCourseAccessId,
      });

      if (!active) return;
      setCourseAccess(entitlement);
      setAccessChecked(true);

      if (accessError) {
        console.error("Vérification du droit d'accès impossible :", accessError);
        setLoadError("Votre droit d'accès n'a pas pu être vérifié. Réessayez dans quelques instants.");
        setLoading(false);
        return;
      }

      if (!isCourseAccessOpen(entitlement)) {
        setLoading(false);
        return;
      }

      const revisionBeforeRead = savedProgressRevision.current;
      const { data, error: loadError } = await supabase
        .from('course_lesson_progress')
        .select(progressColumns)
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .order('last_viewed_at', { ascending: false });

      if (!active) return;
      if (loadError) {
        console.error('Chargement de la progression impossible :', loadError);
        setLoadError("Votre progression n'a pas pu être chargée. Réessayez dans quelques instants.");
        setLoading(false);
        return;
      }

      const rows = data || [];
      const saveArrivedDuringRead = revisionBeforeRead !== savedProgressRevision.current;
      setProgressRows((previous) => saveArrivedDuringRead ? rows.reduce(mergeProgressRow, previous) : rows);
      const requestedLessonExists = course.lessons.some((lesson) => lesson.id === lessonId);
      const destination = requestedLessonExists ? lessonId : getResumeLessonId(course.lessons, rows);
      if (destination !== lessonId) {
        navigate(`/parcours/${course.id}/${destination}`, { replace: true });
      }
      setLoadedLessonId(lessonId);
      setLoading(false);
    }

    loadProgress();
    return () => { active = false; };
  }, [course, lessonId, navigate, userId]);

  useEffect(() => {
    if (loading || loadedLessonId !== lessonId || !currentLesson || loadError
      || !isCourseAccessOpen(courseAccess)) return;

    let active = true;
    async function recordView() {
      setViewErrorLessonId(null);
      try {
        const row = await saveLessonProgress({ userId, courseId: course.id, lessonId });
        if (active) applySavedProgress(row);
      } catch (error) {
        if (!active) return;
        console.error('Enregistrement de la consultation impossible :', error);
        setViewErrorLessonId(lessonId);
      }
    }

    recordView();
    return () => { active = false; };
  }, [applySavedProgress, course, courseAccess, currentLesson, lessonId, loadedLessonId, loadError, loading, userId, viewRetry]);

  async function markCompleted() {
    if (!currentLesson || !isCourseAccessOpen(courseAccess) || completionsInFlight.current.has(lessonId)) return;
    completionsInFlight.current.add(lessonId);
    setCompletionStates((current) => ({ ...current, [lessonId]: 'saving' }));
    try {
      const row = await saveLessonProgress({ userId, courseId: course.id, lessonId, complete: true });
      applySavedProgress(row);
      setCompletionStates((current) => ({ ...current, [lessonId]: null }));
    } catch (error) {
      console.error('Validation de la leçon impossible :', error);
      setCompletionStates((current) => ({ ...current, [lessonId]: 'error' }));
    } finally {
      completionsInFlight.current.delete(lessonId);
    }
  }

  if (!course || loading) {
    return <div className="container section" role="status">Chargement de votre parcours…</div>;
  }

  if (loadError) {
    return <div className="container section" role="alert">{loadError}</div>;
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
  const completionState = completionStates[lessonId];

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
        <CourseProgress progress={progress} compact unit="module" />
      </header>

      {viewErrorLessonId === lessonId && (
        <div className="learning-path__error">
          <p role="alert">La reprise automatique n’a pas pu être enregistrée.</p>
          <button type="button" className="btn btn-outline" onClick={() => setViewRetry((retry) => retry + 1)}>
            Réessayer d’enregistrer la reprise
          </button>
        </div>
      )}

      <div className="learning-path__layout">
        <aside className="learning-path__sidebar" aria-label="Modules de la formation">
          <h2>Modules</h2>
          <ol>
            {course.lessons.map((lesson, index) => {
              const lessonProgress = progressRows.find((row) => row.lesson_id === lesson.id);
              const statusLabel = lessonProgress?.status === 'completed' ? 'terminé' : lessonProgress ? 'en cours' : 'à commencer';
              return (
                <li key={lesson.id}>
                  <Link
                    to={`/parcours/${course.id}/${lesson.id}`}
                    aria-current={lesson.id === currentLesson.id ? 'step' : undefined}
                    aria-label={`${lesson.title}, ${statusLabel}`}
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
            {completionState === 'error' && currentProgress?.status !== 'completed' && (
              <p className="learning-path__error" role="alert">Le module n’a pas pu être marqué comme terminé.</p>
            )}
            {currentProgress?.status === 'completed' ? (
              <p><Check size={18} aria-hidden="true" /> Module terminé et enregistré dans votre progression.</p>
            ) : (
              <button type="button" className="btn btn-primary" onClick={markCompleted} disabled={completionState === 'saving'}>
                {completionState === 'saving' ? 'Enregistrement…' : 'Marquer comme terminé'}
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
