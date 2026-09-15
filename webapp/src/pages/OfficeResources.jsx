import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileArchive } from 'lucide-react';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabaseClient';
import { fetchOfficeResources } from '../lib/paidCourseContent';
import { canonicalOfficeCourseId } from '../../supabase/functions/_shared/officeResources.js';
import './CoursePlayer.css';

const COURSE_DETAILS = Object.freeze({
  'word-initiation': { label: 'Word Initiation', returnPath: '/formation-word' },
  'word-perfectionnement': { label: 'Word Perfectionnement', returnPath: '/formation-word' },
  'powerpoint-initiation': { label: 'PowerPoint Initiation', returnPath: '/formation-powerpoint' },
});

export default function OfficeResources() {
  const { courseId } = useParams();
  let canonicalCourseId = '';
  try {
    canonicalCourseId = canonicalOfficeCourseId(courseId);
  } catch {
    // L'Edge renverra la réponse générique prévue pour un identifiant invalide.
  }
  const course = COURSE_DETAILS[canonicalCourseId] || { label: 'Bureautique', returnPath: '/formation-bureautique' };
  const [requestState, setRequestState] = useState({ courseId, loading: true, resources: [], error: '' });
  const state = requestState.courseId === courseId
    ? requestState
    : { courseId, loading: true, resources: [], error: '' };

  useEffect(() => {
    let active = true;
    fetchOfficeResources(supabase, courseId)
      .then((resources) => active && setRequestState({ courseId, loading: false, resources, error: '' }))
      .catch((error) => active && setRequestState({ courseId, loading: false, resources: [], error: error.message }));
    return () => { active = false; };
  }, [courseId]);

  return (
    <main className="container section">
      <SEO
        title={`Supports ${course.label} | FormaPrompt`}
        description={`Supports réservés aux participants inscrits à ${course.label}.`}
        robots="noindex,nofollow"
      />
      <Link to={course.returnPath} className="excel-text-link">Retour au programme</Link>
      <h1>Supports {course.label}</h1>
      <p>Ces exercices sont réservés aux personnes disposant d’un accès actif à cette formation.</p>
      {state.loading && <p role="status">Vérification de votre accès…</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <div className="download-grid">
          {state.resources.map((resource) => (
            <article className="download-card" key={resource.download}>
              <FileArchive size={24} aria-hidden="true" />
              <div className="file-info">
                <h2 className="file-title">{resource.title}</h2>
                <p className="file-desc">{resource.description}</p>
                <a className="btn btn-primary resource-link" href={resource.href} download={resource.download}>
                  <Download size={16} aria-hidden="true" /> Télécharger le pack
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
