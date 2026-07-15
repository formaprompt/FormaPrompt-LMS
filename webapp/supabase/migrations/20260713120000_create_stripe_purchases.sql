-- Phase 1 Stripe : achats et accès aux formations.
-- Cette migration est additive afin de préserver d'éventuels achats créés manuellement.

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  amount_total integer,
  currency text,
  payment_status text,
  customer_phone text,
  purchased_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_event_id text,
  ADD COLUMN IF NOT EXISTS amount_total integer,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS purchased_at timestamp with time zone
    DEFAULT timezone('utc'::text, now()) NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND contype = 'f'
      AND conname = 'purchases_user_id_fkey'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND conname = 'purchases_course_id_length_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_course_id_length_check
      CHECK (char_length(course_id) BETWEEN 2 AND 100) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND conname = 'purchases_amount_total_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_amount_total_check
      CHECK (amount_total IS NULL OR amount_total > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND conname = 'purchases_currency_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_currency_check
      CHECK (currency IS NULL OR currency ~ '^[a-z]{3}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND conname = 'purchases_customer_phone_length_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_customer_phone_length_check
      CHECK (customer_phone IS NULL OR char_length(customer_phone) BETWEEN 6 AND 30) NOT VALID;
  END IF;
END
$$;

-- Préserve la date des accès historiques créés avant l'ajout de purchased_at.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'created_at'
  ) THEN
    UPDATE public.purchases
    SET purchased_at = created_at
    WHERE created_at IS NOT NULL
      AND stripe_checkout_session_id IS NULL
      AND stripe_event_id IS NULL;
  END IF;
END
$$;

-- Une formation ne doit être débloquée qu'une fois par apprenant.
-- Si cet index échoue, rechercher d'abord les doublons historiques sans les supprimer automatiquement.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_course_uidx
  ON public.purchases (user_id, course_id);

CREATE UNIQUE INDEX IF NOT EXISTS purchases_checkout_session_uidx
  ON public.purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_event_uidx
  ON public.purchases (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les apprenants lisent leurs propres achats" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Les apprenants lisent leurs propres achats"
ON public.purchases FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les administrateurs consultent les achats" ON public.purchases;
CREATE POLICY "Les administrateurs consultent les achats"
ON public.purchases FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'employee')
  )
);

-- Le navigateur peut uniquement lire les colonnes nécessaires au LMS.
-- Les écritures et les données Stripe restent réservées au webhook avec la clé serveur Supabase.
REVOKE ALL ON public.purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, course_id, amount_total, currency, payment_status, customer_phone, purchased_at)
  ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

COMMENT ON TABLE public.purchases IS
  'Achats de formations. Les écritures Stripe sont réalisées exclusivement par un webhook signé. Définir une durée de conservation RGPD pour les données de facturation.';

COMMENT ON COLUMN public.purchases.customer_phone IS
  'Téléphone fourni au paiement pour permettre au formateur de personnaliser le suivi pédagogique. Ne pas utiliser à des fins commerciales sans consentement distinct.';
