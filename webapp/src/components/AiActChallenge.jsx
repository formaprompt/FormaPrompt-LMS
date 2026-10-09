import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { aiActChallengeApi, canFinishAttempt, CHALLENGE_COURSE_ID, challengeDate, challengeError, challengeStatus, challengeThemes, completedAttempts, openAttempt } from '../lib/aiActChallenge';
import './AiActChallenge.css';
import AiActChallengePrivacyNotice from './AiActChallengePrivacyNotice';
import AiActChallengeTrainingEnd from './AiActChallengeTrainingEnd';

export function AiActChallengeCorrections({ attempt, questions }) {
  if (!attempt || attempt.status === 'in_progress' || !attempt.results) return null;
  return <div className="aac-corrections">{attempt.results.map((result) => {
    const question = questions.find((q) => q.code === result.question_code);
    const option = (code) => question?.options.find((o) => o.code === code)?.text || code;
    return <article className="aac-card" key={result.question_code}>
      <h3>{result.is_correct ? '✓ Réponse correcte' : '! Point à revoir'} — {result.question_code} · {question?.theme}</h3>
      <p>{question?.scenario}</p>
      <p>
      <strong>Votre réponse : {result.selected_option}</strong> — {option(result.selected_option)}</p>
      <p>
      <strong>Réponse attendue : {result.correct_option}</strong> — {option(result.correct_option)}</p>
      <div className="aac-exact">
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{result.explanation}</ReactMarkdown>
      </div>
      <div className="aac-exact">
      <strong>Conseil de remédiation</strong>
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{result.remediation}</ReactMarkdown>
      </div>
      <div className="aac-exact">
      <strong>Exemple professionnel</strong>
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{result.example}</ReactMarkdown>
      </div>
      <div className="aac-exact">
      <strong>À retenir</strong>
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{result.takeaway}</ReactMarkdown>
      </div>
      <details>
      <summary>Comprendre la règle juridique</summary>
      <div className="aac-exact">
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{result.legal_reference}</ReactMarkdown>
      </div>
      </details>
    </article>;
  })}</div>;
}

export default function AiActChallenge({ api = aiActChallengeApi, courseId = CHALLENGE_COURSE_ID, trainingApi }) {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState('home');
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState('');
  const heading = useRef(null);
  const questionHeading = useRef(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const attempt = openAttempt(state);
  const finished = completedAttempts(state);
  const selected = state?.attempts.find((item) => item.id === selectedId) || finished.at(-1);
  const questions = state?.questions || [];
  const question = questions[index];

  const run = useCallback(async (action, payload = {}, destination) => {
    if (lock.current) return;
    const scope = generation.current;
    lock.current = true; setBusy(true); setError(null);
    try {
      const next = await api(action, { course_id: courseId, ...payload });
      if (scope !== generation.current) return;
      setState(next); setPending(null);
      if (action === 'save') setNotice(next.acknowledgement && next.acknowledgement.current_revision !== next.acknowledgement.revision ? '✓ Enregistrement confirmé. Des modifications ultérieures existent : les réponses actuelles du serveur sont affichées.' : '✓ Réponse enregistrée et confirmée par le serveur.');
      if (action === 'start') { setIndex(0); setNotice('Nouvelle tentative ouverte.'); }
      if (action === 'finish') { setSelectedId(completedAttempts(next).at(-1)?.id); setNotice('✓ Tentative clôturée. Vos réponses sont verrouillées.'); }
      if (destination) setScreen(destination);
      return next;
    } catch (failure) {
      if (scope !== generation.current) return;
      const detail = challengeError(failure);
      setError(detail); setNotice('');
      if (detail.denied) { setState(null); setPending(null); }
      if (detail.conflict || detail.restricted) setPending(null);
    } finally { if (scope === generation.current) { lock.current = false; setBusy(false); } }
  }, [api, courseId]);
  useEffect(() => {
    let mounted = true;
    generation.current += 1; lock.current = false;
    queueMicrotask(() => { if (mounted) { setState(null); setPending(null); setScreen('home'); setSelectedId(null); setError(null); run('state'); } });
    return () => { mounted = false; generation.current += 1; };
  }, [run]); // Le serveur vérifie les droits à chaque opération.
  useEffect(() => { (screen === 'question' ? questionHeading : heading).current?.focus(); }, [screen, index]);

  function save(option) {
    const operation = { action: 'save', payload: { attempt_id: attempt.id, question_code: question.code, option_code: option, expected_revision: attempt.revision, request_id: crypto.randomUUID() } };
    setPending(operation); setNotice('Enregistrement en cours…'); run(operation.action, operation.payload);
  }
  function mutate(action, payload, destination) {
    const operation = { action, payload, destination };
    setPending(operation); run(action, payload, destination);
  }
  const start = () => mutate('start', { request_id:crypto.randomUUID() }, 'question');
  const blocked = busy || Boolean(pending) || Boolean(error?.conflict);
  const move = (destination) => { if (blocked) return; setError(null); setNotice(''); setScreen(destination); };

  return <section className="aac" aria-busy={busy}>
    <header className="aac-banner">
      <span aria-hidden="true">✦</span>
      <div>
      <h2 ref={heading} tabIndex={-1}>AI ACT CHALLENGE</h2>
      <p>Mission conformité · Évaluation formative</p>
      </div>
      </header>
    <div role="status" aria-live="polite" className="aac-status">{notice || (busy ? 'Chargement…' : '')}</div>
    {error && <div role="alert" className="aac-error">
      <p>{error.text}</p>{!error.denied && <button disabled={busy} onClick={() => error.conflict || !pending ? run('state', {}, 'home') : run(pending.action, pending.payload, pending.destination)}> {error.restricted ? 'Consulter mes résultats' : error.conflict ? 'Recharger les réponses' : 'Réessayer'}</button>}</div>}
    {!state && !busy && !error && <p>Chargement du challenge…</p>}
    {state && screen === 'home' && <>
      <div className="aac-hero">
      <div>
      <p className="aac-eyebrow">JEU PÉDAGOGIQUE</p>
      <h3>Des décisions pour une IA responsable</h3>
      <p>Vous êtes le référent IA d’une entreprise fictive. Analysez douze situations professionnelles et choisissez les décisions adaptées.</p>
      <p>Repérez les pratiques interdites, les systèmes à haut risque, les obligations de transparence et les responsabilités des acteurs.</p>
        {attempt ? <button disabled={blocked} onClick={() => move('resume')}>Reprendre ma tentative {attempt.number}</button> : state.can_start && <button disabled={blocked} onClick={() => finished.length ? move('second') : start()}>{finished.length ? 'Commencer la deuxième tentative' : 'Commencer'}</button>}
      </div>
      <div className="aac-professional" role="presentation" />
      </div>
      <h3>Les règles du challenge</h3>
      <div className="aac-grid">
      <div className="aac-card">
      <strong>12 questions · 3 choix</strong>
      <p>Une seule réponse par situation.</p>
      </div>
      <div className="aac-card">
      <strong>2 tentatives maximum</strong>
      <p>La deuxième est facultative, même après une réussite.</p>
      </div>
      <div className="aac-card">
      <strong>Seuil : 70 % · 9/12 minimum</strong>
      <p>Le meilleur score terminé est retenu.</p>
      </div>
      <div className="aac-card">
      <strong>Corrections après clôture</strong>
      <p>15 à 20 minutes indicatives, sans limite de temps.</p>
      </div>
      </div>
      <p>Ce résultat pédagogique n’est pas une certification et ne conditionne pas votre attestation.</p>
      {!!finished.length && <div className="aac-actions">
      <button onClick={() => move('result')}>Consulter mes résultats</button>
      <button className="aac-secondary" onClick={() => move('summary')}>Voir mon bilan final</button>
      </div>}
    </>}
    {state && screen === 'resume' && attempt && <div className="aac-card">
      <h3>Reprendre votre tentative {attempt.number}</h3>
      <p>{attempt.answered_count}/12 réponses sont enregistrées. La reprise conserve cette tentative.</p>
      <button onClick={() => { const missing = questions.findIndex((q) => !attempt.answers?.[q.code]); setIndex(missing < 0 ? 0 : missing); move('question'); }}>Reprendre les questions</button>
      </div>}
    {state && screen === 'second' && <div className="aac-card">
      <h3>Deuxième tentative facultative</h3>
      <p>Vous retrouverez les mêmes douze questions dans le même ordre, avec des réponses vierges. Votre premier résultat reste conservé. Le meilleur score terminé est retenu.</p>
      <div className="aac-actions">
      <button disabled={blocked || !state.can_start} onClick={start}>Commencer la tentative 2</button>
      <button className="aac-secondary" disabled={blocked} onClick={() => move('summary')}>Conserver mon bilan</button>
      </div>
      </div>}
    {state && screen === 'question' && attempt && question && <>
      <div className="aac-progress">
      <strong>Question {index + 1}/12 · Tentative {attempt.number}</strong>
      <span>{attempt.answered_count}/12 réponses enregistrées</span>
      </div>
      <progress max="12" value={attempt.answered_count} aria-label="Réponses enregistrées" />
      <div className="aac-card aac-scenario">
      <p className="aac-eyebrow">Cas pratique · {question.theme}</p>
      <h3 ref={questionHeading} tabIndex={-1}>{question.scenario}</h3>
      </div>
      <fieldset disabled={blocked}>
      <legend>Choisissez une réponse</legend>{question.options.map((option) => <label className={`aac-option ${attempt.answers?.[question.code] === option.code ? 'aac-selected' : ''}`} key={option.code}>
      <input type="radio" name={question.code} checked={attempt.answers?.[question.code] === option.code} onChange={() => save(option.code)} />
      <strong>{option.code}</strong>
      <span>{option.text}</span>
      </label>)}</fieldset>
      <p>Vous pouvez modifier vos réponses jusqu’à la clôture définitive.</p>
      <div className="aac-actions">
      <button className="aac-secondary" disabled={blocked || index === 0} onClick={() => setIndex(index - 1)}>← Question précédente</button>
      <button disabled={blocked || index === 11} onClick={() => setIndex(index + 1)}>Question suivante →</button>
      <button className="aac-secondary" disabled={blocked} onClick={() => move('home')}>Revenir à l’accueil</button>
      <button disabled={!canFinishAttempt(attempt, questions, blocked)} onClick={() => move('confirm')}>Terminer ma tentative</button>
      </div>
    </>}
    {state && screen === 'confirm' && attempt && <div className="aac-card">
      <h3>Valider définitivement votre tentative ?</h3>
      <p>Les douze réponses sont enregistrées. Après confirmation, elles seront verrouillées et les corrections seront disponibles.</p>
      <div className="aac-actions">
      <button disabled={!canFinishAttempt(attempt, questions, blocked)} onClick={() => mutate('finish', { attempt_id: attempt.id, expected_revision: attempt.revision, confirmed: true }, 'result')}>Confirmer la clôture définitive</button>
      <button className="aac-secondary" disabled={blocked} onClick={() => move('question')}>Revenir aux questions</button>
      </div>
      </div>}
    {state && ['result', 'corrections'].includes(screen) && selected && <>
      <div className="aac-result">
        <p>Tentative {selected.number} · terminée le {challengeDate(selected.finished_at)}</p>
        <div className="aac-result-row">
          <div
            className="aac-donut"
            style={{ '--aac-result-percent': `${Math.max(0, Math.min(100, Number(selected.percentage)))}%` }}
            aria-hidden="true"
          >
            <span>{Number(selected.percentage).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</span>
          </div>
          <div>
            <h3>{selected.score}/12 — {challengeStatus(selected.status)}</h3>
            <p>{Number(selected.percentage).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % · Seuil de réussite : 9/12</p>
          </div>
        </div>
      </div>
      <h3>Détail par thématique</h3>
      <div className="aac-grid">{challengeThemes(selected, questions).map((item) => <div className="aac-card" key={item.theme}>
      <strong>{item.theme}</strong>
      <p>{item.correct}/{item.total} réponses correctes</p>
      </div>)}</div>
      <div className="aac-actions">
      <button onClick={() => move(screen === 'result' ? 'corrections' : 'result')}>{screen === 'result' ? 'Voir toutes les corrections' : 'Revenir au résultat'}</button>
      <button className="aac-secondary" onClick={() => move('summary')}>Voir mon bilan final</button>{state.can_start && !attempt && <button onClick={() => move('second')}>Commencer la tentative 2</button>}{attempt && <button onClick={() => move('resume')}>Reprendre la tentative {attempt.number}</button>}</div>
      {screen === 'corrections' && <AiActChallengeCorrections attempt={selected} questions={questions} />}
    </>}
    {state && screen === 'summary' && <>
      <h3>Votre bilan final</h3>
      <p>Statut global : <strong>{challengeStatus(state.status)}</strong>
      </p>
      <p>Meilleur score terminé : <strong>{state.best_score ?? '—'}/12</strong> · Dernier score terminé : <strong>{state.last_score ?? '—'}/12</strong>
      </p>
      <div className="aac-grid">{state.attempts.map((item) => <article className="aac-card" key={item.id}>
      <h4>Tentative {item.number} — {challengeStatus(item.status)}</h4>{item.status === 'in_progress' ? <>
      <p>{item.answered_count}/12 réponses enregistrées</p>
      <button onClick={() => move('resume')}>Reprendre</button>
      </> : <>
      <p>{item.score}/12 · {Number(item.percentage).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</p>
      <p>Fin : {challengeDate(item.finished_at)}</p>
      <button onClick={() => { setSelectedId(item.id); move('corrections'); }}>Consulter le corrigé</button>
      </>}</article>)}</div>{finished.length === 2 && <p>Évolution du dernier score : {finished[1].score - finished[0].score > 0 ? '+' : ''}{finished[1].score - finished[0].score} point(s). Le meilleur résultat reste retenu.</p>}<div className="aac-actions">
      <button className="aac-secondary" onClick={() => move('home')}>Revenir à l’accueil</button>{state.can_start && !attempt && <button onClick={() => move('second')}>Commencer la tentative 2</button>}</div>
      </>}
    {state && courseId === CHALLENGE_COURSE_ID && <AiActChallengeTrainingEnd api={trainingApi} />}
    {state && <AiActChallengePrivacyNotice />}
  </section>;
}
