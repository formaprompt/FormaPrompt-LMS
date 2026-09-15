import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileSpreadsheet } from 'lucide-react';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabaseClient';
import { fetchExcelResources } from '../lib/paidCourseContent';
import './CoursePlayer.css';

const LEVEL_LABELS = { initiation: 'Initiation', perfectionnement: 'Perfectionnement', avance: 'Avancé' };

export default function ExcelInitiationResources() {
  const { courseId } = useParams();
  const level = LEVEL_LABELS[courseId?.match(/^excel-(initiation|perfectionnement|avance)-/)?.[1]] || 'Excel';
  const [state, setState] = useState({ loading: true, resources: [], error: '' });

  useEffect(() => {
    let active = true;
    fetchExcelResources(supabase, courseId)
      .then((resources) => active && setState({ loading: false, resources, error: '' }))
      .catch((error) => active && setState({ loading: false, resources: [], error: error.message }));
    return () => { active = false; };
  }, [courseId]);

  return (
    <main className="container section">
      <SEO
        title={`Supports Excel ${level} | FormaPrompt`}
        description={`Supports réservés aux participants inscrits à Excel ${level}.`}
        robots="noindex,nofollow"
      />
      <Link to="/formation-excel" className="excel-text-link">Retour à la formation Excel</Link>
      <h1>Supports Excel {level}</h1>
      <p>Ces exercices sont réservés aux personnes disposant d’un accès actif à cette formation.</p>
      {state.loading && <p role="status">Vérification de votre accès…</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {!state.loading && !state.error && (
        <div className="download-grid">
          {state.resources.map((resource) => (
            <article className="download-card" key={resource.download}>
              <FileSpreadsheet size={24} aria-hidden="true" />
              <div className="file-info">
                <h2 className="file-title">{resource.title}</h2>
                <p className="file-desc">{resource.description}</p>
                <a className="btn btn-primary resource-link" href={resource.href} download={resource.download}>
                  <Download size={16} aria-hidden="true" /> Télécharger
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
