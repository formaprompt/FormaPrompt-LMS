-- Rétablit le filtrage croisé supprimé involontairement lors de l'ajout des
-- formations Prompt Engineering et IA générative. Une option ou réservation
-- OF bloque toute disponibilité apprenant qui recouvre la même demi-journée.

BEGIN;

DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots;

CREATE POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
  OR (
    is_active
    AND NOT is_reserved
    AND starts_at > now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_bookings AS booking
      WHERE private.calendar_booking_overlaps(
        booking.date,
        booking.slot,
        training_availability_slots.starts_at,
        training_availability_slots.ends_at
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE purchases.user_id = (SELECT auth.uid())
        AND purchases.course_id IN (
          'formation-ia',
          'formation-ia-act',
          'formation-prompt-level-1'
        )
    )
  )
);

COMMENT ON POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots IS
  'Le personnel voit tous les créneaux. Les apprenants voient uniquement les créneaux actifs, libres, futurs, liés à un achat et hors de toute option ou réservation OF.';

COMMIT;
