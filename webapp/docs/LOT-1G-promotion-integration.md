# LOT 1G — préparation des intégrations promotionnelles

## Contrat commun

Le moteur ne reçoit jamais un tarif navigateur de confiance. Chaque Edge Function
de checkout doit d'abord identifier l'utilisateur depuis le JWT et son e-mail
depuis `auth.getUser()` (ou le profil vérifié), puis déterminer elle-même le
prix catalogue et les clés métier. Elle utilise ensuite, avec le client
`service_role`, les wrappers RPC publics suivants. Leur exécution est retirée à
`PUBLIC`, `anon` et `authenticated`; la logique et les tables restent privées :

- `public.validate_promo_code_for_checkout` pour l'aperçu serveur ;
- `public.reserve_promo_code_for_checkout` juste avant de créer une session Stripe ;
- `public.consume_promo_redemption_for_checkout` dans le traitement du paiement confirmé ;
- `public.release_promo_redemption_for_checkout` lors de l'expiration ou de l'abandon ;
- `public.release_expired_promo_reservations` pour le nettoyage planifié.

Les montants sont des entiers en centimes. Pour un pourcentage, le moteur
arrondit au centime le plus proche, une demi-unité étant arrondie vers le haut.
Le moteur réserve par défaut pendant 30 minutes. Une intégration dont le checkout
externe a la même durée minimale doit ajouter un tampon contrôlé. L'appelant doit
exiger le statut retourné `consumed` :
une consommation traitée hors fenêtre retourne `released` et n'utilise aucun
quota. Le LOT 1G-B applique cette règle au Diagnostic et traite explicitement
les événements signés de paiement ou d'expiration.

## LOT 1G-B — Diagnostic IA Express implémenté localement

Le prix catalogue serveur reste `14900` centimes. Le navigateur transmet
uniquement `promo_code`; `user_id`, l'e-mail, le prix catalogue, la remise et le
total sont dérivés côté serveur.

### Validation sans réservation

`validate-diagnostic-promotion` authentifie le JWT avec `auth.getUser()`, puis
appelle `validate_promo_code_for_checkout` avec la cible stable
`diagnostic / diagnostic-ia-express` et le montant serveur `14900`. La réponse
publique ne contient que le code normalisé et les trois montants. Tous les refus
métier partagent le même message générique. Cette étape ne crée aucune
`promo_redemption`.

### Réservation et création Stripe

`diagnostic_ia_orders.id` est l'identifiant stable du contexte
`diagnostic_ia_order`. La RPC `prepare_diagnostic_promotion_checkout` verrouille
la commande, réserve au plus une promotion et fige :

- `original_amount_cents = 14900` ;
- `discount_amount_cents` ;
- `final_amount_cents` et `amount_total` ;
- `promo_redemption_id` ;
- `checkout_configuration_locked_at`.

Les doubles clics et retries retrouvent cette configuration et utilisent la clé
Stripe déterministe `diagnostic-ia-checkout-<order_id>`. Sans promotion, le Price
Stripe catalogue existant est conservé. Avec une promotion, le serveur utilise
`price_data` avec le produit Stripe du Price catalogue et le montant final
réservé. Aucun Coupon, Promotion Code ou changement du Price catalogue n'est
nécessaire.

Une erreur Stripe définitive avant création de session appelle
`reset_diagnostic_promotion_checkout`, qui libère la réservation de façon
idempotente et annule la commande. Le retry repart avec une nouvelle commande
UUID, car une redemption libérée ne doit jamais être réactivée sur le même
contexte. Une erreur réseau/API ambiguë conserve la réservation : une session
peut avoir été créée malgré l'absence de réponse, et la libérer serait dangereux.
Une configuration déjà verrouillée refuse aussi un autre code avant toute
nouvelle tentative Stripe : la même clé d'idempotence ne reçoit donc jamais deux
jeux de paramètres.

### Webhook et montant payé

Le webhook signé charge `final_amount_cents` depuis la commande avant de valider
la Checkout Session. `process_diagnostic_ia_stripe_event` recontrôle ensuite,
dans sa transaction, l'utilisateur, la devise et l'égalité stricte entre le
montant Stripe et le montant final enregistré. Un montant incohérent ne confirme
pas la commande et ne consomme pas la promotion.

Un paiement confirmé consomme la redemption avant la création/mise à jour de la
preuve Stripe, dans la même transaction PostgreSQL. Une relivraison du webhook
reste idempotente. Les événements terminaux `checkout.session.expired` et
`checkout.session.async_payment_failed` libèrent la réservation ; une redemption
déjà consommée n'est pas libérée. `payment_intent.payment_failed` reste
retentable sur la même Checkout Session : l'échec est audité, mais la commande
reste `payment_pending` et la promotion `reserved` jusqu'au succès ou à
l'expiration terminale.

`purchases` et `course_access` restent entièrement hors de ce flux.

### Durée et dette de validation

Le moteur commun conserve sa durée par défaut de 30 minutes. Pour le Diagnostic,
la RPC d'intégration étend une nouvelle réservation à au moins 35 minutes et
Checkout expire après 31 minutes. Le webhook dispose ainsi d'environ quatre
minutes pour recevoir et traiter le dernier paiement accepté par Stripe. Le code
serveur refuse de créer la session si le tampon mesuré tombe sous trois minutes.
Cette durée ciblée ne modifie pas les règles des futures intégrations formations.

La migration 1G-A et les tests SQL 1G-B restent analysables statiquement mais ne
sont pas validés sur PostgreSQL réel tant que le runtime local demeure bloqué.

## LOT 1G-C — formations implémenté localement

### Checkout avant 1G-C

Les trois pages de formation utilisent le composant commun `CommercialCheckout`
et les clés stables de `_shared/purchaseConfig.js` :

- `formation-ia` : `49700` centimes ;
- `formation-ia-act` : `18700` centimes ;
- `formation-prompt-level-1` : `34300` centimes.

`create-checkout` authentifie l'utilisateur, retrouve la configuration serveur,
vérifie le Price Stripe catalogue, crée une `commercial_checkout_intent` et les
preuves de consentement, puis ouvre Checkout avec ce Price. Le webhook signé
valide montant, devise, utilisateur, formation, Price et consentements avant
d'appeler `process_stripe_post_payment_event`. Cette RPC historique crée la
preuve `purchases` et applique seule la politique existante d'attribution de
`course_access`. Les remboursements et litiges restent dans ce même pipeline.

### Validation et frontière de confiance

`validate-course-promotion` reçoit uniquement la clé de formation et le texte
du code. La clé est résolue dans `getPurchaseConfig`; l'identité, l'e-mail, le
prix catalogue et la cible `course / <course_id>` sont dérivés côté serveur.
La réponse ne contient que le code normalisé, le prix catalogue, la remise, le
total et un message générique. Cette validation ne crée ni intention, ni
redemption, ni purchase, ni droit.

Le navigateur ne transmet jamais un montant, une remise, un utilisateur, un
e-mail ou une redemption de confiance. Un montant final nul est refusé par
l'intégration formations V1 : le pipeline historique attend un paiement Stripe
positif et un statut `paid`. Cette compatibilité est contrôlée après le calcul
du moteur, sans modifier ses règles transversales.

### Contexte idempotent, réservation et Stripe

Le contexte promotionnel est
`commercial_checkout_intent / <commercial_checkout_intents.id>`. C'est l'objet
commercial déjà présent avant Stripe ; `purchases` n'existe légitimement
qu'après paiement confirmé. Un `checkout_request_id` UUID stable pendant la
tentative permet aux doubles clics et retries de retrouver la même intention.
La RPC transactionnelle `prepare_course_checkout_intent` crée ou retrouve
l'intention et toutes ses preuves de consentement. Une intention active récente
du même utilisateur et de la même formation est aussi réutilisée entre deux
appels concurrents.

`prepare_course_promotion_checkout` verrouille cette intention, réserve au plus
une promotion et fige : prix catalogue, remise, total, redemption, Price
catalogue et produit Stripe. Après ce verrouillage, un autre code ou contexte
est refusé : la clé Stripe `course-checkout-<checkout_intent_id>` ne reçoit donc
jamais deux configurations différentes.

Sans promotion, le line item conserve exactement le Price catalogue historique.
Avec promotion, `price_data.unit_amount` utilise exclusivement le total réservé
et le produit récupéré depuis ce Price. Aucun Price permanent, Coupon ou
Promotion Code Stripe n'est créé ou modifié. La réservation est étendue à
35 minutes et la Checkout Session promotionnelle expire après 31 minutes, avec
un tampon serveur minimal de trois minutes.

Une erreur Stripe définitive avant création de session libère la redemption et
marque l'intention `failed`. Une erreur réseau ou API ambiguë conserve intention,
montants et réservation ; le retry utilise la même clé Stripe. Une session déjà
ouverte est retrouvée. Une session terminale libère la réservation de manière
idempotente et permet ensuite un nouveau contexte, sans réactiver une redemption
libérée.

La revue statique finale 1G-C a renforcé trois convergences : une session créée
chez Stripe mais non encore liée localement reste acceptée par le contrôle des
consentements signé, `payment_intent.payment_failed` compare le montant demandé
plutôt que `amount_received = 0`, et une erreur terminale contrôlée déverrouille
le frontend pour générer un nouveau `checkout_request_id`.

### Webhook, atomicité et droits LMS

Le webhook charge l'intention figée et compare le montant Stripe réellement
confirmé, la devise, l'utilisateur, la formation, le Price catalogue, le produit
et la redemption. `process_course_stripe_event` consomme la promotion puis
appelle `process_stripe_post_payment_event` dans la même transaction PostgreSQL.
Si l'une des opérations échoue, consommation, purchase et éventuel droit sont
annulés ensemble. Le double webhook converge grâce au verrou d'intention, à
l'idempotence de la redemption et à l'unicité de l'événement Stripe.

`checkout.session.expired` et `checkout.session.async_payment_failed` libèrent
une réservation encore active. `payment_intent.payment_failed` est traité comme
un échec de carte retentable : il est journalisé comme ignoré, mais ne ferme pas
la session, ne libère pas la promotion et ne bloque pas un paiement ultérieur.

La migration 1G-C ne contient aucun `INSERT`, `UPDATE` ou `DELETE` sur
`purchases` ou `course_access`. Elle délègue au processeur historique déjà en
place. Avant paiement confirmé, aucun droit n'est créé. Après paiement confirmé,
ce pipeline historique, et lui seul, peut créer le purchase et appliquer la
politique d'accès. Les remboursements, suspensions et états terminaux restent
inchangés et aucune réactivation automatique n'est ajoutée.

### Interface et non-régression

`CommercialCheckout` propose la saisie et la validation facultatives du code,
avec prix, remise et total. Modifier le code avant Checkout invalide simplement
l'aperçu. Dès la première tentative, code, qualification commerciale et
consentements sont verrouillés côté interface et surtout côté serveur.

Sans code, aucune redemption n'est créée, le Price catalogue est utilisé et le
workflow historique des consentements, Stripe, purchases et droits reste le
même. Les trois formations restent directement achetables et le parcours
OF/OPCO reste orienté vers devis et convention.

## LOT 1G-D — administration implémentée localement

La route `/admin/promotions` est intégrée au `AdminShell` et au cockpit
existants. Elle ne crée aucun système d'administration parallèle et n'utilise
aucune écriture directe dans les tables promotionnelles. Le frontend appelle
uniquement quatre RPC transactionnelles :

- `admin_list_promotions` pour la liste, les cibles et les compteurs utiles ;
- `admin_create_promotion` pour créer la promotion et toutes ses cibles ;
- `admin_update_promotion` pour verrouiller la promotion et remplacer ses
  paramètres et ses cibles dans la même transaction ;
- `admin_set_promotion_active` pour désactiver ou réactiver sans suppression.

Ces fonctions sont `SECURITY DEFINER`, ont un `search_path` vide, appellent
`private.require_promotion_admin()` puis `private.is_strict_admin()`. Leur droit
d'exécution est retiré à `PUBLIC`, `anon` et `service_role`, puis accordé à
`authenticated` seulement : une session authentifiée non admin est rejetée par
le contrôle serveur. Les helpers privés ne sont exécutables par aucun rôle API.
Les RLS forcées et l'absence de droits directs d'écriture sur `promo_codes`,
`promo_code_targets` et `promo_redemptions` restent inchangées.

### Création, modification et cibles

Le serveur normalise le code (`trim`, uppercase), l'e-mail restreint et revalide
les types, valeurs, dates, quotas, montant minimum et cibles. La création et le
remplacement des cibles sont atomiques. Une cible globale est exactement
`all/all` et ne peut pas être combinée. Les clés exposées dans le formulaire
sont :

- `diagnostic / diagnostic-ia-express` ;
- `course / formation-ia` ;
- `course / formation-ia-act` ;
- `course / formation-prompt-level-1` ;
- `product / <identifiant métier stable>` pour les offres futures.

Le ciblage `course` ne raccorde pas le moteur au checkout formations : ce point
reste réservé au LOT 1G-C. Le code devient immuable après création afin de
préserver audit et support. Pour changer son texte, l'admin désactive l'ancien
code et en crée un nouveau. Aucune suppression physique n'est exposée en V1.

La modification des règles n'agit que sur les validations et réservations
futures. Les montants déjà copiés dans `promo_redemptions` et dans les commandes
Diagnostic restent figés ; aucun recalcul historique n'est effectué.

### Consultation, audit et données personnelles

La liste présente la remise, la période, les quotas, les cibles, les usages
consommés, les réservations encore actives, les usages libérés et le quota
restant calculable. L'e-mail restreint n'est disponible que dans cette surface
admin stricte ; le tableau signale seulement sa présence. Aucun détail par
utilisateur n'est affiché dans cette V1.

Les créations, modifications et changements d'activation alimentent le
`audit_log` transverse avec l'identifiant de l'admin, l'identifiant UUID de la
promotion, l'action et l'horodatage. Le journal ne copie ni code promotionnel ni
e-mail restreint. La désactivation bloque les futures validations/réservations,
sans supprimer les redemptions ni modifier les commandes payées.

### Limites V1 et dette PostgreSQL réelle

Il n'existe ni suppression physique, ni dashboard marketing, ni détail nominatif
des redemptions, ni création de code commercial persistant dans ce lot. Les
checkouts applicatifs Diagnostic et formations ont été adaptés localement pour
intégrer le moteur promotionnel. Aucune ressource Stripe LIVE n'a été créée ou
modifiée : aucun Price Stripe LIVE n'a été modifié, aucun Coupon Stripe LIVE ni
Promotion Code Stripe LIVE n'a été créé et aucun paiement réel n'a été effectué.
Aucun déploiement n'a été effectué.

Les validations PostgreSQL réelles restent obligatoires avant tout déploiement :

- LOT 1G-A : 78 assertions pgTAP non exécutées ;
- LOT 1G-B : 43 assertions pgTAP non exécutées ;
- LOT 1G-D : 56 assertions pgTAP non exécutées après la revue statique finale
  (refus des mutations non-admin, auxiliaires privés, réservation expirée,
  absence de code orphelin et réduction de quota sous historique ajoutés).
- LOT 1G-C : 53 assertions pgTAP non exécutées (contexte idempotent, montants
  figés, ciblage course, réservation, erreurs Stripe, consommation atomique,
  double webhook et garde des droits LMS).

Total promotionnel : 230 assertions pgTAP présentes, dont 0 exécutée sur un
PostgreSQL réel.

La migration et les tests peuvent être parsés statiquement, mais cette analyse
ne remplace ni leur exécution réelle ni la validation des transactions, verrous
et scénarios de concurrence, ni les contrôles réels RLS, ACL et propriétaires.
La validation PostgreSQL réelle reste obligatoire avant tout déploiement du
moteur promotionnel.
