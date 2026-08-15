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

async function activateIonVideoGrant(grant) {
  if (!grant || typeof grant !== 'object') return null;
  const endpoint = new URL(grant.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'formaprompt.com') {
    throw new Error('La vidéo pédagogique est indisponible.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course: grant.courseId,
      exp: grant.expiresAt,
      sig: grant.signature,
    }),
  });
  if (!response.ok) throw new Error('La vidéo pédagogique est indisponible.');
  return endpoint.toString();
}

export async function fetchPaidCourseContent(supabase, courseId) {
  const result = await invokePaidCourseContent(supabase, { action: 'course', courseId });
  if (!result?.course) throw new Error('Le contenu pédagogique est indisponible.');
  const videoUrl = await activateIonVideoGrant(result.course.videoGrant);
  const course = { ...result.course };
  delete course.videoGrant;
  return videoUrl ? { ...course, videoUrl } : course;
}

export async function fetchTrainerGuideUrl(supabase, courseId) {
  const result = await invokePaidCourseContent(supabase, { action: 'trainer_guide', courseId });
  if (!result?.signedUrl) throw new Error('Le guide formateur est indisponible.');
  return result.signedUrl;
}
