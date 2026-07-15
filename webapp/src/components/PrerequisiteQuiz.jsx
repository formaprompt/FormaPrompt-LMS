import { useMemo, useState } from 'react';
import { CheckCircle, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function PrerequisiteQuiz({
  courseId,
  courseTitle,
  questions,
  userId,
  learnerEmail,
  positioningLevels,
  onComplete,
}) {
  const [learnerName, setLearnerName] = useState('');
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const maximumScore = useMemo(
    () => questions.reduce((total, question) => total + Math.max(...question.answers.map((answer) => answer.score)), 0),
    [questions],
  );

  const selectAnswer = (questionId, answerIndex) => {
    setAnswers((current) => ({ ...current, [questionId]: answerIndex }));
    setError('');
  };

  const submitQuiz = async (event) => {
    event.preventDefault();

    const normalizedLearnerName = learnerName.trim().replace(/\s+/g, ' ');

    if (normalizedLearnerName.length < 2) {
      setError('Indiquez votre nom et votre prénom pour identifier le positionnement.');
      return;
    }

    if (Object.keys(answers).length !== questions.length) {
      setError('Répondez à toutes les questions pour afficher votre positionnement.');
      return;
    }

    const recordedAnswers = questions.map((question) => {
      const selectedAnswer = question.answers[answers[question.id]];
      return {
        question_id: question.id,
        question: question.question,
        answer: selectedAnswer.label,
        score: selectedAnswer.score,
      };
    });
    const score = recordedAnswers.reduce((total, answer) => total + answer.score, 0);

    const ratio = maximumScore === 0 ? 0 : score / maximumScore;
    const level = positioningLevels
      ? positioningLevels.find((item) => ratio <= item.maximumRatio)?.label
        || positioningLevels[positioningLevels.length - 1].label
      : ratio < 0.4
        ? 'Fondations à construire'
        : ratio < 0.75
          ? 'Pratiques à structurer'
          : 'Base déjà bien établie';

    setSubmitting(true);
    setError('');

    const { data, error: saveError } = await supabase
      .from('course_positioning_assessments')
      .insert({
        user_id: userId,
        learner_name: normalizedLearnerName,
        course_id: courseId,
        course_title: courseTitle,
        answers: recordedAnswers,
        score,
        maximum_score: maximumScore,
        level,
        is_initial: true,
      })
      .select('id, submitted_at')
      .single();

    if (saveError) {
      console.error("Erreur lors de l'enregistrement du positionnement :", saveError);
      if (saveError.code === '23505') {
        onComplete();
      } else {
        setError(
          "Le positionnement n'a pas pu être enregistré. Vos réponses sont conservées à l'écran : réessayez dans quelques instants ou contactez FormaPrompt.",
        );
      }
    } else {
      setResult({ score, maximumScore, level, assessmentId: data.id, submittedAt: data.submitted_at });
    }

    setSubmitting(false);
  };

  if (result) {
    return (
      <section className="quiz-result" aria-live="polite">
        <CheckCircle size={42} aria-hidden="true" />
        <h2>Positionnement terminé</h2>
        <p className="quiz-result-level">{result.level}</p>
        <p>
          Résultat indicatif : {result.score}/{result.maximumScore}. Ce diagnostic ne constitue ni une note,
          ni une validation de conformité. Il sert à adapter votre attention pendant le parcours.
        </p>
        <p className="quiz-proof-reference">
          Positionnement nominatif enregistré le {new Date(result.submittedAt).toLocaleString('fr-FR')}
          {' '}– Référence {result.assessmentId.slice(0, 8).toUpperCase()}.
        </p>
        <button type="button" className="btn btn-primary" onClick={onComplete}>
          Commencer la formation
        </button>
      </section>
    );
  }

  return (
    <section className="prerequisite-quiz" aria-labelledby="quiz-title">
      <div className="quiz-intro">
        <ClipboardCheck size={40} aria-hidden="true" />
        <div>
          <p className="quiz-kicker">Étape préalable obligatoire</p>
          <h1 id="quiz-title">Quiz de positionnement</h1>
          <p>
            Avant de commencer « {courseTitle} », répondez à ces {questions.length} questions.
            Il n'y a pas de bonne ou de mauvaise note.
          </p>
        </div>
      </div>

      <form onSubmit={submitQuiz}>
        <div className="quiz-identity">
          <label htmlFor="learner-name">Nom et prénom de l'apprenant</label>
          <input
            id="learner-name"
            type="text"
            value={learnerName}
            onChange={(event) => {
              setLearnerName(event.target.value);
              setError('');
            }}
            minLength={2}
            maxLength={150}
            autoComplete="name"
            required
          />
          <p>Le positionnement sera associé au compte {learnerEmail}.</p>
        </div>

        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className="quiz-question">
            <legend>{questionIndex + 1}. {question.question}</legend>
            <div className="quiz-answers">
              {question.answers.map((answer, answerIndex) => (
                <label key={answer.label} className="quiz-answer">
                  <input
                    type="radio"
                    name={question.id}
                    value={answerIndex}
                    checked={answers[question.id] === answerIndex}
                    onChange={() => selectAnswer(question.id, answerIndex)}
                  />
                  <span>{answer.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {error && <p className="quiz-error" role="alert">{error}</p>}

        <p className="quiz-privacy">
          Pour assurer le suivi pédagogique et constituer la preuve du positionnement préalable, FormaPrompt
          enregistre votre nom, vos réponses, votre score, la formation concernée et la date de réalisation.
          Ces informations sont accessibles uniquement à l'apprenant et aux personnes autorisées dans
          l'administration. <a href="/mentions-legales">En savoir plus sur vos données personnelles</a>.
        </p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer mon positionnement'}
        </button>
      </form>
    </section>
  );
}
