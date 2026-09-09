# Excel — préparation commerciale du 9 septembre 2026

## État

Backend publié et validé le 9 septembre 2026 dans FormaPrompt (`crxodkbcukhjdejlcfpg`) : migration distante `20260909085152_excel_commercial_offers`, `stripe-webhook-ai-act` v46, `create-checkout` v40 et `validate-course-promotion` v3, toutes ACTIVE. Les six références Stripe LIVE sont configurées parmi les 32 variables du projet. Les CGV officielles sont `CGV-B2C-2026-08-26` et `CGV-B2B-2026-08-26`.

La publication frontend est autorisée après validation du lot et commit local sur `codex/formation-excel`. Aucun push ni merge n'est nécessaire au transfert SFTP IONOS. Le premier Checkout LIVE reste une étape distincte, non autorisée ici. Les contenus Excel et la réservation de séances restent à réaliser dans un lot ultérieur.

## Offre, niveau pédagogique et Stripe

L'API existante nomme `course_id` l'identifiant acheté. Pour Excel, ce champ désigne l'offre commerciale. `pedagogicalLevel` et `modality` permettent de retrouver séparément la prestation. Ce choix conserve le contrat de l'API sans prétendre qu'un cours LMS Excel existe.

| Offre commerciale | Centimes EUR | Variable serveur attendue |
| --- | ---: | --- |
| excel-initiation-inter | 69000 | STRIPE_EXCEL_INITIATION_INTER_PRICE_ID |
| excel-initiation-individuel | 99000 | STRIPE_EXCEL_INITIATION_INDIVIDUEL_PRICE_ID |
| excel-perfectionnement-inter | 69000 | STRIPE_EXCEL_PERFECTIONNEMENT_INTER_PRICE_ID |
| excel-perfectionnement-individuel | 99000 | STRIPE_EXCEL_PERFECTIONNEMENT_INDIVIDUEL_PRICE_ID |
| excel-avance-inter | 69000 | STRIPE_EXCEL_AVANCE_INTER_PRICE_ID |
| excel-avance-individuel | 99000 | STRIPE_EXCEL_AVANCE_INDIVIDUEL_PRICE_ID |

Les variables restent vides dans le modèle `webapp/supabase/functions/.env.example`. Le fichier local ignoré par Git `webapp/supabase/functions/.env.excel-live.local` contient exclusivement les six références réelles ci-dessous ; il n'est pas chargé automatiquement. Son contenu limité aux six variables autorisées a été configuré à distance lors de l'étape dédiée. Le code métier conserve `Deno.env.get(purchase.priceEnvName)` et aucun `price_id` en dur. Les références doivent désigner un prix ponctuel, actif, en EUR, du même mode que la clé Stripe et au montant attendu. Pour Excel, le serveur vérifie aussi le `course_id` et la modalité du prix, puis l'état actif, le mode, le niveau et la durée du produit parent.

| Offre | Prix LIVE | Produit LIVE |
| --- | --- | --- |
| excel-initiation-inter | price_1UDgMfLCMjfi77wuBTp5I25B | prod_VE8d61ytFpS32A |
| excel-initiation-individuel | price_1UDgMgLCMjfi77wu8UpVRv86 | prod_VE8d61ytFpS32A |
| excel-perfectionnement-inter | price_1UDgMhLCMjfi77wuFGwOLNms | prod_VE8dh6BaMam6ub |
| excel-perfectionnement-individuel | price_1UDgMhLCMjfi77wu16bz3jFH | prod_VE8dh6BaMam6ub |
| excel-avance-inter | price_1UDgMiLCMjfi77wu10YulHtu | prod_VE8dAm07CVCApk |
| excel-avance-individuel | price_1UDgMjLCMjfi77wuETS7F1cB | prod_VE8dAm07CVCApk |

## Modalité dans le parcours client

`CommercialCheckout` présente un récapitulatif Excel comprenant niveau, modalité lisible, durée, tarif catalogue et total à payer. Il apparaît aussi avant connexion. `create-checkout` prépare une mention `custom_text.submit.message` sur Stripe, une description et un champ `Modalité` sur la facture existante. Les métadonnées de la session, du PaymentIntent et de la facture comprennent le niveau et la modalité. Aucun nouveau produit ni mécanisme de paiement n'est ajouté. Les trois formations IA gardent leurs paramètres Stripe. Le rendu réel Stripe et PDF de facture n'a pas été exercé : les requêtes sont validées uniquement avec des doubles locaux, sans session réelle.

## Configuration serveur publiée

Les variables Edge Functions sont globales au projet. `create-checkout` et `stripe-webhook-ai-act` consomment les références Stripe via le catalogue partagé. `validate-course-promotion` utilise les offres et montants, sans lire les `price_id`. Les trois fonctions ont été publiées dans cet ordre : webhook, checkout, validation des promotions. Aucune autre fonction n'a été republiée.

La migration locale `20260909070845_excel_commercial_offers.sql` a été appliquée une seule fois avec l'outil officiel `apply_migration`, qui lui a attribué la version distante `20260909085152`. L'historique distant est passé de 60 à 61 entrées, sans modification des 60 précédentes. Les divergences historiques locales restent connues : aucun `db push` général, aucune réparation d'historique ni renommage d'ancienne migration ne doivent être déduits de ce lot.

Les contrôles après publication backend ont confirmé les données inchangées : `purchases` 12, `course_access` 15, `promo_redemptions` 1. Une nouvelle lecture avant publication frontend confirme les mêmes nombres et empreintes. Aucun Checkout LIVE, paiement, client Stripe ou promotion n'a été créé par ces contrôles.

L'intra à 1590 EUR par groupe jusqu'à huit personnes reste exclusivement sur devis. La mention de TVA centralisée reste inchangée.

## Architecture retenue après clarification de Thierry

Thierry souhaite que toutes les formations disposent de cours accessibles en ligne et de réservations de séances sur le site. Excel reprend donc le modèle existant, associant accompagnement et contenu en ligne. `requiresLmsAccess: true` documente ce choix. Aucun nouveau circuit de droits ni nouvelle politique d'activation ne sont ajoutés.

Le processeur historique enregistre l'achat et crée un `course_access` uniquement dans les conditions existantes (`immediate_after_payment`). Les parcours différé, bénéficiaire et OPCO conservent leur traitement. Aucun accès existant suspendu, révoqué, remboursé ou expiré n'est réactivé.

Précision sur les données : `purchases` stocke l'identifiant commercial dans `course_id`, l'acheteur, le montant effectivement payé, la devise, le statut, les références session/PaymentIntent/événement et les informations déjà prévues. Le niveau et la modalité restent déduits de cet identifiant via le catalogue ; aucune colonne n'est ajoutée. Le prix catalogue et le produit Stripe restent liés à l'intention commerciale existante. Les nouvelles métadonnées explicites niveau/modalité sont aussi présentes côté Stripe, sans changer la normalisation du webhook ni les remboursements.

`PaymentSuccess.jsx` dirige désormais les six offres vers `ExcelPurchaseConfirmation`. Cette confirmation lit l'achat payé de l'utilisateur connecté via les règles d'accès existantes ; une URL de succès seule n'est jamais une preuve de paiement. Le niveau et la modalité sont affichés, avec un accès au contact pour l'organisation. Aucun renvoi vers AI Act, un cours inexistant ou un calendrier non configuré.

Le tableau de bord présente l'inscription Excel et indique que les supports et réservations sont en préparation. Les contenus pédagogiques et le raccordement au calendrier existant devront être réalisés dans un lot dédié. La déduplication actuelle par acheteur et `course_id` interdit le rachat de la même offre ; inter et individuel sont deux offres distinctes. Aucun changement des règles de rachat n'est introduit.

## Promotions

Ciblage retenu : `target_type: course`, `target_key: identifiant commercial exact`. Une remise peut ainsi viser seulement l'inter, ou plusieurs offres explicitement sélectionnées. Aucune nouvelle cible globale `formation-excel` n'est nécessaire. Les cibles existantes, notamment `all`, conservent leur sens : vérifier les codes globaux déjà actifs avant toute ouverture des ventes.

La migration locale `20260909070845_excel_commercial_offers.sql` étend la liste de `prepare_course_promotion_checkout` aux six offres et impose leurs montants catalogue. Les choix administrateur incluent ces cibles. La réservation existante, les transactions, la consommation/libération et les contrôles d'identité/montants restent conservés. Aucun code promotionnel n'est créé ou activé.

## Prochaines étapes

1. Valider les tests frontend, le diff des 26 fichiers et le commit local.
2. Publier le frontend par transfert SFTP ciblé, avec contrôle SHA-256, sauvegarde des remplacements et aucune suppression distante.
3. Contrôler la page publique, les pages voisines et les données métier sans créer de session Checkout.
4. Organiser séparément un premier test Checkout contrôlé, après autorisation explicite. Le paiement réel et les documents Stripe ne sont pas validés par des doubles de test.
5. Réaliser les contenus en ligne et la réservation des séances dans un lot dédié.

## Vérifications locales

Les tests de checkout exécutent les Edge Functions transpilées avec des dépendances simulées : aucun appel réel Stripe/Supabase. Le test `scripts/test-excel-promotion-sql.mjs` exécute la fonction SQL modifiée avec PGlite, dans un PostgreSQL embarqué en mémoire, sur des tables de contrat et des dépendances promotionnelles simulées. Il ne remplace pas un test d'intégration sur un environnement Supabase complet.

Commande SQL depuis `webapp` : `node scripts/test-excel-promotion-sql.mjs C:\fp-excel-catalogue\output\excel-sql\node_modules\@electric-sql\pglite\dist\index.js`.

Échec préexistant reproduit sur `main` : `stripeWebhookCompatibility.test.js`, contre-test « supprimer la confirmation Diagnostic ». Ce test n'est pas modifié dans le lot Excel.

Résultats de l'étape configuration locale et modalité : 45 tests serveur ciblés (dont normalisation après paiement), 32 tests React concernés et 6 tests E2E ordinateur/mobile réussis. Lint, TypeScript, build, pré-rendu et validation de l'artefact réussissent. Les doubles locaux vérifient notamment les six références réelles, le récapitulatif, les paramètres de facture/Checkout, le refus des métadonnées incohérentes et le maintien des paramètres Stripe IA. Aucun test n'appelle Stripe ou un checkout distant.

Historique de l'étape précédente, non relancé intégralement ici : 139 tests applicatifs, 43 scénarios PostgreSQL embarqués et 6 tests d'artefact réussis ; suite serveur complète à 263 réussites sur 264, avec le seul échec préexistant décrit ci-dessus. Ne pas présenter cette ancienne suite complète comme entièrement verte.

Les contrôles E2E couvrent le choix des modalités, le checkout, le devis intra, les liens locaux, le titre/canonical/H1, l'accessibilité automatisée et l'absence de débordement aux largeurs 320, 390, 768 et 1365 pixels. Aperçu local vérifié HTTP 200 sur `http://127.0.0.1:4185/formation-excel`, puis contrôle visuel du panneau d'inscription. Aucun paiement réel testé. `git diff --check` réussit.

## Inventaire final du lot local

Les fichiers de la page créés lors du travail précédent sont inclus dans cet état, en plus du raccordement commercial.

13 fichiers suivis modifiés :

- `webapp/public/sitemap.xml`
- `webapp/src/App.jsx`
- `webapp/src/components/CommercialCheckout.jsx`
- `webapp/src/components/CommercialCheckout.test.jsx`
- `webapp/src/lib/promotionAdministration.js`
- `webapp/src/pages/Dashboard.jsx`
- `webapp/src/pages/FormationBureautique.jsx`
- `webapp/src/pages/PaymentSuccess.jsx`
- `webapp/supabase/functions/.env.example`
- `webapp/supabase/functions/_shared/purchaseConfig.js`
- `webapp/supabase/functions/_tests/purchaseConfig.test.js`
- `webapp/supabase/functions/create-checkout/index.ts`
- `webapp/supabase/functions/validate-course-promotion/index.ts`

13 fichiers ajoutés :

- `docs/excel-commercial-readiness.md`
- `webapp/scripts/test-excel-promotion-sql.mjs`
- `webapp/src/components/ExcelEnrollment.jsx`
- `webapp/src/components/ExcelEnrollment.test.jsx`
- `webapp/src/components/ExcelPurchaseConfirmation.jsx`
- `webapp/src/components/ExcelPurchaseConfirmation.test.jsx`
- `webapp/src/data/excelCourses.js`
- `webapp/src/pages/FormationExcel.css`
- `webapp/src/pages/FormationExcel.jsx`
- `webapp/src/pages/FormationExcel.test.jsx`
- `webapp/supabase/functions/_tests/excelPurchaseConfig.test.js`
- `webapp/supabase/migrations/20260909070845_excel_commercial_offers.sql`
- `webapp/tests/e2e/excel.spec.ts`

Base du lot : branche `codex/formation-excel`, parent attendu `fc8441f65de2aaccaf84b5ac2f7633aa758985b2`. Le hash du commit et les résultats du transfert sont relevés dans le compte rendu de publication. Le fichier `.env.excel-live.local` reste ignoré ; aucun build, secret ou artefact temporaire ne fait partie des 26 fichiers du commit.

Contrôles de préparation frontend relancés : lint, TypeScript, 49 tests React ciblés, 139 tests applicatifs et 6 tests d'artefact PASS ; build et pré-rendu PASS (24 routes pré-rendues, dont Excel). Les 6 tests E2E renforcés sont PASS : navigation complète, six offres, récapitulatifs ouverts aux quatre largeurs, clavier et accessibilité automatisée. Les contrôles production sont relevés séparément après transfert.

Corrections finales limitées à Excel : espace insécable avant le deux-points du titre pour les petits écrans ; nom accessible distinct pour chaque récapitulatif ouvert. Les tests attendent le montage React avant la première interaction avec le pré-rendu.
