# LOT 1G — Release Promotions Express A/C/D

## Objet

Cette branche reconstruit depuis `main` le périmètre minimal nécessaire pour administrer des promotions FormaPrompt et les appliquer aux trois formations vendues en ligne.

Périmètre inclus :

- 1G-A : moteur promotionnel transversal ;
- 1G-D : administration des promotions via `/admin/promotions` ;
- 1G-C : validation, réservation, consommation et libération pour les checkouts formations.

L’intégration promotionnelle Diagnostic 1G-B est explicitement exclue. La cible PostgreSQL générique `diagnostic` est conservée pour compatibilité future, mais elle est masquée dans l’interface d’administration de cette release et aucun checkout Diagnostic n’est raccordé.

## Fonctionnalités

- remises en pourcentage ou en montant fixe, calculées en cents côté serveur ;
- dates d’effet, activation/désactivation, quotas globaux et par utilisateur ;
- restriction facultative par adresse e-mail normalisée ;
- cibles globales, formations et identifiants produit stables ;
- aperçu du prix, de la remise et du total dans le checkout formations ;
- configuration de checkout immuable après verrouillage ;
- réservation promotionnelle de 35 minutes et Checkout Stripe de 31 minutes ;
- consommation uniquement après paiement validé par le webhook ;
- libération idempotente sur les événements terminaux prévus.

Le pipeline historique `process_stripe_post_payment_event` reste responsable de `purchases` et de la politique `course_access`. Le moteur promotionnel ne crée ni ne modifie directement un droit LMS.

## Migrations

Ordre de la Phase Express :

1. `20260831110000_add_promotion_engine.sql` ;
2. `20260831150000_add_promotion_administration.sql` ;
3. `20260831170000_integrate_course_promotions.sql`.

L’historique complet de `main` doit être appliqué avant ces migrations sur une base éphémère neuve. La migration Diagnostic `20260831130000_integrate_diagnostic_promotions.sql` n’appartient pas à cette release.

## Composants applicatifs

- RPC PostgreSQL du moteur, de l’administration et du checkout formations ;
- Edge Function `validate-course-promotion` ;
- Edge Functions existantes `create-checkout` et `stripe-webhook-ai-act`, adaptées uniquement pour les formations ;
- interface `/admin/promotions` ;
- composant `CommercialCheckout`.

Sans code promotionnel, le Price Stripe catalogue et le parcours historique restent utilisés. Avec un code, le montant final est recalculé et figé côté serveur ; aucun Coupon, Promotion Code ou Price Stripe LIVE n’est créé ou modifié.

## Validation PostgreSQL attendue

Le workflow manuel `promotion-postgres-validation.yml` cible uniquement :

- `promotion_engine.sql` : 82 assertions ;
- `course_promotion_integration.sql` : 56 assertions ;
- `promotion_administration.sql` : 56 assertions.

Total Phase Express attendu : **194 assertions pgTAP**.

Le workflow doit également valider :

- RLS, FORCE RLS, ACL, propriétaires, helpers privés et `SECURITY DEFINER` via `supabase/validation/promotion_runtime_security.sql`, hors de l’arborescence pgTAP ;
- concurrence réelle A/B/C/E avec deux connexions PostgreSQL et observation des attentes de verrou ;
- absence de création de `purchase` ou `course_access` avant paiement confirmé.

Les 237 assertions et les cinq scénarios ont réussi sur la branche source complète. Ce résultat ne vaut pas validation de la reconstruction depuis `main` : un nouveau run GitHub Actions réussi sur cette branche est obligatoire avant merge ou déploiement.

## Contrôles applicatifs avant merge

- tests Node des helpers promotionnels et du checkout ;
- tests React de l’administration, de la navigation et du checkout formations ;
- TypeScript, ESLint, build Vite et pré-rendu ;
- parsing SQL avec pglast ;
- `git diff --check` et scans secrets ;
- vérification ciblée de l’absence de mutation promotionnelle directe dans `purchases` et `course_access`.

## Limites et déploiement

- aucune promotion Diagnostic n’est utilisable dans cette release ;
- aucune ressource Stripe LIVE n’est créée ou modifiée ;
- aucune migration Supabase distante, Edge Function, ressource Stripe ou publication SFTP n’a été déployée ;
- toute opération de production nécessite une autorisation séparée et des contrôles post-déploiement.
