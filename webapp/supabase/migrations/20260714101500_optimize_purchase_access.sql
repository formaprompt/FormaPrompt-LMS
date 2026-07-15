-- Regroupe les deux règles de lecture afin d'éviter leur double évaluation.
-- Un apprenant lit uniquement ses achats ; un administrateur ou employé lit tous les achats.
DROP POLICY IF EXISTS "Les apprenants lisent leurs propres achats" ON public.purchases;
DROP POLICY IF EXISTS "Les administrateurs consultent les achats" ON public.purchases;

CREATE POLICY "Lecture des achats selon le rôle"
ON public.purchases FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
);

-- Les contraintes avaient été ajoutées sans bloquer les données historiques.
-- Elles sont maintenant validées après le contrôle de la table existante.
ALTER TABLE public.purchases
  VALIDATE CONSTRAINT purchases_course_id_length_check;

ALTER TABLE public.purchases
  VALIDATE CONSTRAINT purchases_amount_total_check;

ALTER TABLE public.purchases
  VALIDATE CONSTRAINT purchases_currency_check;

ALTER TABLE public.purchases
  VALIDATE CONSTRAINT purchases_customer_phone_length_check;
