async function invokePaidCourseContent(supabase, body) {
  const { data, error } = await supabase.functions.invoke('paid-course-content', { body });
  if (error) {
    let message = 'Le contenu pédagogique ne peut pas être chargé pour le moment.';
    try {
      const response = await error.context?.json?.();
      if (typeof response?.error === 'string') message = response.error;
    } catch {
      // La réponse technique n'est volontairement pas exposée.
    }
    const safeError = new Error(message);
    safeError.status = error.context?.status;
    throw safeError;
  }
  return data;
}

export async function fetchPaidCourseContent(supabase, courseId) {
  const result = await invokePaidCourseContent(supabase, { action: 'course', courseId });
  if (!result?.course) throw new Error('Le contenu pédagogique est indisponible.');
  return result.course;
}

export async function fetchTrainerGuideUrl(supabase, courseId) {
  const result = await invokePaidCourseContent(supabase, { action: 'trainer_guide', courseId });
  if (!result?.signedUrl) throw new Error('Le guide formateur est indisponible.');
  return result.signedUrl;
}
