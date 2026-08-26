# Diagnostic IA Express — LOT 1B paiement Stripe

**Statut : CODE READY — intégration Stripe réelle à valider avant production.**

**Production bloquée jusqu'à validation finale du risque juridique résiduel, création du produit/prix Stripe LIVE et déploiement contrôlé.**

## Périmètre

Le paiement du Diagnostic IA Express est distinct des formations :

- montant serveur fixe : 14 900 centimes EUR ;
- paiement ponctuel via Stripe Checkout ;
- authentification FormaPrompt obligatoire ;
- statut `paid` attribué uniquement par un webhook Stripe signé ;
- aucune écriture dans `purchases` ou `course_access` ;
- aucune réservation implémentée dans ce lot.

Le checkout Diagnostic est volontairement limité à une clé Stripe test. Une clé live provoque une réponse `503` tant que la validation juridique et l'autorisation de production ne sont pas acquises. La levée de ce garde-fou nécessitera une modification de code distincte, relue et autorisée avant production.

## Composants

- `create-diagnostic-checkout` authentifie le JWT, valide le contexte contractuel, contrôle le Price Stripe côté serveur, crée ou réutilise une commande en attente et crée une Checkout Session idempotente.
- `stripe-webhook-ai-act` conserve la vérification du corps brut et de la signature. Les événements Checkout Diagnostic sont dirigés vers `process_diagnostic_ia_stripe_event`; les remboursements et litiges restent traités par le processeur financier central existant.
- `diagnostic_ia_orders` conserve la commande métier et son état financier. La RLS autorise uniquement la lecture du propriétaire ou d'un administrateur strict ; les mutations passent par le serveur.
- `stripe_payment_transactions.diagnostic_order_id` relie la preuve financière centrale à la commande sans référence LMS.
- `/diagnostic-ia/confirmation` lit la commande sous RLS. Le paramètre de retour Stripe n'est jamais une preuve de paiement.
- `diagnostic_ia_consents` conserve la preuve versionnée des CGV. Les deux futurs consentements B2C d'exécution anticipée sont modélisés comme deux preuves distinctes, sans créer de réservation.
- après un paiement Diagnostic confirmé, le webhook tente d'envoyer via le SMTP IONOS existant une confirmation contractuelle durable contenant les CGV acceptées et, pour le B2C, le formulaire type de rétractation ; un échec est tracé sans remettre le paiement en cause.
- `/retractation` reconnaît également les commandes Diagnostic B2C payées, sans déclencher automatiquement de remboursement.

## Variables serveur

- `STRIPE_DIAGNOSTIC_IA_PRICE_ID`
- `STRIPE_SECRET_KEY` — clé test dans l'environnement de validation du Diagnostic
- `STRIPE_WEBHOOK_SIGNING_SECRET` — secret du endpoint webhook test correspondant
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`

Aucune de ces valeurs ne doit être placée dans le bundle Vite, les logs ou Git. Le Price ID reste côté serveur.

État au 26 août 2026 :

- `STRIPE_DIAGNOSTIC_IA_PRICE_ID` contient un Price ID Stripe TEST ;
- ce Price ID ne doit jamais être utilisé pour un checkout production ;
- avant production, un produit/prix LIVE distinct à 149 € devra être créé et seule la valeur de `STRIPE_DIAGNOSTIC_IA_PRICE_ID` devra être remplacée par son Price ID LIVE ;
- aucun autre Price ID, secret Stripe ou tunnel de formation ne doit être modifié.

## Validation et production contrôlées

FormaPrompt conserve ses deux projets Supabase Free existants. Aucun troisième projet ni passage en offre Pro n'est prévu pour ce chantier. Il est interdit de remplacer les clés Stripe live utilisées par les paiements de formations afin de simuler un environnement test.

Ces opérations ne sont pas exécutées par ce lot local :

1. faire valider professionnellement le risque résiduel de la conservation intégrale du prix en B2C lors d'une annulation tardive ou d'une non-présentation ;
2. créer dans Stripe LIVE un produit/prix distinct, ponctuel, de 149 € EUR ;
3. remplacer uniquement `STRIPE_DIAGNOSTIC_IA_PRICE_ID` par le Price ID LIVE, sans modifier les secrets ou Price IDs des formations ;
4. adapter puis relire le garde-fou test-only de `create-diagnostic-checkout` ;
5. appliquer, dans l'ordre et dans une fenêtre contrôlée, les migrations `20260826163906_add_diagnostic_ia_payments.sql` puis `20260826192602_add_diagnostic_ia_legal_consents.sql` ;
6. déployer `create-diagnostic-checkout`, `stripe-webhook-ai-act`, `submit-withdrawal-request` et `secure-password-auth` de manière coordonnée ;
7. vérifier l'abonnement du webhook aux événements Checkout, échec, expiration, remboursement et litige ;
8. réaliser une validation contrôlée du paiement, du rejeu webhook, de la confirmation contractuelle et du remboursement, avec vérification explicite de l'absence de lignes nouvelles dans `purchases` et `course_access`.

Tests non exécutables sur ce poste : `deno check` faute de Deno, et pgTAP/Supabase local faute de Docker ou Podman. Aucun contournement par une infrastructure payante ou un troisième projet n'est recherché.

Le diff juridique et les limites restantes sont documentés dans `docs/legal/diagnostic-ia-cgv-correctif-2026-08-26.md`.
