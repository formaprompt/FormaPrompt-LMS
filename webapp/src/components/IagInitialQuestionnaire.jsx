import { useRef, useState } from 'react';
import { IAG_QUESTIONS, normalizeIagAnswers } from '../../supabase/functions/_shared/iagPositioning.js';
import { saveIagPositioning, submitIagPositioning } from '../lib/iagPositioningApi.js';

export default function IagInitialQuestionnaire({ supabase, initial, onComplete, onReload }) {
  const [answers, setAnswers] = useState(() => normalizeIagAnswers(initial.answers || []));
  const [revision, setRevision] = useState(initial.revision || 0);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const firstMissing = useRef(null);
  async function persist(complete) {
    if (lock.current) return;
    let normalized;
    try { normalized = normalizeIagAnswers(answers, complete); }
    catch (error) {
      setMessage(error.message); setFailure(true);
      const missing = answers.findIndex(({ text }) => !text.trim());
      if (missing >= 0) firstMissing.current?.querySelectorAll('textarea')[missing]?.focus();
      return;
    }
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await (complete ? submitIagPositioning : saveIagPositioning)(supabase, normalized, revision);
      setRevision(result.revision); setFailure(false);
      setMessage(result.completed ? 'Votre questionnaire est enregistré. Vous pouvez poursuivre ce cours.' : 'Brouillon enregistré dans votre espace. Vous pourrez reprendre ici.');
      if (result.completed) await onComplete();
    } catch (error) { setFailure(true); setMessage(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="container section" aria-labelledby="iag-start-title">
    <h1 id="iag-start-title">Avant de commencer : votre point de départ</h1>
    <p>Prenez environ 15 minutes. Ce questionnaire n'est pas noté ; il aide à choisir comment commencer ce cours. Aucun niveau minimal n'est demandé.</p>
    <p>Répondez simplement. « Je ne sais pas encore » convient aussi. Évitez les données personnelles et les informations sensibles.</p>
    <p>Vous pouvez enregistrer un brouillon et revenir plus tard. Vos réponses enregistrées restent accessibles à vous et à l'équipe pédagogique de FormaPrompt.</p>
    <form ref={firstMissing} onSubmit={(event) => { event.preventDefault(); persist(true); }} noValidate>
      <fieldset disabled={busy}>
        <legend>Vos six réponses</legend>
        {IAG_QUESTIONS.map((question, index) => <div key={question.id} style={{ marginBlock: '1.5rem' }}>
          <label htmlFor={`iag-question-${question.id}`}><strong>{index + 1}. {question.title}</strong></label>
          <p id={`iag-help-${question.id}`}>{question.help}</p>
          <textarea id={`iag-question-${question.id}`} name={question.id} rows={4} maxLength={2000} required aria-describedby={`iag-help-${question.id}`} placeholder={question.placeholder}
            value={answers[index].text} onChange={(event) => setAnswers((current) => current.map((answer, number) => number === index ? { ...answer, text: event.target.value } : answer))} style={{ width: '100%', font: 'inherit' }} />
        </div>)}
        <button type="button" className="btn btn-secondary" onClick={() => persist(false)}>Enregistrer mon brouillon</button>{' '}
        <button type="submit" className="btn btn-primary">Enregistrer et poursuivre ce cours</button>
      </fieldset>
    </form>
    {busy && <p role="status">Enregistrement en cours…</p>}
    {message && <p role={failure ? 'alert' : 'status'}>{message}</p>}
    {failure && <button type="button" className="btn btn-secondary" disabled={busy} onClick={onReload}>Recharger la version enregistrée</button>}
    <p><a href="/dashboard">Revenir à mon espace apprenant</a></p>
  </section>;
}
