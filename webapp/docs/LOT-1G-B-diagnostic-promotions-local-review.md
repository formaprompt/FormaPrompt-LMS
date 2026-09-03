# LOT 1G-B + UI promo — revue locale

## État et périmètre

- Worktree : C:\fp-release-promotions-express.
- Branche : codex/release-promotions-express.
- HEAD initial et conservé : 632d45b1bd5957cb777ae6d264f7fe75c4017213 ; upstream 0/0.
- État initial : seul CommercialCheckout.css était modifié (+27/-3), non staged.
- Référence 1G-B : cda9cf990d26cb6bdb6261795d4699a63d6148ea.
- Référence historique pré-promotions : 0b34f73e4a62f03ce516b337a8d525d8f852f48a.
- Aucun cherry-pick, commit, push, merge, paiement, déploiement ou SFTP.
- Production consultée uniquement en lecture : source create-diagnostic-checkout v11 et définitions des deux fonctions SQL Diagnostic. Aucun compte/code/droit modifié.

## Portage sélectif

Le checkout Diagnostic v11 réellement déployé est identique à la référence pré-1G. Son delta 1G-B a été porté avec ses contrôles d'identité, CGV publiées, consentements, commande pending unique, reprise de session et clé Stripe par commande.

Le webhook courant est conservé comme base, et non remplacé par celui de la branche historique. Ajouts uniquement Diagnostic : lecture du montant et de la redemption figés, contrôle d'identité et de correspondance des métadonnées, délégation au processeur transactionnel Diagnostic. Les branches formations, anciens paiements, remboursements et litiges restent inchangées.

La confirmation contractuelle conserve ses cinq tentatives, sa fenêtre de reprise de quinze minutes et son transport SMTP. Son prix vient maintenant du montant de commande réellement payé. Un montant absent/invalide n'est pas remplacé silencieusement par un prix catalogue.

## Preuve transactionnelle promotionnelle (decision du 03/09)

Sans remise, DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26 et le pipeline 149 euros restent inchanges.
Avec remise, DIAGNOSTIC-CGV-ACCEPTANCE-PROMO-2026-09-03 designe un modele de preuve,
pas une nouvelle CGV. Les CGV B2C/B2B du 26/08 ne sont ni reeditees ni republiees.

La migration B locale ajoute un type de modele distinct dans legal_document_versions,
car un seul document publie par type est autorise. Cela laisse la preuve historique publiee.
Une seule colonne nouvelle est necessaire : diagnostic_ia_consents.acceptance_text.
La version du modele, l horodatage, l utilisateur, le consentement et la liaison commande
existaient deja ; montants, devise et redemption restent dans diagnostic_ia_orders.

La validation Edge rend le texte depuis le devis serveur. Au checkout, le serveur compare
le texte accepte avec les montants reserves et refuses les preuves perimees avant Stripe.
Le trigger PostgreSQL fige le texte depuis la commande, jamais depuis un texte client.
Une preuve promotionnelle enregistree ne peut etre modifiee par UPDATE.
La reverification du meme code impose une nouvelle acceptation dans le frontend.

La confirmation apres paiement lit la preuve stockee, controle sa version, ses montants et
son identite, puis restitue catalogue, remise, total effectivement paye et CGV applicables.
Un retry SMTP conserve exactement le meme message. Les tests verifient notamment
14900 - 14155 = 745, un autre pourcentage et un montant fixe, sans code production.

## Contrat promotionnel

- Cible serveur : diagnostic / diagnostic-ia-express.
- Identité et email issus de getUser ; prix catalogue serveur 14900 cents.
- Validation sans réservation et sans montant client autoritaire.
- Réutilisation de promo_codes, promo_code_targets et promo_redemptions ; aucun second moteur.
- Total strictement positif : garde du devis, de la préparation SQL, de la ligne Stripe et du webhook.
- Une configuration verrouillée ne peut changer de code, ni en ajouter/retirer ; comparaison SQL NULL-safe.
- Validation d'un code déjà figé avant réutilisation d'une session Stripe ouverte.
- Le refus SQL ne réinitialise pas une tentative concurrente valide.
- Expiration Stripe stable dérivée de la réservation de 35 minutes (tampon 4 minutes), pour ne pas changer les paramètres idempotents lors d'un retry.
- Une ancienne tentative ambiguë n'est pas réinitialisée sur une erreur de retry. Une tentative demeurée ambiguë jusqu'à expiration devra être rapprochée avant reprise ; aucun paiement réel n'a été simulé pour ce cas.
- Consommation/libération dans la transaction historique ; pas d'effet promotionnel d'un événement déclaré stale.
- payment_intent.payment_failed reste réessayable et ne libère pas la réservation.
- Aucun nouvel INSERT/UPDATE/DELETE direct sur purchases ou course_access.

## Interface

Le champ Diagnostic utilise les classes responsive du checkout formations. Les sélecteurs des petits inputs Diagnostic sont limités aux radios/checkboxes. Code, remise, total, bouton et texte inférieur reflètent le devis serveur ; une saisie non vérifiée bloque le paiement. Modifier le code réinitialise le devis et l'acceptation du montant.

La cible Diagnostic est rendue disponible dans l'admin local, sans modifier un code existant. Aucun changement aux pages de réservation, Calendar/Meet, questionnaire, restitution, Dashboard ou CGV.

## Migration et dépendances

Seule **nouvelle migration de production à revoir** :
supabase/migrations/20260831130000_integrate_diagnostic_promotions.sql.

Prérequis déjà historiques : diagnostic_ia_orders, diagnostic_ia_consents, versions légales du 26/08, processeur/trigger Diagnostic, socle financier Stripe et moteur A. A/C/D ne sont pas modifiés et ne doivent pas être rejoués.

Le dépôt Express ne contenait pas le socle Diagnostic de production. Deux copies historiques, exclusivement destinées à la base éphémère de test, sont rangées hors du répertoire migrations :
- supabase/tests/fixtures/diagnostic-history/20260826163906_add_diagnostic_ia_payments.sql
- supabase/tests/fixtures/diagnostic-history/20260826192602_add_diagnostic_ia_legal_consents.sql

Le workflow manuel copie ces deux fixtures dans ses migrations locales avant l'application complète. Il n'en déploie aucune à distance. La fixture formation utilise désormais la version publiée du 26/08, car ce socle retire la version du 12/08. Aucun nouveau scénario formation n'est supprimé.

Ne jamais déployer ces deux fixtures historiques en production, ni utiliser un db push global.

## Validation

Exécuté localement, sans Docker/WSL :
- test:app : 134/134.
- test:stripe : 242/242.
- Webhook réel transpilé exécuté dans un bac à sable : 46 tests, dont deux contre-tests de suppression du routage et de l'email Diagnostic.
- Endpoints réels transpilés : 33 tests, plus 9 tests du helper Diagnostic.
- Preuve contractuelle : 7 tests, dont contre-test executable de regression a 149 euros.
- React/Vitest global final : 288/288 sur 55 fichiers, avec deux workers (92,87 s).
- Ancienne mission : un echec Studio au premier passage fortement parallele ; aucun echec dans le passage final de cette mission.
- Pages Diagnostic, formations et admin promotions incluses dans le passage global final.
- TypeScript application, parsing TypeScript des endpoints/webhook, ESLint JS/React : PASS. La configuration ESLint ignore les trois index.ts Edge ; Deno natif indisponible, donc leur vérification de types Deno reste à faire.
- Build Vite production avec configuration publique injectée dans le processus : PASS (13,77 s), 219 fichiers, 50 690 391 octets, 191 entrees de precache.
- UI navigateur locale avec transports simulés : 36 combinaisons (Diagnostic + 3 formations, 9 largeurs 320–1440), code INVALID-TEST-20260903 intégralement visible, aucun débordement du bloc. Tolérance de mesure sous-pixel 0,1 px pour la hauteur nominale de 44 px.
- pglast : syntaxe SQL externe migration B, suites et fixtures ; cela ne prouve PAS l'exécution PL/pgSQL.
- L'essai optionnel parse_plpgsql de pglast a rencontré une erreur de décodage JSON ; aucun PASS de compilation runtime n'est déduit.
- Inventaire : A 82 + B 55 + C 56 + D 56 = 249.
- Bash syntaxe, YAML et git diff --check contrôlés.

Les refus email/dates/quotas simulés dans les tests Edge vérifient le masquage des erreurs SQL, pas leur calcul réel. Les tests pgTAP sont prepares pour verifier le vrai moteur : 95 % de 14900 = 14155 de remise, 745 de total ; refus zéro atomique, quotas, dates, réservations, consommation, libération et idempotence. Un bloc DO contractuel supplementaire echoue explicitement si le modele, le texte, l immutabilite ou le parcours sans remise regressent ; il ne gonfle pas le compteur des 55 assertions promotionnelles.

**NON executes** : pgTAP PostgreSQL reel, controles SQL runtime/RLS et concurrence PostgreSQL A/B/C/D/E.
Une seule tentative controlee Docker/WSL a ete effectuee le 03/09 : Ubuntu a demarre,
Docker Engine 29.7.2 a repondu, puis une commande WSL a echoue par timeout de connexion
avec Wsl/Service/0x8007274c. Aucun serveur Supabase de test ni migration locale n a ete lance.
Pas de reparation ni nouvelle tentative. Docker/service/socket/containerd ont ete arretes
(exit 0), puis wsl --shutdown (exit 0), Ubuntu Stopped confirme, aucun vmmem/Docker actif.
La limite est restee memory=2GB, processors=2 ; aucune augmentation.
Le workflow GitHub reste manuel et n a pas ete declenche.

POSTGRESQL RUNTIME NON VALIDE - INFRASTRUCTURE LOCALE INDISPONIBLE.

## Points bloquants avant déploiement

1. Revue du diff et validation PostgreSQL réelle sur une base éphémère contenant le socle Diagnostic + A/B/C/D. Les nouveaux 249 tests ne sont pas annoncés PASS runtime.
2. La strategie contractuelle est implementee localement selon la decision de Thierry : modele promo distinct, CGV et preuve sans promo intactes. Sa persistance PostgreSQL doit encore etre executee reellement.
3. Confirmer l'ordre de déploiement futur : migration B uniquement, validate-diagnostic-promotion et create-diagnostic-checkout (JWT true), webhook courant avec ses dépendances (JWT false conservé), puis frontend. Aucune étape exécutée ici.
4. Ne modifier la quatrième cible du code de production qu'après autorisation séparée et validation complète.

## Fichiers du lot

Modifiés (19) :
- .github/workflows/promotion-postgres-validation.yml
- webapp/src/components/CommercialCheckout.css
- webapp/src/lib/diagnosticCheckout.js
- webapp/src/lib/diagnosticCheckout.test.js
- webapp/src/lib/promotionAdministration.js
- webapp/src/pages/AdminPromotions.jsx
- webapp/src/pages/AdminPromotions.test.jsx
- webapp/src/pages/DiagnosticIA.css
- webapp/src/pages/DiagnosticIA.jsx
- webapp/src/pages/DiagnosticIA.test.jsx
- webapp/supabase/config.toml
- webapp/supabase/functions/_shared/diagnosticContractConfirmation.js
- webapp/supabase/functions/_shared/diagnosticPayment.js
- webapp/supabase/functions/_tests/stripeWebhookCompatibility.test.js
- webapp/supabase/functions/stripe-webhook-ai-act/index.ts
- webapp/supabase/tests/concurrency/promotion_engine_concurrency.sh
- webapp/supabase/tests/course_promotion_integration.sql
- webapp/supabase/tests/validation/verify_promotion_pgtap_counts.sh
- webapp/supabase/validation/promotion_runtime_security.sql

Ajoutés (12) :
- webapp/docs/LOT-1G-B-diagnostic-promotions-local-review.md
- webapp/supabase/functions/_shared/diagnosticPromotion.js
- webapp/supabase/functions/_shared/diagnosticContractEvidence.js
- webapp/supabase/functions/_tests/diagnosticContractEvidence.test.js
- webapp/supabase/functions/_tests/diagnosticPromotion.test.js
- webapp/supabase/functions/_tests/diagnosticPromotionEndpoints.test.js
- webapp/supabase/functions/create-diagnostic-checkout/index.ts
- webapp/supabase/functions/validate-diagnostic-promotion/index.ts
- webapp/supabase/migrations/20260831130000_integrate_diagnostic_promotions.sql
- webapp/supabase/tests/diagnostic_promotion_integration.sql
- webapp/supabase/tests/fixtures/diagnostic-history/20260826163906_add_diagnostic_ia_payments.sql
- webapp/supabase/tests/fixtures/diagnostic-history/20260826192602_add_diagnostic_ia_legal_consents.sql

Les captures et outils d'aperçu sont dans output/playwright/promo-ui, ignorés par Git. Aucun staging.
