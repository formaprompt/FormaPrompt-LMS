import { useCallback, useEffect, useRef, useState } from 'react';
import { AiActChallengeCorrections } from '../components/AiActChallenge';
import { aiActChallengeApi, CHALLENGE_COURSE_ID, challengeDate, challengeError, challengeStatus, challengeThemes } from '../lib/aiActChallenge';
import './AiActChallengeTrainer.css';
import { useAuth } from '../contexts/useAuth';
import { AiActChallengeTrainingEndAdmin } from '../components/AiActChallengeTrainingEnd';

const value = (number, suffix = '') => number == null ? '—' : `${Number(number).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${suffix}`;

export default function AiActChallengeTrainer({ api = aiActChallengeApi, courseId = CHALLENGE_COURSE_ID, trainingAdminApi }) {
  const { role } = useAuth();
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [grants, setGrants] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name');
  const [activeOnly, setActiveOnly] = useState(false);
  const [grantUser, setGrantUser] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const detailHeading = useRef(null);

  const request = useCallback(async (action, payload = {}) => {
    if (lock.current) return;
    const scope = generation.current;
    lock.current = true; setBusy(true); setError(null); setNotice('');
    try {
      const data = await api(action, { course_id: courseId, ...payload });
      if (scope !== generation.current) return;
      if (action === 'trainer_overview') { setOverview(data); setDetail(null); }
      if (action === 'trainer_detail') setDetail(data);
      if (action === 'grants' || action === 'grant') { setGrants(data.grants); if (action === 'grant') setNotice('✓ Habilitation enregistrée par le serveur.'); }
      return data;
    } catch (failure) {
      if (scope !== generation.current) return;
      const problem = challengeError(failure); setError(problem);
      // Toute consultation refusée retire immédiatement les données précédemment affichées.
      if (problem.denied) { setOverview(null); setDetail(null); setGrants(null); }
    } finally { if (scope === generation.current) { lock.current = false; setBusy(false); } }
  }, [api, courseId]);
  useEffect(() => {
    let mounted = true;
    generation.current += 1; lock.current = false;
    queueMicrotask(() => { if (mounted) { setOverview(null); setDetail(null); setGrants(null); request('trainer_overview', { active_only: activeOnly }); } });
    return () => { mounted = false; generation.current += 1; };
  }, [request, activeOnly]);
  useEffect(() => { if (detail) detailHeading.current?.focus(); }, [detail]);

  const learners = (overview?.learners || []).filter((learner) => learner.display_name.toLocaleLowerCase('fr-FR').includes(search.toLocaleLowerCase('fr-FR')) && (status === 'all' || learner.status === status)).sort((a, b) => {
    if (sort === 'score') return (b.best_score ?? -1) - (a.best_score ?? -1);
    if (sort === 'date') return (Date.parse(b.last_finished_at) || 0) - (Date.parse(a.last_finished_at) || 0);
    return a.display_name.localeCompare(b.display_name, 'fr');
  });
  const stats = overview?.stats;

  return <main className="aac aac-trainer" aria-busy={busy}>
    <header className="aac-banner">
      <span aria-hidden="true">▤</span>
      <div>
      <h1>AI ACT CHALLENGE</h1>
      <p>Suivi formateur · Formation AI Act</p>
      </div>
      </header>
    <p>Consultation pédagogique en lecture seule. Les habilitations sont vérifiées par le serveur à chaque consultation.</p>
    <div role="status" aria-live="polite">{busy ? 'Chargement…' : notice}</div>
    {error && <div role="alert" className="aac-error">
      <p>{error.text}</p>
      <button disabled={busy} onClick={() => request('trainer_overview', { active_only: activeOnly })}>Vérifier à nouveau mon accès</button>
      </div>}
    {overview && <>
      <div className="aac-actions">
      <button className="aac-secondary" disabled={busy} onClick={() => request('trainer_overview', { active_only: activeOnly })}>Actualiser les résultats</button>
      <label className="aac-check">
      <input type="checkbox" checked={activeOnly} disabled={busy} onChange={(event) => setActiveOnly(event.target.checked)} /> Afficher uniquement les accès actifs</label>
      </div>
      <h2>Vue générale</h2>
      <p>Population : {stats.population} bénéficiaires d’un droit à la formation · {stats.active} accès actifs · {stats.started} participants ayant démarré · {stats.finished} ayant terminé au moins une tentative.</p>
      <div className="aac-grid aac-statistics">{[['Non démarrés',stats.not_started],['En cours',stats.in_progress],['Réussis',stats.passed],['Non réussis',stats.failed],['Moyenne des meilleurs scores',value(stats.average_best_score,'/12')],['Réussite / population',value(stats.success_rate_population,' %')],['Réussite / participants avec tentative terminée',value(stats.success_rate_finished,' %')]].map(([label,count]) => <div key={label} className="aac-card">
      <strong>{label}</strong>
      <p>{count}</p>
      </div>)}</div>
      <h2>Apprenants</h2>
      <div className="aac-filters">
      <label>Rechercher par nom<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <label>Statut<select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="all">Tous les statuts</option>{['not_started','in_progress','passed','failed'].map((code) => <option key={code} value={code}>{challengeStatus(code)}</option>)}</select>
      </label>
      <label>Trier par<select value={sort} onChange={(event) => setSort(event.target.value)}>
      <option value="name">Nom</option>
      <option value="score">Meilleur score décroissant</option>
      <option value="date">Date de fin la plus récente</option>
      </select>
      </label>
      </div>
      <p>{learners.length} apprenant(s) affiché(s) sur {overview.learners.length}.</p>
      <div className="aac-table-scroll">
      <table>
      <caption>Résultats individuels de la formation AI Act</caption>
      <thead>
      <tr>
      <th scope="col">Apprenant</th>
      <th scope="col">Accès</th>
      <th scope="col">Statut</th>
      <th scope="col">Tentatives</th>
      <th scope="col">Réponses enregistrées (dernière tentative)</th>
      <th scope="col">Dernier score</th>
      <th scope="col">Meilleur score</th>
      <th scope="col">Dernière fin</th>
      <th scope="col">Consultation</th>
      </tr>
      </thead>
      <tbody>{learners.map((learner) => <tr key={learner.user_id}>
      <th scope="row">{learner.display_name}{learner.identity_status !== 'available' && <small>Identité à vérifier · repère neutre</small>}</th>
      <td>{learner.active ? 'Actif' : 'Inactif'}</td>
      <td>{challengeStatus(learner.status)}</td>
      <td>{learner.attempt_count}/2</td>
      <td>{learner.answered_count}/12 réponses</td>
      <td>{value(learner.last_score,'/12')}</td>
      <td>{value(learner.best_score,'/12')}</td>
      <td>{challengeDate(learner.last_finished_at)}</td>
      <td>
      <button disabled={busy} onClick={() => request('trainer_detail', { user_id: learner.user_id })}>Voir le détail<span className="aac-sr-only"> de {learner.display_name}</span>
      </button>
      </td>
      </tr>)}</tbody>
      </table>
      </div>
      {detail && <section className="aac-detail">
      <h2 ref={detailHeading} tabIndex={-1}>{detail.display_name} — détail en lecture seule</h2>
      <p>Meilleur score : {value(detail.best_score,'/12')} · Dernier score : {value(detail.last_score,'/12')} · {challengeStatus(detail.status)}</p>{detail.attempts.length === 0 && <p>Aucune tentative démarrée.</p>}{detail.attempts.map((attempt) => <article className="aac-card" key={attempt.id}>
      <h3>Tentative {attempt.number} — {challengeStatus(attempt.status)}</h3>{attempt.status === 'in_progress' ? <>
      <p>{attempt.answered_count}/12 réponses enregistrées. Aucun score définitif.</p>
      <ul>{detail.questions.map((q) => <li key={q.code}>{q.code} · {q.theme} : {attempt.answers?.[q.code] ? `${attempt.answers[q.code]} — ${q.options.find((o) => o.code === attempt.answers[q.code])?.text}` : 'Réponse non renseignée'}</li>)}</ul>
      </> : <>
      <p>{attempt.score}/12 · {value(attempt.percentage,' %')} · Fin : {challengeDate(attempt.finished_at)}</p>
      <ul>{challengeThemes(attempt,detail.questions).map((theme) => <li key={theme.theme}>{theme.theme} : {theme.correct}/{theme.total}</li>)}</ul>
      <details>
      <summary>Consulter les réponses et les corrections</summary>
      <AiActChallengeCorrections attempt={attempt} questions={detail.questions} />
      </details>
      </>}</article>)}
      {role === 'admin' && overview.is_admin && courseId === CHALLENGE_COURSE_ID && <AiActChallengeTrainingEndAdmin key={detail.user_id} subjectUserId={detail.user_id} api={trainingAdminApi} />}
      </section>}
      <h2>Analyse collective</h2>
      <p>Chaque apprenant compte une fois, avec sa meilleure tentative terminée. En cas d’égalité, la plus récente est retenue. Échantillon : {stats.finished} participant(s).</p>
      <div className="aac-grid">{overview.themes.map((theme) => <div className="aac-card" key={theme.theme}>
      <strong>{theme.theme}</strong>
      <p>{theme.errors} erreur(s) / {theme.total} réponse(s) · échantillon : {theme.sample_size} apprenant(s).</p>
      </div>)}</div>
      <h3>Questions générant le plus d’erreurs</h3>
      <ul>{[...overview.questions].sort((a,b) => b.errors - a.errors).map((q) => <li key={q.code}>{q.code} · {q.theme} : {q.errors} erreur(s) / {q.total} réponse(s)</li>)}</ul>
      <p>Le calendrier réglementaire repose sur une seule question par apprenant : interprétez cet indicateur avec prudence.</p>
      {overview.is_admin && <section className="aac-card">
      <h2>Habilitations formateur</h2>
      <p>Administration uniquement. Accordez ou retirez la consultation de cette formation à partir de l’identifiant utilisateur. Aucun dossier administratif n’est affiché.</p>
      <button disabled={busy} onClick={() => request('grants')}>Consulter les habilitations</button>
      <form onSubmit={(event) => { event.preventDefault(); request('grant',{ user_id:grantUser.trim(),active:true }); }}>
      <label>Identifiant utilisateur (UUID)<input required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={grantUser} onChange={(event) => setGrantUser(event.target.value)} />
      </label>
      <button disabled={busy} type="submit">Accorder l’habilitation AI Act</button>
      </form>{grants && <ul>{grants.filter((grant) => grant.course_id === courseId).map((grant) => <li key={`${grant.user_id}-${grant.course_id}`}>
      <span>{grant.user_id} · {grant.active ? 'Active' : 'Retirée'} · {challengeDate(grant.updated_at)}</span>
      <button disabled={busy} className="aac-secondary" onClick={() => request('grant',{user_id:grant.user_id,active:!grant.active})}>{grant.active ? 'Retirer l’habilitation' : 'Réactiver l’habilitation'}</button>
      </li>)}</ul>}</section>}
    </>}
  </main>;
}
