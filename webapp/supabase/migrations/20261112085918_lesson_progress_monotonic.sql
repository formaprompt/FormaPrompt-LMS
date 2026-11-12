-- Une consultation tardive, y compris depuis un ancien lecteur, ne doit pas
-- effacer une progression déjà enregistrée dans le parcours Prompt.
CREATE FUNCTION private.preserve_prompt_lesson_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.last_viewed_at := greatest(OLD.last_viewed_at, NEW.last_viewed_at);

  IF OLD.status = 'completed' THEN
    NEW.status := OLD.status;
    NEW.progress_percent := OLD.progress_percent;
    NEW.completed_at := OLD.completed_at;
  ELSIF NEW.status = 'in_progress' THEN
    NEW.progress_percent := greatest(OLD.progress_percent, NEW.progress_percent);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.preserve_prompt_lesson_progress()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER preserve_prompt_lesson_progress
BEFORE UPDATE ON public.course_lesson_progress
FOR EACH ROW
WHEN (
  OLD.course_id = 'introduction-prompt-engineering'
  AND NEW.course_id = OLD.course_id
  AND NEW.user_id = OLD.user_id
  AND NEW.lesson_id = OLD.lesson_id
)
EXECUTE FUNCTION private.preserve_prompt_lesson_progress();
