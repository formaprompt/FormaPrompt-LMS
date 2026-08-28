-- Correctif juridique pre-production du Diagnostic IA Express.
-- Migration additive : nouvelles versions figees, preuves de consentement et
-- extension du formulaire de retractation. Aucune reservation n'est creee.

BEGIN;

ALTER TABLE public.legal_document_versions
  DROP CONSTRAINT legal_document_versions_type_check,
  ADD CONSTRAINT legal_document_versions_type_check CHECK (document_type IN (
    'cgv_b2c',
    'cgv_b2b',
    'privacy_policy',
    'internal_rules',
    'precontractual_information',
    'early_service_start_statement',
    'digital_content_start_statement',
    'digital_content_withdrawal_acknowledgement',
    'diagnostic_cgv_acceptance_statement',
    'diagnostic_early_service_start_statement',
    'diagnostic_full_performance_withdrawal_acknowledgement',
    'withdrawal_form'
  ));

WITH source AS (
  SELECT document_type, content_text
  FROM public.legal_document_versions
  WHERE version IN ('CGV-B2C-2026-08-12', 'CGV-B2B-2026-08-12')
), documents(document_type, version, public_path, content_text) AS (
  SELECT
    'cgv_b2c',
    'CGV-B2C-2026-08-26',
    '/cgv-particuliers',
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(content_text,
                'CGV B2C — version 2026-08-12',
                'CGV B2C — version 2026-08-26'),
              'Cette formulation ne constitue pas une garantie absolue ou perpétuelle. Les séances, corrections et accompagnements limités dans le temps conservent la durée indiquée dans l’offre.',
              $txt$Cette formulation ne constitue pas une garantie absolue ou perpétuelle. Les séances, corrections et accompagnements limités dans le temps conservent la durée indiquée dans l’offre.

Diagnostic IA Express

Le Diagnostic IA Express est une prestation ponctuelle de conseil et de diagnostic, réalisée principalement en visioconférence pendant 90 minutes. Elle analyse la situation, le métier ou les activités du client, ses tâches, ses outils, ses contraintes et ses objectifs afin d’identifier des opportunités d’utilisation de l’intelligence artificielle adaptées à son contexte.

La prestation comprend notamment l’identification de trois opportunités prioritaires, une appréciation indicative de leur impact, de leur difficulté, de leur coût et de leurs risques, ainsi que la remise d’un Plan d’action IA FormaPrompt personnalisé.

Elle ne comprend pas le développement complet d’un agent, l’installation complète de n8n, la réalisation complète d’une automatisation, la formation d’une équipe, un audit informatique complet, un audit juridique ou RGPD complet, ni un développement logiciel sur mesure.$txt$),
              'Les prix sont indiqués en euros. Situation fiscale actuelle : TVA non applicable - article 293 B du CGI. Le prix total est présenté avant la commande. Les paiements directs en ligne sont traités par Stripe. FormaPrompt ne reçoit ni ne conserve le numéro complet de la carte.',
              $txt$Les prix sont indiqués en euros. Situation fiscale actuelle : TVA non applicable - article 293 B du CGI. Le prix total est présenté avant la commande. Les paiements directs en ligne sont traités par Stripe. FormaPrompt ne reçoit ni ne conserve le numéro complet de la carte.

Diagnostic IA Express

Le prix total du Diagnostic IA Express est de 149 €. Il est payé intégralement lors de la commande en ligne. La commande n’est confirmée qu’après confirmation effective du paiement par Stripe et par le système FormaPrompt.

Après confirmation du paiement, le client choisit son créneau parmi les disponibilités proposées. Le paiement ne fixe pas, à lui seul, la date du rendez-vous. La réservation d’un créneau ne vaut ni demande automatique d’exécution anticipée ni renonciation au droit légal de rétractation.$txt$),
              'La fonctionnalité électronique « Renoncer au contrat ici » permet d’identifier le contrat, d’enregistrer la déclaration avec un horodatage serveur et de télécharger immédiatement un accusé durable.',
              $txt$La fonctionnalité électronique « Renoncer au contrat ici » permet d’identifier le contrat, d’enregistrer la déclaration avec un horodatage serveur et de télécharger immédiatement un accusé durable.

Pour le Diagnostic IA Express commandé en ligne, le contrat est conclu lorsque le paiement est confirmé et que la commande est enregistrée par FormaPrompt. Les règles commerciales d’annulation et de report sont distinctes du droit légal de rétractation et s’appliquent sans préjudice de celui-ci.$txt$),
              'Le commencement anticipé d’un service exige une demande expresse. Il ne fait pas perdre à lui seul le droit de rétractation. Les conditions propres à une éventuelle composante de contenu numérique doivent être identifiées et recueillies séparément pour l’offre concernée.',
              $txt$Le commencement anticipé d’un service exige une demande expresse. Il ne fait pas perdre à lui seul le droit de rétractation. Les conditions propres à une éventuelle composante de contenu numérique doivent être identifiées et recueillies séparément pour l’offre concernée.

Commencement anticipé du Diagnostic IA Express

Lorsque le client choisit un créneau impliquant que l’exécution du Diagnostic IA Express commence avant l’expiration de son délai légal de rétractation, FormaPrompt recueille, au moment de la réservation et avant tout commencement d’exécution, sa demande expresse de commencement anticipé.

Le client reconnaît séparément qu’il perdra son droit de rétractation lorsque la prestation aura été entièrement exécutée, à condition que son exécution ait commencé avec sa demande expresse préalable. S’il ne souhaite pas demander le commencement anticipé, il peut choisir un créneau permettant à la prestation de commencer après l’expiration de son délai de rétractation. La simple réservation d’un créneau ne supprime pas automatiquement ce droit.

Le questionnaire préparatoire peut être enregistré avant le rendez-vous. Son simple enregistrement ne déclenche aucune analyse automatisée ou humaine destinée au Diagnostic IA Express. Aucune analyse individualisée ne commence avant que l’exécution de la prestation soit juridiquement autorisée.

Rétractation après commencement d’exécution

Lorsque le client exerce son droit de rétractation après avoir expressément demandé le commencement de la prestation avant la fin du délai de rétractation, mais avant son exécution complète, il verse à FormaPrompt un montant correspondant aux services effectivement fournis jusqu’à la communication de sa décision. Ce montant est proportionné au prix total convenu et à la part de la prestation effectivement réalisée.

Aucun montant correspondant à une exécution anticipée ne peut être exigé lorsque les informations ou la demande expresse prévues par la loi n’ont pas été correctement recueillies.

Exécution complète du Diagnostic IA Express

Le Diagnostic IA Express est entièrement exécuté lorsque le rendez-vous de 90 minutes a été réalisé et que le Plan d’action IA FormaPrompt personnalisé a été remis.$txt$),
              'Une annulation avant formation, une non-présentation, un abandon et une interruption sont traités séparément. Aucun barème ne prive le client d’un droit légal de rétractation ni des dispositions impératives applicables. Les conditions propres à l’offre figurent dans les conditions particulières communiquées avant l’engagement.',
              $txt$Une annulation avant formation, une non-présentation, un abandon et une interruption sont traités séparément. Aucun barème ne prive le client d’un droit légal de rétractation ni des dispositions impératives applicables. Les conditions propres à l’offre figurent dans les conditions particulières communiquées avant l’engagement.

Diagnostic IA Express

Jusqu’à 24 heures avant l’heure prévue du rendez-vous, le client peut annuler sans frais et obtenir le remboursement intégral du prix payé, ou reporter sans frais son rendez-vous vers un créneau disponible.

À moins de 24 heures de l’heure prévue du rendez-vous, le paiement reste acquis à FormaPrompt. Un report exceptionnel unique peut toutefois être accordé lorsque le client prévient FormaPrompt avant l’heure prévue du rendez-vous. Cette possibilité ne constitue pas un droit à plusieurs reports.

En cas d’absence sans information préalable avant l’heure prévue du rendez-vous, le paiement reste acquis et aucun report automatique n’est dû. FormaPrompt peut exceptionnellement proposer un nouveau rendez-vous lorsqu’une situation particulière le justifie. Cette faculté commerciale discrétionnaire ne constitue pas un droit contractuel du client.

Ces règles s’appliquent sans préjudice du droit légal de rétractation et des autres dispositions légales impératives applicables.$txt$),
              'Si FormaPrompt ne peut exécuter la prestation, il informe le client et propose un report accepté ou le remboursement des prestations non exécutées, sans préjudice des droits légaux.',
              $txt$Si FormaPrompt ne peut exécuter la prestation, il informe le client et propose un report accepté ou le remboursement des prestations non exécutées, sans préjudice des droits légaux.

Lorsqu’un remboursement est dû en application des présentes conditions ou de la loi, il est effectué, sauf accord exprès contraire du client, au moyen du mode de paiement utilisé lors de la commande. Les remboursements résultant de l’exercice valable du droit de rétractation sont réalisés dans les délais légaux.$txt$)
  FROM source WHERE document_type = 'cgv_b2c'
  UNION ALL
  SELECT
    'cgv_b2b',
    'CGV-B2B-2026-08-26',
    '/cgv-professionnels',
    replace(
      replace(
        replace(
          replace(
            replace(content_text,
              'CGV B2B — version 2026-08-12',
              'CGV B2B — version 2026-08-26'),
            'La commande est formée par l’acceptation du devis ou du bon de commande et, lorsqu’elle est requise, par la signature d’une convention de formation ou d’un contrat de sous-traitance. Les conditions particulières priment sur les présentes CGV, puis viennent la convention, les CGV et les annexes intégrées au contrat.',
            $txt$La commande est formée par l’acceptation du devis ou du bon de commande et, lorsqu’elle est requise, par la signature d’une convention de formation ou d’un contrat de sous-traitance. Les conditions particulières priment sur les présentes CGV, puis viennent la convention, les CGV et les annexes intégrées au contrat.

Diagnostic IA Express

Par exception aux dispositions relatives au devis, à la convention et au paiement différé, le Diagnostic IA Express peut être commandé directement en ligne. Cette exception ne modifie pas les modalités de commande ou de paiement applicables aux autres formations et prestations FormaPrompt.

Le Diagnostic IA Express est une prestation ponctuelle de conseil et de diagnostic, réalisée principalement en visioconférence pendant 90 minutes. Elle analyse la situation, le métier ou les activités du client, ses tâches, ses outils, ses contraintes et ses objectifs afin d’identifier des opportunités d’utilisation de l’intelligence artificielle adaptées à son contexte.

La prestation comprend notamment l’identification de trois opportunités prioritaires, une appréciation indicative de leur impact, de leur difficulté, de leur coût et de leurs risques, ainsi que la remise d’un Plan d’action IA FormaPrompt personnalisé. Elle ne comprend pas le développement complet d’un agent, l’installation complète de n8n, la réalisation complète d’une automatisation, la formation d’une équipe, un audit informatique complet, un audit juridique ou RGPD complet, ni un développement logiciel sur mesure.$txt$),
            'Lorsqu’un financement est envisagé, le prix total, le montant financé, le reste à charge et le débiteur réel doivent être identifiés. La subrogation ou le paiement direct n’est appliqué que s’il est expressément accepté.',
            $txt$Lorsqu’un financement est envisagé, le prix total, le montant financé, le reste à charge et le débiteur réel doivent être identifiés. La subrogation ou le paiement direct n’est appliqué que s’il est expressément accepté.

Diagnostic IA Express

Le prix total du Diagnostic IA Express est de 149 €. Situation fiscale actuelle : TVA non applicable - article 293 B du CGI. Le paiement est intégralement exigible lors de la commande en ligne. La commande est confirmée après confirmation effective du paiement par Stripe et par le système FormaPrompt.

Après confirmation du paiement, le client choisit son créneau parmi les disponibilités proposées.$txt$),
            'Toute annulation est transmise par écrit. Son traitement dépend des conditions particulières, des prestations exécutées et, le cas échéant, des règles du financeur. Aucun montant de 100 % n’est automatiquement exigible dans toutes les situations.',
            $txt$Toute annulation est transmise par écrit. Son traitement dépend des conditions particulières, des prestations exécutées et, le cas échéant, des règles du financeur. Aucun montant de 100 % n’est automatiquement exigible dans toutes les situations.

Diagnostic IA Express

Jusqu’à 24 heures avant l’heure prévue du rendez-vous, le client peut annuler sans frais et obtenir le remboursement intégral du prix payé, ou reporter sans frais son rendez-vous vers un créneau disponible.

À moins de 24 heures de l’heure prévue du rendez-vous, le paiement reste acquis à FormaPrompt. Un report exceptionnel unique peut être accordé si le client prévient FormaPrompt avant l’heure prévue du rendez-vous. Cette possibilité ne constitue pas un droit à plusieurs reports.

En cas d’absence sans information préalable avant l’heure prévue du rendez-vous, le paiement reste acquis et aucun report automatique n’est dû. FormaPrompt conserve la faculté d’accorder exceptionnellement un nouveau rendez-vous lorsqu’une situation particulière le justifie. Cette faculté commerciale discrétionnaire ne constitue pas un droit contractuel du client.

Ces règles s’appliquent sous réserve des dispositions légales impératives éventuellement applicables.$txt$),
            'FormaPrompt exécute les prestations convenues avec diligence. Les objectifs pédagogiques ne constituent pas une garantie de résultat professionnel, commercial ou financier. Les parties recherchent une solution amiable avant toute action. Le droit français s’applique et les règles légales déterminent la juridiction compétente sauf clause particulière valablement convenue.',
            $txt$FormaPrompt exécute les prestations convenues avec diligence. Les objectifs pédagogiques ne constituent pas une garantie de résultat professionnel, commercial ou financier. Les parties recherchent une solution amiable avant toute action. Le droit français s’applique et les règles légales déterminent la juridiction compétente sauf clause particulière valablement convenue.

Les éventuelles dispositions impératives du Code de la consommation rendues applicables à certains contrats conclus entre professionnels demeurent réservées.$txt$)
  FROM source WHERE document_type = 'cgv_b2b'
), all_documents(document_type, version, public_path, content_text) AS (
  SELECT * FROM documents
  UNION ALL VALUES
    (
      'diagnostic_cgv_acceptance_statement',
      'DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26',
      NULL,
      'J’accepte les Conditions générales de vente applicables au Diagnostic IA Express et je reconnais que ma commande m’oblige au paiement de 149 €.'
    ),
    (
      'diagnostic_early_service_start_statement',
      'DIAGNOSTIC-EARLY-START-2026-08-26',
      NULL,
      'Je demande expressément que l’exécution de mon Diagnostic IA Express commence avant la fin de mon délai légal de rétractation.'
    ),
    (
      'diagnostic_full_performance_withdrawal_acknowledgement',
      'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26',
      NULL,
      'Je reconnais qu’après l’exécution complète de la prestation, je ne pourrai plus exercer mon droit de rétractation pour cette prestation.'
    ),
    (
      'withdrawal_form',
      'WITHDRAWAL-FORM-2026-08-26',
      '/retractation',
      $form$FORMULAIRE TYPE DE RÉTRACTATION

À l’attention de Thierry FREZARD EI — FormaPrompt, 6 rue Webster, 62100 Calais, France — thierry@formaprompt.com :

Je vous notifie par la présente ma rétractation du contrat portant sur la prestation suivante :

Commandée le :
Nom du consommateur :
Adresse du consommateur :
Signature du consommateur, uniquement en cas de notification sur papier :
Date :$form$
    )
)
INSERT INTO public.legal_document_versions (
  document_type, version, status, public_path, content_text, content_sha256, effective_at
)
SELECT
  document_type,
  version,
  'draft',
  public_path,
  content_text,
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(content_text, 'UTF8'), 'sha256'), 'hex'),
  NULL
FROM all_documents;

UPDATE public.legal_document_versions
SET status = 'retired', retired_at = timestamptz '2026-08-26 19:30:00+02'
WHERE version IN ('CGV-B2C-2026-08-12', 'CGV-B2B-2026-08-12');

UPDATE public.legal_document_versions
SET status = 'published', effective_at = timestamptz '2026-08-26 19:30:00+02'
WHERE version IN (
  'CGV-B2C-2026-08-26',
  'CGV-B2B-2026-08-26',
  'DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26',
  'DIAGNOSTIC-EARLY-START-2026-08-26',
  'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26',
  'WITHDRAWAL-FORM-2026-08-26'
);

ALTER TABLE public.diagnostic_ia_orders
  ADD COLUMN cgv_acceptance_statement_version_id uuid
    REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  ADD COLUMN contract_confirmation_delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN contract_confirmation_delivery_attempted_at timestamptz,
  ADD COLUMN contract_confirmation_delivered_at timestamptz,
  ADD COLUMN contract_confirmation_delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN contract_confirmation_delivery_error_code text,
  ADD CONSTRAINT diagnostic_ia_orders_contract_delivery_check CHECK (
    contract_confirmation_delivery_status IN ('pending', 'sending', 'sent', 'failed')
    AND contract_confirmation_delivery_attempts >= 0
    AND (contract_confirmation_delivery_status <> 'sent' OR contract_confirmation_delivered_at IS NOT NULL)
    AND (contract_confirmation_delivery_error_code IS NULL
      OR char_length(contract_confirmation_delivery_error_code) BETWEEN 2 AND 100)
  );

UPDATE public.diagnostic_ia_orders
SET cgv_acceptance_statement_version_id = (
  SELECT id FROM public.legal_document_versions
  WHERE version = 'DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'
);

ALTER TABLE public.diagnostic_ia_orders
  ALTER COLUMN cgv_acceptance_statement_version_id SET NOT NULL;

CREATE TABLE public.diagnostic_ia_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.diagnostic_ia_orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consent_type text NOT NULL,
  legal_document_version_id uuid NOT NULL
    REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  granted boolean NOT NULL,
  source text NOT NULL,
  consent_context_id uuid,
  appointment_starts_at timestamptz,
  withdrawal_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_ia_consents_type_check CHECK (consent_type IN (
    'cgv_acceptance',
    'early_service_start',
    'full_performance_withdrawal_acknowledgement'
  )),
  CONSTRAINT diagnostic_ia_consents_granted_check CHECK (granted),
  CONSTRAINT diagnostic_ia_consents_source_check CHECK (source IN ('web_checkout', 'web_booking')),
  CONSTRAINT diagnostic_ia_consents_context_check CHECK (
    (consent_type = 'cgv_acceptance'
      AND source = 'web_checkout'
      AND consent_context_id IS NULL
      AND appointment_starts_at IS NULL
      AND withdrawal_period_ends_at IS NULL)
    OR
    (consent_type IN ('early_service_start', 'full_performance_withdrawal_acknowledgement')
      AND source = 'web_booking'
      AND consent_context_id IS NOT NULL
      AND appointment_starts_at IS NOT NULL
      AND withdrawal_period_ends_at IS NOT NULL
      AND appointment_starts_at < withdrawal_period_ends_at)
  )
);

CREATE UNIQUE INDEX diagnostic_ia_consents_cgv_order_uidx
  ON public.diagnostic_ia_consents(order_id)
  WHERE consent_type = 'cgv_acceptance';
CREATE UNIQUE INDEX diagnostic_ia_consents_booking_type_uidx
  ON public.diagnostic_ia_consents(order_id, consent_context_id, consent_type)
  WHERE consent_context_id IS NOT NULL;
CREATE INDEX diagnostic_ia_consents_user_created_idx
  ON public.diagnostic_ia_consents(user_id, created_at DESC);

CREATE FUNCTION private.validate_diagnostic_ia_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order_user_id uuid;
  v_sales_context text;
  v_document_type text;
  v_document_status text;
BEGIN
  SELECT user_id, sales_context INTO v_order_user_id, v_sales_context
  FROM public.diagnostic_ia_orders WHERE id = NEW.order_id;
  SELECT document_type, status INTO v_document_type, v_document_status
  FROM public.legal_document_versions WHERE id = NEW.legal_document_version_id;

  IF v_order_user_id IS DISTINCT FROM NEW.user_id OR v_document_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Preuve de consentement Diagnostic IA incoherente.' USING ERRCODE = '23514';
  END IF;
  IF (NEW.consent_type = 'cgv_acceptance' AND v_document_type <> 'diagnostic_cgv_acceptance_statement')
    OR (NEW.consent_type = 'early_service_start' AND v_document_type <> 'diagnostic_early_service_start_statement')
    OR (NEW.consent_type = 'full_performance_withdrawal_acknowledgement'
      AND v_document_type <> 'diagnostic_full_performance_withdrawal_acknowledgement')
  THEN
    RAISE EXCEPTION 'Version juridique incorrecte pour le consentement Diagnostic IA.' USING ERRCODE = '23514';
  END IF;
  IF NEW.consent_type <> 'cgv_acceptance' AND v_sales_context <> 'personal' THEN
    RAISE EXCEPTION 'Le consentement de retractation anticipee est reserve au parcours B2C.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_diagnostic_ia_consent() FROM PUBLIC;
CREATE TRIGGER validate_diagnostic_ia_consent
BEFORE INSERT OR UPDATE ON public.diagnostic_ia_consents
FOR EACH ROW EXECUTE FUNCTION private.validate_diagnostic_ia_consent();

ALTER TABLE public.diagnostic_ia_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY "Lecture de ses consentements Diagnostic IA"
ON public.diagnostic_ia_consents FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Lecture administrative des consentements Diagnostic IA"
ON public.diagnostic_ia_consents FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
REVOKE ALL ON public.diagnostic_ia_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnostic_ia_consents TO authenticated;
GRANT ALL ON public.diagnostic_ia_consents TO service_role;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN diagnostic_order_id uuid
    REFERENCES public.diagnostic_ia_orders(id) ON DELETE SET NULL,
  ADD CONSTRAINT withdrawal_requests_contract_reference_check CHECK (
    (purchase_id IS NOT NULL AND diagnostic_order_id IS NULL)
    OR (purchase_id IS NULL AND diagnostic_order_id IS NOT NULL)
  );

CREATE UNIQUE INDEX withdrawal_requests_one_active_per_diagnostic_order_idx
  ON public.withdrawal_requests(diagnostic_order_id)
  WHERE diagnostic_order_id IS NOT NULL AND status IN ('received', 'under_review', 'accepted');

GRANT SELECT (diagnostic_order_id) ON public.withdrawal_requests TO authenticated;

COMMENT ON TABLE public.diagnostic_ia_consents IS
  'Preuves distinctes, horodatees par PostgreSQL, des CGV et des consentements B2C conditionnels. Aucune reservation n est creee.';
COMMENT ON COLUMN public.diagnostic_ia_consents.consent_context_id IS
  'Identifiant serveur du futur contexte de reservation ; les deux consentements anticipes restent deux preuves distinctes.';
COMMENT ON COLUMN public.diagnostic_ia_orders.contract_confirmation_delivery_status IS
  'Etat de la confirmation contractuelle transmise sur support durable apres paiement confirme.';

COMMIT;
