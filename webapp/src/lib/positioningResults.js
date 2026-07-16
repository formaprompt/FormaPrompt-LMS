export function calculatePositioningDomainResults(questions = [], recordedAnswers = [], domains = []) {
  const answersByQuestionId = new Map(
    recordedAnswers.map((answer) => [answer.question_id, answer]),
  );

  return domains.flatMap((domain) => {
    const domainQuestions = questions.filter((question) => question.domain === domain.id);
    const maximumScore = domainQuestions.reduce(
      (total, question) => total + Math.max(...question.answers.map((answer) => answer.score)),
      0,
    );

    if (maximumScore === 0) return [];

    const score = domainQuestions.reduce(
      (total, question) => total + (answersByQuestionId.get(question.id)?.score || 0),
      0,
    );
    const ratio = score / maximumScore;
    const guidance = domain.guidance?.find((item) => ratio <= item.maximumRatio)
      || domain.guidance?.[domain.guidance.length - 1]
      || {};

    return [{
      id: domain.id,
      label: domain.label,
      score,
      maximumScore,
      percentage: Math.round(ratio * 100),
      level: guidance.label || 'Résultat disponible',
      advice: guidance.advice || '',
    }];
  });
}
