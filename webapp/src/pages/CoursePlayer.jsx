import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Check, Clock3, Code, Copy, Download, ExternalLink, FileText, Play, Save, Search, Send, Sparkles } from 'lucide-react';
import CourseProgress from '../components/CourseProgress';
import PrerequisiteQuiz from '../components/PrerequisiteQuiz';
import { useAuth } from '../contexts/useAuth';
import { courseCatalog } from '../data/courseCatalog';
import { calculateCourseProgress } from '../lib/courseProgress';
import { FINAL_PROJECT_REVIEW_FIELDS } from '../lib/finalProjectEvaluation';
import { supabase } from '../lib/supabaseClient';
import './CoursePlayer.css';

const exerciseSaveDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const emptyFinalProjectWork = {
  prompt_and_iterations: '',
  final_output: '',
  verification_grid_reference: '',
  action_plan: '',
  learner_note: '',
};

export default function CoursePlayer() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const course = courseCatalog[id];
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState('resources');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [exerciseAnswers, setExerciseAnswers] = useState({});
  const [savedExerciseAnswers, setSavedExerciseAnswers] = useState({});
  const [exerciseReviews, setExerciseReviews] = useState({});
  const [exerciseSaveStates, setExerciseSaveStates] = useState({});
  const [exerciseResponsesLoading, setExerciseResponsesLoading] = useState(false);
  const [exerciseResponsesAvailable, setExerciseResponsesAvailable] = useState(true);
  const [exerciseReviewsLoading, setExerciseReviewsLoading] = useState(false);
  const [finalProjectWork, setFinalProjectWork] = useState(emptyFinalProjectWork);
  const [savedFinalProjectWork, setSavedFinalProjectWork] = useState(null);
  const [finalProjectLoading, setFinalProjectLoading] = useState(false);
  const [finalProjectAvailable, setFinalProjectAvailable] = useState(true);
  const [finalProjectFeedback, setFinalProjectFeedback] = useState(null);
  const [finalProjectReview, setFinalProjectReview] = useState(null);
  const [finalProjectReviewLoading, setFinalProjectReviewLoading] = useState(false);
  const [finalProjectReviewsAvailable, setFinalProjectReviewsAvailable] = useState(true);

  useEffect(() => {
    async function verifyAccess() {
      if (!course) {
        navigate('/dashboard', { replace: true }); // Conserve l'apprenant dans son espace.
        return;
      }

      if (!user) {
        navigate('/login');
        return;
      }

      setAccessError('');
      const [purchaseResult, positioningResult] = await Promise.all([
        supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', id)
          .limit(1),
        supabase
          .from('course_positioning_assessments')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', id)
          .eq('is_initial', true)
          .order('submitted_at', { ascending: true })
          .limit(1),
      ]);

      if (purchaseResult.error) {
        console.error("Erreur lors de la vérification de l'accès :", purchaseResult.error);
        setAccessError("Impossible de vérifier votre accès pour le moment. Réessayez dans quelques instants.");
      } else if (!purchaseResult.data?.length) {
        navigate(course.landingPath);
      } else if (positioningResult.error) {
        console.error('Erreur lors de la vérification du positionnement :', positioningResult.error);
        setAccessError(
          "Le suivi des positionnements n'est pas encore disponible. Contactez FormaPrompt si le problème persiste.",
        );
      } else {
        setQuizCompleted(Boolean(positioningResult.data?.length));
        setAccessGranted(true);
      }

      setLoading(false);
    }

    verifyAccess();
  }, [course, id, navigate, user]);

  useEffect(() => {
    async function loadLatestExerciseAnswers() {
      if (!accessGranted || !quizCompleted || !course?.exercises?.length || !user) return;

      setExerciseResponsesLoading(true);
      setExerciseResponsesAvailable(true);

      const { data, error } = await supabase
        .from('course_exercise_latest_responses')
        .select('id, exercise_id, response_text, status, saved_at')
        .eq('user_id', user.id)
        .eq('course_id', id);

      if (error) {
        const tableIsNotReady = ['42P01', 'PGRST205'].includes(error.code);
        if (tableIsNotReady) {
          setExerciseResponsesAvailable(false);
        } else {
          console.error('Erreur lors du chargement des réponses aux exercices :', error);
          setExerciseSaveStates({
            global: {
              state: 'error',
              message: "Vos réponses enregistrées n'ont pas pu être chargées. Réessayez dans quelques instants.",
            },
          });
        }
        setExerciseResponsesLoading(false);
        return;
      }

      const latestAnswers = {};
      const latestSavedAnswers = {};
      (data || []).forEach((response) => {
        const exerciseId = String(response.exercise_id);
        latestAnswers[exerciseId] = response.response_text;
        latestSavedAnswers[exerciseId] = {
          id: response.id,
          text: response.response_text,
          status: response.status,
          savedAt: response.saved_at,
        };
      });

      setExerciseAnswers(latestAnswers);
      setSavedExerciseAnswers(latestSavedAnswers);
      setExerciseResponsesLoading(false);
    }

    loadLatestExerciseAnswers();
  }, [accessGranted, course, id, quizCompleted, user]);

  useEffect(() => {
    async function loadLatestExerciseReviews() {
      if (!accessGranted || !quizCompleted || !course?.exercises?.length || !user) return;

      setExerciseReviewsLoading(true);
      const { data, error } = await supabase
        .from('course_exercise_latest_reviews')
        .select('id, response_id, exercise_id, response_saved_at, feedback_text, review_status, created_at')
        .eq('user_id', user.id)
        .eq('course_id', id);

      if (error) {
        if (!['42P01', 'PGRST205'].includes(error.code)) {
          console.error('Chargement des retours du formateur impossible :', error);
        }
        setExerciseReviewsLoading(false);
        return;
      }

      const latestReviews = {};
      (data || []).forEach((review) => {
        latestReviews[String(review.exercise_id)] = review;
      });
      setExerciseReviews(latestReviews);
      setExerciseReviewsLoading(false);
    }

    loadLatestExerciseReviews();
  }, [accessGranted, course, id, quizCompleted, user]);

  useEffect(() => {
    async function loadLatestFinalProjectWork() {
      if (!accessGranted || !quizCompleted || !course?.finalProject || !user) return;

      setFinalProjectLoading(true);
      setFinalProjectAvailable(true);
      setFinalProjectFeedback(null);

      const { data, error } = await supabase
        .from('course_final_project_latest_versions')
        .select(`
          id, prompt_and_iterations, final_output, verification_grid_reference,
          action_plan, learner_note, status, saved_at
        `)
        .eq('user_id', user.id)
        .eq('course_id', id)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (['42P01', 'PGRST205'].includes(error.code)) {
          setFinalProjectAvailable(false);
        } else {
          console.error('Chargement de la remise finale impossible :', error);
          setFinalProjectFeedback({
            type: 'error',
            message: "Votre dernière remise n'a pas pu être chargée. Réessayez dans quelques instants.",
          });
        }
        setFinalProjectLoading(false);
        return;
      }

      if (data) {
        const loadedWork = {
          prompt_and_iterations: data.prompt_and_iterations,
          final_output: data.final_output,
          verification_grid_reference: data.verification_grid_reference,
          action_plan: data.action_plan,
          learner_note: data.learner_note,
        };
        setFinalProjectWork(loadedWork);
        setSavedFinalProjectWork({ ...data, ...loadedWork });
      } else {
        setFinalProjectWork(emptyFinalProjectWork);
        setSavedFinalProjectWork(null);
      }

      setFinalProjectLoading(false);
    }

    loadLatestFinalProjectWork();
  }, [accessGranted, course, id, quizCompleted, user]);

  useEffect(() => {
    async function loadLatestFinalProjectReview() {
      if (!accessGranted || !quizCompleted || !course?.finalProject || !user) return;

      setFinalProjectReviewLoading(true);
      setFinalProjectReviewsAvailable(true);
      const { data, error } = await supabase
        .from('course_final_project_latest_reviews')
        .select(`
          id, submission_id, submission_saved_at,
          need_and_audience_level, prompt_and_success_criteria_level,
          checks_and_risks_level, choices_and_limits_level,
          appreciation, improvement_areas, review_status, created_at
        `)
        .eq('user_id', user.id)
        .eq('course_id', id)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (['42P01', 'PGRST205'].includes(error.code)) {
          setFinalProjectReviewsAvailable(false);
        } else {
          console.error("Chargement de l'évaluation finale impossible :", error);
        }
        setFinalProjectReviewLoading(false);
        return;
      }

      setFinalProjectReview(data || null);
      setFinalProjectReviewLoading(false);
    }

    loadLatestFinalProjectReview();
  }, [accessGranted, course, id, quizCompleted, user]);

  const handleCopy = (text, exerciseId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(exerciseId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenExercise = (exerciseId) => {
    setActiveTab('exercises');
    window.requestAnimationFrame(() => {
      const exercise = document.getElementById(`course-exercise-${exerciseId}`);
      exercise?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      exercise?.focus({ preventScroll: true });
    });
  };

  const handleExerciseAnswerChange = (exerciseId, value) => {
    const key = String(exerciseId);
    setExerciseAnswers((current) => ({ ...current, [key]: value }));
    setExerciseSaveStates((current) => ({ ...current, [key]: null, global: null }));
  };

  const handleSaveExerciseAnswer = async (exerciseId, status) => {
    const key = String(exerciseId);
    const responseText = exerciseAnswers[key]?.trim() || '';

    if (!responseText || !exerciseResponsesAvailable) return;

    setExerciseSaveStates((current) => ({
      ...current,
      [key]: { state: 'saving', message: 'Enregistrement en cours…' },
    }));

    const { data, error } = await supabase
      .from('course_exercise_responses')
      .insert({
        user_id: user.id,
        course_id: id,
        exercise_id: key,
        response_text: responseText,
        status,
      })
      .select('id, response_text, status, saved_at')
      .single();

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) setExerciseResponsesAvailable(false);
      console.error("Erreur lors de l'enregistrement de la réponse :", error);
      setExerciseSaveStates((current) => ({
        ...current,
        [key]: {
          state: 'error',
          message: "La réponse n'a pas été enregistrée. Réessayez dans quelques instants.",
        },
      }));
      return;
    }

    setExerciseAnswers((current) => ({ ...current, [key]: data.response_text }));
    setSavedExerciseAnswers((current) => ({
      ...current,
      [key]: { id: data.id, text: data.response_text, status: data.status, savedAt: data.saved_at },
    }));
    setExerciseSaveStates((current) => ({
      ...current,
      [key]: {
        state: 'success',
        message: status === 'submitted'
          ? 'Réponse terminée enregistrée.'
          : 'Brouillon enregistré.',
      },
    }));
  };

  const handleFinalProjectWorkChange = (fieldId, value) => {
    setFinalProjectWork((current) => ({ ...current, [fieldId]: value }));
    setFinalProjectFeedback(null);
  };

  const handleSaveFinalProjectWork = async (status) => {
    const submissionFields = course?.finalProject?.submissionFields || [];
    const deliverableValues = Object.fromEntries(
      submissionFields.map((field) => [field.id, finalProjectWork[field.id]?.trim() || '']),
    );
    const hasAtLeastOneDeliverable = Object.values(deliverableValues).some(Boolean);
    const hasAllDeliverables = Object.values(deliverableValues).every(Boolean);

    if (!finalProjectAvailable || finalProjectLoading) return;

    if (status === 'draft' && !hasAtLeastOneDeliverable) {
      setFinalProjectFeedback({
        type: 'error',
        message: 'Renseignez au moins un livrable avant d’enregistrer un brouillon.',
      });
      return;
    }

    if (status === 'submitted' && !hasAllDeliverables) {
      setFinalProjectFeedback({
        type: 'error',
        message: 'Les quatre livrables doivent être identifiés avant la remise au formateur.',
      });
      return;
    }

    setFinalProjectFeedback({ type: 'pending', message: 'Enregistrement de votre remise…' });

    const { data, error } = await supabase
      .from('course_final_project_submissions')
      .insert({
        user_id: user.id,
        course_id: id,
        ...deliverableValues,
        learner_note: finalProjectWork.learner_note.trim(),
        status,
      })
      .select(`
        id, prompt_and_iterations, final_output, verification_grid_reference,
        action_plan, learner_note, status, saved_at
      `)
      .single();

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) setFinalProjectAvailable(false);
      console.error("Enregistrement de la remise finale impossible :", error);
      setFinalProjectFeedback({
        type: 'error',
        message: "Votre remise n'a pas été enregistrée. Réessayez dans quelques instants.",
      });
      return;
    }

    const savedWork = {
      prompt_and_iterations: data.prompt_and_iterations,
      final_output: data.final_output,
      verification_grid_reference: data.verification_grid_reference,
      action_plan: data.action_plan,
      learner_note: data.learner_note,
    };
    setFinalProjectWork(savedWork);
    setSavedFinalProjectWork({ ...data, ...savedWork });
    setFinalProjectFeedback({
      type: 'success',
      message: status === 'submitted'
        ? 'Vos quatre livrables ont été remis au formateur.'
        : 'Votre brouillon a été enregistré.',
    });
  };

  if (loading) return <div className="container section">Chargement sécurisé de la formation…</div>;
  if (accessError) return <div className="container section" role="alert">{accessError}</div>;
  if (!course || !accessGranted) return null;

  if (!quizCompleted) {
    return (
      <div className="container course-player-container">
        <PrerequisiteQuiz
          courseId={id}
          courseTitle={course.title}
          questions={course.quiz}
          userId={user.id}
          learnerEmail={user.email}
          positioningLevels={course.positioningLevels}
          positioningDomains={course.positioningDomains}
          onComplete={() => setQuizCompleted(true)}
        />
      </div>
    );
  }

  const filteredGlossary = course.glossary.filter((item) =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase())
      || item.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const courseProgress = calculateCourseProgress(
    course.exercises,
    Object.entries(savedExerciseAnswers).map(([exerciseId, answer]) => ({
      exercise_id: exerciseId,
      status: answer.status,
    })),
    Object.values(exerciseReviews),
  );
  const finalProjectSubmissionFields = course.finalProject?.submissionFields || [];
  const completedFinalProjectFields = finalProjectSubmissionFields.filter(
    (field) => finalProjectWork[field.id]?.trim(),
  ).length;
  const finalProjectHasUnsavedChanges = finalProjectSubmissionFields.some(
    (field) => (finalProjectWork[field.id]?.trim() || '') !== (savedFinalProjectWork?.[field.id] || ''),
  ) || finalProjectWork.learner_note.trim() !== (savedFinalProjectWork?.learner_note || '');
  const finalProjectIsSaving = finalProjectFeedback?.type === 'pending';
  const reviewedFinalProjectIsLatest = finalProjectReview
    && savedFinalProjectWork
    && finalProjectReview.submission_id === savedFinalProjectWork.id;

  return (
    <div className="container course-player-container">
      <div className="course-header">
        <p className="course-eyebrow">Votre parcours FormaPrompt</p>
        <h1 className="course-title">{course.title}</h1>
        <div className="course-header-actions">
          <div className="access-badge">
            <Sparkles size={16} aria-hidden="true" />
            Accès vérifié et sécurisé
          </div>
          {course.durationLabel && (
            <div className="course-duration-badge">
              <Clock3 size={16} aria-hidden="true" />
              {course.durationLabel}
            </div>
          )}
        </div>
      </div>

      <CourseProgress
        progress={courseProgress}
        loading={exerciseResponsesLoading || exerciseReviewsLoading}
      />

      {course.modules?.length ? (
        <section className="learning-path-section" aria-labelledby="learning-path-title">
          <div className="learning-path-heading">
            <p className="course-eyebrow">Parcours pédagogique</p>
            <h2 id="learning-path-title" className="current-module-title">{course.moduleTitle}</h2>
            <p>
              Ouvrez chaque module pour retrouver ses objectifs, les repères abordés avec le formateur et la mise en
              pratique prévue pendant la séance.
            </p>
          </div>
          <div className="learning-module-list">
            {course.modules.map((module, index) => (
              <details key={module.id} className="learning-module" open={index === 0}>
                <summary>
                  <span className="learning-module-number">{module.number}</span>
                  <span className="learning-module-heading">
                    <strong>{module.title}</strong>
                    <span>{module.summary}</span>
                  </span>
                  <span className="learning-module-duration">
                    <Clock3 size={17} aria-hidden="true" />
                    {module.duration}
                  </span>
                </summary>
                <div className="learning-module-content">
                  <div>
                    <h3>Objectifs du module</h3>
                    <ul>{module.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
                  </div>
                  <div>
                    <h3>Repères clés</h3>
                    <ul>{module.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                  </div>
                  {module.lesson && (
                    <div className="module-lesson">
                      <section className="module-lesson-introduction" aria-labelledby={`module-${module.id}-explanation`}>
                        <p className="module-lesson-kicker">Explication pour débuter</p>
                        <h3 id={`module-${module.id}-explanation`}>Comprendre avant de pratiquer</h3>
                        {module.lesson.introduction.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      </section>

                      {module.lesson.concepts?.length > 0 && (
                        <section aria-labelledby={`module-${module.id}-concepts`}>
                          <h3 id={`module-${module.id}-concepts`}>Trois notions à distinguer</h3>
                          <div className="module-concept-grid">
                            {module.lesson.concepts.map((concept) => (
                              <article key={concept.title} className="module-concept-card">
                                <h4>{concept.title}</h4>
                                <p>{concept.description}</p>
                              </article>
                            ))}
                          </div>
                        </section>
                      )}

                      {module.lesson.guidedSteps?.length > 0 && (
                        <section aria-labelledby={`module-${module.id}-method`}>
                          <h3 id={`module-${module.id}-method`}>Méthode guidée en cinq étapes</h3>
                          <ol className="module-guided-steps">
                            {module.lesson.guidedSteps.map((step) => (
                              <li key={step.title}>
                                <strong>{step.title}</strong>
                                <span>{step.description}</span>
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}

                      {module.lesson.demonstration && (
                        <section className="module-demonstration" aria-labelledby={`module-${module.id}-demonstration`}>
                          <p className="module-lesson-kicker">Exemple professionnel expliqué</p>
                          <h3 id={`module-${module.id}-demonstration`}>{module.lesson.demonstration.title}</h3>
                          <p>{module.lesson.demonstration.introduction}</p>
                          <div className="module-table-wrapper">
                            <table>
                              <thead>
                                <tr>
                                  {module.lesson.demonstration.columns.map((column) => <th key={column} scope="col">{column}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {module.lesson.demonstration.rows.map((row) => (
                                  <tr key={row[0]}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`${row[0]}-${cellIndex}`} data-label={module.lesson.demonstration.columns[cellIndex]}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {module.lesson.professionalExample && (
                        <section className="module-before-after" aria-labelledby={`module-${module.id}-example`}>
                          <h3 id={`module-${module.id}-example`}>{module.lesson.professionalExample.title}</h3>
                          <div className="module-before-after-grid">
                            <article className="module-example-card module-example-card--unsafe">
                              <h4>Demande à éviter</h4>
                              <p>{module.lesson.professionalExample.unsafeRequest}</p>
                            </article>
                            <article className="module-example-card module-example-card--safer">
                              <h4>Approche plus sûre</h4>
                              <p>{module.lesson.professionalExample.saferRequest}</p>
                            </article>
                          </div>
                          <h4>Pourquoi cette approche est préférable</h4>
                          <ul>{module.lesson.professionalExample.analysis.map((point) => <li key={point}>{point}</li>)}</ul>
                        </section>
                      )}

                      <div className="module-recap-grid">
                        {module.lesson.commonMistakes?.length > 0 && (
                          <section className="module-recap-card module-recap-card--warning" aria-labelledby={`module-${module.id}-mistakes`}>
                            <h3 id={`module-${module.id}-mistakes`}>Erreurs fréquentes</h3>
                            <ul>{module.lesson.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
                          </section>
                        )}
                        {module.lesson.takeaways?.length > 0 && (
                          <section className="module-recap-card module-recap-card--takeaway" aria-labelledby={`module-${module.id}-takeaways`}>
                            <h3 id={`module-${module.id}-takeaways`}>À retenir</h3>
                            <ul>{module.lesson.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>
                          </section>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="learning-module-activity">
                    <h3>Mise en pratique</h3>
                    <p>{module.activity}</p>
                    {(module.exerciseId || module.resource) && (
                      <div className="learning-module-actions">
                        {module.exerciseId && (
                          <button type="button" className="btn module-exercise-link" onClick={() => handleOpenExercise(module.exerciseId)}>
                            Ouvrir l'exercice du module {module.number}
                          </button>
                        )}
                        {module.resource && (
                          <a
                            href={module.resource.href}
                            className="btn module-resource-link"
                            download={module.resource.download || undefined}
                          >
                            <Download size={18} aria-hidden="true" />
                            {module.resource.action}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : (
        <section aria-labelledby="current-module-title">
          <h2 id="current-module-title" className="current-module-title">{course.moduleTitle}</h2>
          {course.videoUrl ? (
            <div className="video-container video-container-with-player">
              <video controls preload="metadata" playsInline className="course-video">
                <source src={course.videoUrl} type="video/mp4" />
                Votre navigateur ne permet pas de lire cette vidéo.
              </video>
            </div>
          ) : (
            <div className="video-container">
              <Play className="video-placeholder-icon" aria-hidden="true" />
              <p className="video-placeholder-title">La première vidéo sera bientôt disponible.</p>
            </div>
          )}
        </section>
      )}

      {course.finalProject && (
        <section className="final-project-section" aria-labelledby="final-project-title">
            <div className="final-project-heading">
              <Sparkles size={34} aria-hidden="true" />
              <div>
                <p className="course-eyebrow">Évaluation finale</p>
                <h2 id="final-project-title">{course.finalProject.title}</h2>
                <p>{course.finalProject.description}</p>
              </div>
            </div>
            {course.finalProject.learnerGuidance && (
              <aside className="final-project-guidance" aria-labelledby="final-project-guidance-title">
                <h3 id="final-project-guidance-title">Ce que le formateur attend de vous</h3>
                <p>{course.finalProject.learnerGuidance}</p>
              </aside>
            )}
            <div className="final-project-grid">
            <article>
              <h3>Étapes attendues</h3>
              <ol>{course.finalProject.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </article>
            <article>
              <h3>Éléments à remettre</h3>
              <ul>{course.finalProject.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
                <h3>Critères d’évaluation</h3>
                <ul>{course.finalProject.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
              </article>
            </div>
            {course.finalProject.rubric?.length > 0 && course.finalProject.rubricLevels?.length > 0 && (
              <section className="final-project-rubric" aria-labelledby="final-project-rubric-title">
                <div className="final-project-rubric__heading">
                  <p className="course-eyebrow">Grille commune à l’apprenant et au formateur</p>
                  <h3 id="final-project-rubric-title">Comment votre travail sera évalué</h3>
                  <p>
                    Avant la remise, relisez chaque ligne et repérez le niveau qui décrit le mieux votre travail.
                    Le formateur choisira ensuite un niveau pour chacun des quatre critères et ajoutera une appréciation.
                  </p>
                </div>

                <div className="final-project-levels" aria-label="Signification des quatre niveaux">
                  {course.finalProject.rubricLevels.map((level) => (
                    <article key={level.id} className={`final-project-level is-${level.id}`}>
                      <h4>{level.label}</h4>
                      <p>{level.help}</p>
                    </article>
                  ))}
                </div>

                <div className="final-project-rubric-table-wrapper">
                  <table className="final-project-rubric-table">
                    <caption className="sr-only">
                      Grille d’évaluation du cas pratique final, avec quatre critères et quatre niveaux d’acquisition
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Critère observé</th>
                        {course.finalProject.rubricLevels.map((level) => (
                          <th key={level.id} scope="col">{level.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {course.finalProject.rubric.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">{item.criterion}</th>
                          {course.finalProject.rubricLevels.map((level) => (
                            <td key={level.id} data-label={level.label}>
                              {item.descriptors[level.id]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <aside className="final-project-validation-rule" aria-labelledby="final-project-validation-title">
                  <h4 id="final-project-validation-title">Quand l’évaluation est-elle validée ?</h4>
                  <p>{course.finalProject.validationRule}</p>
                </aside>
              </section>
            )}
          {course.finalProject.resource && (
            <a
              href={course.finalProject.resource.href}
              className="btn final-project-resource-link"
              download={course.finalProject.resource.download || undefined}
            >
              <Download size={18} aria-hidden="true" />
              {course.finalProject.resource.action}
            </a>
          )}
          {finalProjectSubmissionFields.length > 0 && (
            <section className="final-project-submission" aria-labelledby="final-project-submission-title">
              <div className="final-project-submission__heading">
                <div>
                  <p className="course-eyebrow">Votre remise</p>
                  <h3 id="final-project-submission-title">Identifiez vos quatre livrables</h3>
                </div>
                <span>{completedFinalProjectFields} / {finalProjectSubmissionFields.length} renseignés</span>
              </div>
              <p className="final-project-submission__introduction">
                Pour chaque élément, indiquez une courte description, le nom du document ou un lien sécurisé que le
                formateur est autorisé à ouvrir. Vous pourrez enregistrer un brouillon et revenir le compléter.
              </p>
              <aside className="final-project-submission__privacy" aria-label="Précaution concernant les données">
                N’insérez aucune donnée personnelle, sensible ou confidentielle. Si vous utilisez un lien, vérifiez
                volontairement ses droits d’accès et ne partagez que les personnes nécessaires.
              </aside>

              {!finalProjectAvailable && (
                <p className="final-project-submission__notice" role="status">
                  L’espace de remise sécurisé est prêt dans l’application mais doit encore être activé dans Supabase.
                  Aucun livrable ne peut être enregistré avant cette activation.
                </p>
              )}
              {finalProjectLoading && (
                <p className="final-project-submission__notice" role="status">Chargement de votre dernière remise…</p>
              )}

              <form onSubmit={(event) => event.preventDefault()}>
                <div className="final-project-submission__fields">
                  {finalProjectSubmissionFields.map((field) => (
                    <div key={field.id} className="final-project-submission__field">
                      <label htmlFor={`final-project-${field.id}`}>{field.label}</label>
                      <p id={`final-project-${field.id}-help`}>{field.help}</p>
                      <textarea
                        id={`final-project-${field.id}`}
                        value={finalProjectWork[field.id] || ''}
                        onChange={(event) => handleFinalProjectWorkChange(field.id, event.target.value)}
                        placeholder={field.placeholder}
                        rows="5"
                        maxLength="5000"
                        aria-describedby={`final-project-${field.id}-help`}
                        disabled={finalProjectLoading || !finalProjectAvailable || finalProjectIsSaving}
                      />
                    </div>
                  ))}
                </div>

                <div className="final-project-submission__note">
                  <label htmlFor="final-project-learner-note">Message facultatif au formateur</label>
                  <p id="final-project-learner-note-help">
                    Signalez une difficulté, une précision utile ou la partie sur laquelle vous souhaitez un retour.
                  </p>
                  <textarea
                    id="final-project-learner-note"
                    value={finalProjectWork.learner_note}
                    onChange={(event) => handleFinalProjectWorkChange('learner_note', event.target.value)}
                    placeholder="Exemple : je souhaite un retour particulier sur mes critères de vérification…"
                    rows="4"
                    maxLength="2000"
                    aria-describedby="final-project-learner-note-help"
                    disabled={finalProjectLoading || !finalProjectAvailable || finalProjectIsSaving}
                  />
                </div>

                <div className="final-project-submission__status" aria-live="polite">
                  {savedFinalProjectWork && (
                    <p>
                      Dernière version : {savedFinalProjectWork.status === 'submitted' ? 'remise au formateur' : 'brouillon'}
                      {' '}enregistrée le {exerciseSaveDateFormatter.format(new Date(savedFinalProjectWork.saved_at))}.
                    </p>
                  )}
                  {finalProjectHasUnsavedChanges && finalProjectAvailable && (
                    <p className="is-unsaved">Des modifications restent à enregistrer.</p>
                  )}
                  {finalProjectFeedback && (
                    <p
                      className={`is-${finalProjectFeedback.type}`}
                      role={finalProjectFeedback.type === 'error' ? 'alert' : 'status'}
                    >
                      {finalProjectFeedback.message}
                    </p>
                  )}
                </div>

                <div className="final-project-submission__actions">
                  <button
                    type="button"
                    className="btn final-project-save-draft"
                    onClick={() => handleSaveFinalProjectWork('draft')}
                    disabled={
                      completedFinalProjectFields === 0
                      || finalProjectLoading
                      || !finalProjectAvailable
                      || finalProjectIsSaving
                    }
                  >
                    <Save size={18} aria-hidden="true" />
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    className="btn final-project-submit"
                    onClick={() => handleSaveFinalProjectWork('submitted')}
                    disabled={
                      completedFinalProjectFields !== finalProjectSubmissionFields.length
                      || finalProjectLoading
                      || !finalProjectAvailable
                      || finalProjectIsSaving
                    }
                  >
                    <Send size={18} aria-hidden="true" />
                    Remettre au formateur
                  </button>
                </div>
              </form>
            </section>
          )}
          {finalProjectReview && (
            <section
              className={`final-project-review is-${finalProjectReview.review_status}`}
              aria-labelledby="final-project-review-title"
            >
              <div className="final-project-review__heading">
                <div>
                  <p className="course-eyebrow">Retour du formateur</p>
                  <h3 id="final-project-review-title">
                    {finalProjectReview.review_status === 'validated'
                      ? 'Votre évaluation finale est validée'
                      : 'Votre cas final est à compléter'}
                  </h3>
                </div>
                <span>
                  {finalProjectReview.review_status === 'validated' ? 'Validé' : 'Nouvelle remise attendue'}
                </span>
              </div>

              {!reviewedFinalProjectIsLatest && savedFinalProjectWork?.status === 'submitted' && (
                <p className="final-project-review__pending-version" role="status">
                  Une remise plus récente est en attente d’évaluation. Le résultat ci-dessous concerne votre version du{' '}
                  {exerciseSaveDateFormatter.format(new Date(finalProjectReview.submission_saved_at))}.
                </p>
              )}

              <div className="final-project-review__criteria" aria-label="Niveaux obtenus par critère">
                {FINAL_PROJECT_REVIEW_FIELDS.map(({ rubricId, column }) => {
                  const criterion = course.finalProject.rubric?.find((item) => item.id === rubricId);
                  const level = course.finalProject.rubricLevels?.find(
                    (item) => item.id === finalProjectReview[column],
                  );
                  if (!criterion || !level) return null;

                  return (
                    <article key={rubricId}>
                      <h4>{criterion.criterion}</h4>
                      <span className={`is-${level.id}`}>{level.label}</span>
                      <p>{criterion.descriptors[level.id]}</p>
                    </article>
                  );
                })}
              </div>

              <div className="final-project-review__feedback">
                <article>
                  <h4>Appréciation générale</h4>
                  <p>{finalProjectReview.appreciation}</p>
                </article>
                <article>
                  <h4>Axes de progrès ou prochaine étape</h4>
                  <p>{finalProjectReview.improvement_areas}</p>
                </article>
              </div>

              <p className="final-project-review__date">
                Évaluation enregistrée le {exerciseSaveDateFormatter.format(new Date(finalProjectReview.created_at))}
                {' '}sur la remise du {exerciseSaveDateFormatter.format(new Date(finalProjectReview.submission_saved_at))}.
              </p>
              {finalProjectReview.review_status === 'needs_revision' && reviewedFinalProjectIsLatest && (
                <p className="final-project-review__next-step">
                  Reprenez les éléments signalés ci-dessus, enregistrez vos modifications puis utilisez à nouveau
                  « Remettre au formateur ». Votre première remise et cette évaluation resteront conservées.
                </p>
              )}
            </section>
          )}
          {!finalProjectReviewLoading
            && finalProjectReviewsAvailable
            && !finalProjectReview
            && savedFinalProjectWork?.status === 'submitted' && (
              <section className="final-project-review is-pending" aria-label="Évaluation finale en attente">
                <div className="final-project-review__heading">
                  <div>
                    <p className="course-eyebrow">Retour du formateur</p>
                    <h3>Votre remise attend son évaluation</h3>
                  </div>
                  <span>En attente</span>
                </div>
                <p>
                  Vos quatre livrables ont bien été remis. Le formateur utilisera la grille commune ci-dessus et vous
                  retrouverez ici les niveaux obtenus, son appréciation et vos axes de progrès.
                </p>
              </section>
            )}
        </section>
      )}

      <section className="resources-section" aria-label="Ressources de la formation">
        <div className="resources-tabs" role="tablist" aria-label="Contenus complémentaires">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'resources'}
            className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
            onClick={() => setActiveTab('resources')}
          >
            <FileText size={20} aria-hidden="true" />
            Supports et liens
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'exercises'}
            className={`tab-btn ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            <Code size={20} aria-hidden="true" />
            Exercices pratiques
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'glossary'}
            className={`tab-btn ${activeTab === 'glossary' ? 'active' : ''}`}
            onClick={() => setActiveTab('glossary')}
          >
            <BookOpen size={20} aria-hidden="true" />
            Lexique
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'resources' && (
            <div className="download-grid">
              {course.resources.map((resource) => (
                <article key={resource.href} className="download-card">
                  <div className="file-icon-wrapper">
                    {resource.external ? <ExternalLink size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}
                  </div>
                  <div className="file-info">
                    <h3 className="file-title">{resource.title}</h3>
                    <p className="file-desc">{resource.description}</p>
                    {resource.pending ? (
                      <p className="resource-pending" role="status">
                        {resource.action}. La bibliothèque sera remise pendant la formation dès que l’espace Notion sera connecté.
                      </p>
                    ) : (
                      <a
                        href={resource.href}
                        download={resource.download}
                        target={resource.external ? '_blank' : undefined}
                        rel={resource.external ? 'noreferrer' : undefined}
                        className="btn btn-primary resource-link"
                      >
                        {resource.external ? <ExternalLink size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                        {resource.action}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeTab === 'exercises' && (
            <div className="exercise-list">
              {exerciseResponsesLoading && (
                <p className="exercise-storage-notice" role="status">Chargement de vos réponses enregistrées…</p>
              )}
              {!exerciseResponsesAvailable && (
                <p className="exercise-storage-notice exercise-storage-notice-warning" role="status">
                  L'enregistrement sécurisé des réponses est en cours d'activation. Vous pourrez utiliser cet espace dès sa mise en service.
                </p>
              )}
              {exerciseSaveStates.global?.state === 'error' && (
                <p className="exercise-storage-notice exercise-storage-notice-error" role="alert">
                  {exerciseSaveStates.global.message}
                </p>
              )}
              {course.exercises.map((exercise) => (
                <article
                  key={exercise.id}
                  id={`course-exercise-${exercise.id}`}
                  className="exercise-card"
                  tabIndex="-1"
                >
                  <div className="exercise-header">
                    <div className="exercise-title-area">
                      <span className="exercise-number">{exercise.id}</span>
                      <h3 className="exercise-title">{exercise.title}</h3>
                    </div>
                    <span className="exercise-objective">{exercise.objective}</span>
                  </div>
                  <div className="exercise-body">
                    <p className="exercise-instructions">{exercise.instructions}</p>
                    {(exercise.howTo?.length > 0 || exercise.successCriteria?.length > 0) && (
                      <div className="exercise-guidance-grid">
                        {exercise.howTo?.length > 0 && (
                          <section className="exercise-how-to" aria-labelledby={`exercise-${exercise.id}-how-to`}>
                            <h4 id={`exercise-${exercise.id}-how-to`}>Mode d'emploi</h4>
                            <ol>
                              {exercise.howTo.map((step) => <li key={step}>{step}</li>)}
                            </ol>
                            {exercise.resource && (
                              <a
                                href={exercise.resource.href}
                                className="exercise-resource-link"
                                download={exercise.resource.download || undefined}
                              >
                                <Download size={17} aria-hidden="true" />
                                {exercise.resource.action}
                              </a>
                            )}
                          </section>
                        )}
                        {exercise.successCriteria?.length > 0 && (
                          <section className="exercise-self-assessment" aria-labelledby={`exercise-${exercise.id}-criteria`}>
                            <h4 id={`exercise-${exercise.id}-criteria`}>Je peux valider mon exercice si…</h4>
                            <ul>
                              {exercise.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
                            </ul>
                          </section>
                        )}
                      </div>
                    )}
                    <h4 className="exercise-template-title">Modèle à personnaliser et à tester</h4>
                    <div className="prompt-box">
                      <pre className="prompt-text">{exercise.prompt}</pre>
                      <button
                        type="button"
                        className={`copy-btn ${copiedId === exercise.id ? 'copied' : ''}`}
                        onClick={() => handleCopy(exercise.prompt, exercise.id)}
                        aria-label={`Copier le contenu de l'exercice ${exercise.id}`}
                      >
                        {copiedId === exercise.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                      </button>
                    </div>
                    <section className="exercise-answer" aria-labelledby={`exercise-${exercise.id}-answer-title`}>
                      <div className="exercise-answer-heading">
                        <div>
                          <p className="exercise-answer-kicker">Votre espace de travail personnel</p>
                          <h4 id={`exercise-${exercise.id}-answer-title`}>Rédigez votre réponse</h4>
                        </div>
                        <span className="exercise-answer-count" aria-live="polite">
                          {(exerciseAnswers[String(exercise.id)] || '').length.toLocaleString('fr-FR')} / 20 000 caractères
                        </span>
                      </div>
                      <label className="sr-only" htmlFor={`exercise-${exercise.id}-answer`}>
                        Votre réponse à l'exercice {exercise.id} : {exercise.title}
                      </label>
                      <textarea
                        id={`exercise-${exercise.id}-answer`}
                        className="exercise-answer-input"
                        value={exerciseAnswers[String(exercise.id)] || ''}
                        onChange={(event) => handleExerciseAnswerChange(exercise.id, event.target.value)}
                        placeholder="Saisissez ici votre essai, le résultat obtenu, vos corrections et ce que vous retenez de l'exercice."
                        rows="9"
                        maxLength="20000"
                        disabled={exerciseResponsesLoading || !exerciseResponsesAvailable}
                        aria-describedby={`exercise-${exercise.id}-answer-help exercise-${exercise.id}-answer-status`}
                      />
                      <p id={`exercise-${exercise.id}-answer-help`} className="exercise-answer-help">
                        Enregistrez un brouillon pour reprendre plus tard, ou déclarez la réponse terminée lorsque vous avez vérifié les critères ci-dessus. Chaque sauvegarde conserve une nouvelle version.
                      </p>
                      <div className="exercise-answer-actions">
                        <button
                          type="button"
                          className="btn exercise-save-draft"
                          onClick={() => handleSaveExerciseAnswer(exercise.id, 'draft')}
                          disabled={
                            exerciseResponsesLoading
                            || !exerciseResponsesAvailable
                            || !exerciseAnswers[String(exercise.id)]?.trim()
                            || exerciseSaveStates[String(exercise.id)]?.state === 'saving'
                          }
                        >
                          <Save size={17} aria-hidden="true" />
                          Enregistrer le brouillon
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary exercise-submit-answer"
                          onClick={() => handleSaveExerciseAnswer(exercise.id, 'submitted')}
                          disabled={
                            exerciseResponsesLoading
                            || !exerciseResponsesAvailable
                            || !exerciseAnswers[String(exercise.id)]?.trim()
                            || exerciseSaveStates[String(exercise.id)]?.state === 'saving'
                          }
                        >
                          <Send size={17} aria-hidden="true" />
                          Déclarer la réponse terminée
                        </button>
                      </div>
                      <div id={`exercise-${exercise.id}-answer-status`} className="exercise-answer-status" aria-live="polite">
                        {savedExerciseAnswers[String(exercise.id)] && (
                          <p>
                            Dernière version : {savedExerciseAnswers[String(exercise.id)].status === 'submitted' ? 'réponse terminée' : 'brouillon'} enregistrée le{' '}
                            {exerciseSaveDateFormatter.format(new Date(savedExerciseAnswers[String(exercise.id)].savedAt))}.
                          </p>
                        )}
                        {savedExerciseAnswers[String(exercise.id)]
                          && exerciseAnswers[String(exercise.id)] !== savedExerciseAnswers[String(exercise.id)].text && (
                          <p className="exercise-answer-unsaved">Des modifications restent à enregistrer.</p>
                        )}
                        {exerciseSaveStates[String(exercise.id)]?.message && (
                          <p className={`exercise-answer-message is-${exerciseSaveStates[String(exercise.id)].state}`}>
                            {exerciseSaveStates[String(exercise.id)].message}
                          </p>
                        )}
                      </div>
                      {exerciseReviews[String(exercise.id)] && (
                        <aside
                          className={`exercise-trainer-review is-${exerciseReviews[String(exercise.id)].review_status}`}
                          aria-labelledby={`exercise-${exercise.id}-trainer-review-title`}
                        >
                          <div className="exercise-trainer-review__heading">
                            <div>
                              <p>Retour du formateur</p>
                              <h4 id={`exercise-${exercise.id}-trainer-review-title`}>
                                {exerciseReviews[String(exercise.id)].review_status === 'validated'
                                  ? 'Exercice validé'
                                  : 'Réponse à reprendre'}
                              </h4>
                            </div>
                            <span>
                              {exerciseReviews[String(exercise.id)].review_status === 'validated' ? 'Validé' : 'À reprendre'}
                            </span>
                          </div>
                          <p className="exercise-trainer-review__feedback">
                            {exerciseReviews[String(exercise.id)].feedback_text}
                          </p>
                          <p className="exercise-trainer-review__date">
                            Retour envoyé le {exerciseSaveDateFormatter.format(new Date(exerciseReviews[String(exercise.id)].created_at))},{' '}
                            sur votre réponse terminée du{' '}
                            {exerciseSaveDateFormatter.format(new Date(exerciseReviews[String(exercise.id)].response_saved_at))}.
                          </p>
                          {savedExerciseAnswers[String(exercise.id)]
                            && savedExerciseAnswers[String(exercise.id)].id !== exerciseReviews[String(exercise.id)].response_id && (
                            <p className="exercise-trainer-review__new-version">
                              Vous avez enregistré une nouvelle version depuis ce retour. Le commentaire reste affiché pour
                              vous aider à vérifier les corrections demandées.
                            </p>
                          )}
                          {exerciseReviews[String(exercise.id)].review_status === 'needs_revision' && (
                            <p className="exercise-trainer-review__next-step">
                              Modifiez votre réponse ci-dessus, enregistrez-la, puis déclarez de nouveau la réponse terminée
                              lorsque les points demandés ont été corrigés.
                            </p>
                          )}
                        </aside>
                      )}
                    </section>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeTab === 'glossary' && (
            <div>
              <div className="glossary-search-wrapper">
                <Search className="glossary-search-icon" size={20} aria-hidden="true" />
                <label className="sr-only" htmlFor="glossary-search">Rechercher dans le lexique</label>
                <input
                  id="glossary-search"
                  type="search"
                  placeholder="Rechercher un terme…"
                  className="glossary-search-input"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              {filteredGlossary.length > 0 ? (
                <div className="glossary-grid">
                  {filteredGlossary.map((item) => (
                    <article key={item.term} className="glossary-item">
                      <h3 className="glossary-term">{item.term}</h3>
                      <p className="glossary-def">{item.definition}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="no-results">Aucun terme ne correspond à « {searchTerm} ».</div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
