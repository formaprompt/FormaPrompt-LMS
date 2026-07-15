import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Check, Code, Copy, Download, ExternalLink, FileText, Play, Search, Sparkles } from 'lucide-react';
import PrerequisiteQuiz from '../components/PrerequisiteQuiz';
import { useAuth } from '../contexts/useAuth';
import { courseCatalog } from '../data/courseCatalog';
import { supabase } from '../lib/supabaseClient';
import './CoursePlayer.css';

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

  const handleCopy = (text, exerciseId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(exerciseId);
    setTimeout(() => setCopiedId(null), 2000);
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
          onComplete={() => setQuizCompleted(true)}
        />
      </div>
    );
  }

  const filteredGlossary = course.glossary.filter((item) =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase())
      || item.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
        </div>
      </div>

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
              {course.exercises.map((exercise) => (
                <article key={exercise.id} className="exercise-card">
                  <div className="exercise-header">
                    <div className="exercise-title-area">
                      <span className="exercise-number">{exercise.id}</span>
                      <h3 className="exercise-title">{exercise.title}</h3>
                    </div>
                    <span className="exercise-objective">{exercise.objective}</span>
                  </div>
                  <div className="exercise-body">
                    <p className="exercise-instructions">{exercise.instructions}</p>
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
