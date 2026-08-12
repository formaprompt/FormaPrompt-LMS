-- Un positionnement est une écriture pédagogique. Il exige le droit actif de
-- la même formation ; purchases ne constitue jamais une autorisation.
DROP POLICY IF EXISTS "Les apprenants créent leur positionnement"
ON public.course_positioning_assessments;

DROP POLICY IF EXISTS "Les apprenants créent leur positionnement initial"
ON public.course_positioning_assessments;

CREATE POLICY "Les apprenants créent leur positionnement initial"
ON public.course_positioning_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_initial IS TRUE
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = course_positioning_assessments.course_id
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
);

COMMENT ON POLICY "Les apprenants créent leur positionnement initial"
ON public.course_positioning_assessments IS
  'Insertion réservée au compte concerné disposant d un course_access actif et non expiré pour la formation.';
