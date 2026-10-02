# Suivi des achats Google Ads : confirmation autonome

## État

Correctif local à contrôler avant toute publication. La production conserve le suivi désactivé.
Aucun commit, push, fusion, déploiement, changement du compte Google ou paiement artificiel
n'est inclus dans ce lot. Le flag `VITE_GOOGLE_ADS_PURCHASE_ENABLED` reste `false` par défaut.
L'activation exige une compilation production avec `true` et l'origine exacte
`https://formaprompt.com` ; `www` doit rejoindre cette origine avant l'application.

Balise : `AW-18489285500`. Destination Achat : `AW-18489285500/WOz2COeP5I0dEPy2sPBE`.
Les réglages sans conversions améliorées, détection automatique des données utilisateur
ni interactions de formulaires doivent être conservés. Une nouvelle configuration Google
imposant des conversions améliorées ne convient pas à ce contrat.

## Pourquoi changer le transport

Le vrai SDK avait émis la route courante malgré `page_location` réduite et `send_page_view:false`.
Ces options seules ne protègent donc pas les routes privées. Le SDK n'est désormais jamais
chargé dans la SPA, y compris après acceptation des cookies : `initGoogleAds` reste dormant.

Après un reçu admissible, le navigateur ouvre entièrement `/ads-purchase-confirmation.html`,
sur la même origine canonique. Ce document classique autonome n'importe ni React, ni Auth,
ni Supabase. Son titre et son DOM sont neutres. Aucun iframe, nouvelle infrastructure,
import serveur ou modification de paiement n'est nécessaire.

Cette approche protège les données préparées et les URL transmises ; ce n'est **pas une
isolation du stockage**. Le SDK de même origine peut techniquement accéder au stockage
Auth existant. Il faut donc contrôler les requêtes du vrai SDK avant publication ; aucun
test mocké ni option de configuration ne garantit à lui seul l'absence de transmission.
Le chargement Google utilise aussi des données techniques, dont l'adresse IP et les
identifiants publicitaires. « Aucune donnée du compte apprenant dans les requêtes contrôlées »
ne signifie pas « aucune donnée personnelle au sens du RGPD ».

## Consentement, clic et reçu

Mode basique : aucun SDK sans consentement publicitaire explicite versionné.
L'ancien cookie technique ne vaut pas consentement publicitaire. Analytics, personnalisation
et audiences restent refusés. Le SDK n'est chargé que sur le document de confirmation valide.

Un seul identifiant de clic `gclid`, `gbraid` ou `wbraid`, à caractères alphanumériques,
tiret/underscore et longueur 10–256, peut être conservé après accord, au maximum 30 jours.
Cette fenêtre correspond à la fenêtre Ads examinée pour ce lot ; la revérifier avant activation.
Le même clic relu ne renouvelle pas sa date d'expiration. Les autres paramètres sont ignorés.
Aucun cookie `_gcl_aw` n'est fabriqué : Google lit le clic dans la seule query du relais.

Un retrait efface le clic et le handoff ; le module de consentement existant efface les
cookies `_gcl*`. Un marqueur de session empêche de ressusciter un clic depuis l'ancienne URL.
Choix conservateur : après refus/retrait, ce même onglet ne recapture plus de clic, même
si l'accord revient ensuite. Cela peut sous-mesurer un nouveau clic dans cet onglet.

Seules les confirmations formation/diagnostic appellent le hook existant. Acheter,
annuler, posséder un accès ou visiter une URL de succès ne prouve pas un achat.
Le serveur `get-purchase-conversion-receipt`, inchangé, vérifie Auth, propriétaire, paiement,
transaction et dernier événement webhook traité : payé, mode réel prouvé, état cohérent.
Les paiements d'autrui, test, annulés, pending, échoués, remboursés ou litigieux ne sont pas éligibles.
Le reçu minimal est `verified`, `livemode`, UUID `transaction_id`, `amount_total_cents`, `currency`.
Les paramètres envoyés à Google proviennent exclusivement de ce reçu : 11900 → 119 EUR,
49900 → 499 EUR, jamais un prix catalogue ou une valeur fixe.

## Handoff et retour

Avant de quitter le LMS, un GET de préflight du HTML exige HTTP réussi, type HTML et marqueur
de version exact. Il est `no-store`, `no-referrer`, sans cookies et sans redirection,
avec délai total de cinq secondes, corps inclus. Document absent, réseau indisponible ou
changement de route/consentement pendant cette attente : aucune navigation publicitaire.

Le seul payload `sessionStorage` contient `{version, transaction_id, amount_total_cents,
currency, expires}` avec validité de 60 secondes. Aucune session Stripe, identité, JWT,
formation ou URL de retour n'y figure. Le relais le consomme et l'efface avant de charger Google.
Il exige aussi un marqueur local de tentative correspondant, un consentement encore accordé,
une fenêtre valide, une URL strictement neutre et l'absence de commande déjà remise.
Accès direct, rechargement, contenu périmé/invalide ou refus : zéro SDK, retour au dashboard.

La politique `no-referrer` est installée dans le parent avant une navigation `_self` via
un lien `noreferrer`, puis dans le relais et sur sa balise SDK. L'URL du relais comporte
au maximum le seul identifiant de clic validé ; aucun UUID de transaction en query.

Le lien visible « Retour à mon espace » est immédiatement utilisable. `history.back()`
retrouve la confirmation sans mémoriser/transmettre son URL privée. Le retour automatique
part après callback ou, au plus tard, 7,5 secondes ; un secours dashboard suit après
0,5 seconde si l'historique ne quitte pas le document. Erreur SDK : retour immédiat.
Une arrivée tardive du SDK après un retour déjà demandé ne produit pas de conversion.
Le retour dans le LMS charge/restaure un document qui n'a jamais hébergé le SDK.
Une restauration du relais depuis le cache de navigation repart au dashboard.
Les tests historiques ne remplacent pas un contrôle distinct du BFCache réellement observé.

## Dédoublonnage et limites de mesure

Deux registres locaux distincts, chacun limité à 1000 UUID/150 jours :

- `formaprompt_ads_attempt_v1` est écrit avant navigation : une seule tentative par UUID
  empêche les boucles de retour si JavaScript, réseau ou SDK est bloqué.
- `formaprompt_ads_sent_v1` est écrit après remise de la commande de conversion au SDK.
  Ce registre conserve la compatibilité avec les anciens marqueurs.

Stockage indisponible ou corrompu : arrêt prudent, LMS utilisable. Un échec après le marqueur
de tentative n'est pas rejoué automatiquement : sous-mesure possible, assumée pour empêcher
les boucles. Google reçoit toujours le même UUID pour son propre dédoublonnage. Les écritures
locales ne constituent pas un verrou transactionnel entre onglets concurrents.
Le statut parent `handoff` signifie seulement navigation préparée/exécutée, jamais conversion
reçue ou attribuée. Un callback Google et le marqueur `sent` ne prouvent pas non plus la réception.

Le HTML reste hors précache via la règle existante `**/*.html` ; `.htaccess` revalide déjà
les HTML et n'est pas modifié. La garde de release autorise uniquement ce nom de relais,
avec contrôle strict du titre, DOM, script classique, version et politique de référent.
Tout autre HTML continue d'exiger l'entrée Vite correspondant à la release.

## Validation sans alimenter Google Ads

Depuis `C:\fp-google-ads-purchase-tracking-20261002\webapp` :

```powershell
npm run test:app
npm run test:stripe
npm run test:studio -- --maxWorkers=1 --minWorkers=1
npm run test:release
npm run lint
npm run typecheck
npm run build:app
```

Les tests Node exécutent le vrai script inline du relais dans un navigateur simulé, sans
réseau Google. Les tests React préservent la lecture du reçu et les parcours de confirmation.
La compilation de contrôle utilise exclusivement les variables publiques CI fictives et le flag
`false`. Un pré-rendu isolé peut simuler le blog avec une liste vide et des articles fictifs puis
vérifier l'artefact complet ; cela valide sa structure et ses gardes, pas le contenu du blog de production.
Cet artefact de contrôle contient une clé publique fictive et des articles fictifs : il est
**non publiable**. Avant une future publication autorisée, recompiler avec la configuration
publique approuvée et pré-rendre les contenus réels, puis vérifier ce nouvel artefact exact.

La recette indépendante du SDK réel doit autoriser uniquement son GET exact puis intercepter
et **annuler avant émission toutes les autres requêtes tierces**, conversions incluses.
Fixtures fictives uniquement ; aucune session Auth personnelle dans les tests.
Contrôler valeur119/499, EUR, UUID, label, attribution du clic, référent, corps et query de tous
les endpoints ; refus, annulation, retrait, stale/reload/retour, HTML absent et SDK bloqué.
Les preuves et résultats exécutés appartiennent au rapport local de coordination.

Publication/activation restent soumises à des accords distincts et un plan exact de release.
L'attribution dans le compte Google ne pourra être confirmée que sur une vente légitime
future, consentie, issue d'une publicité : aucune fausse conversion ni dépense artificielle.

## Vérification dans le compte Google Ads

Lecture effectuée par le coordinateur le 2 octobre 2026, sans modification : compte
`248-573-7298`, Objectifs → Conversions → Achat, action `7813531623`, source Site Web,
action principale, valeurs variables (défaut 1 EUR), comptage de toutes les conversions,
fenêtre après clic 30 jours. Le défaut 1 EUR ne doit jamais remplacer le montant du reçu.

1. Avant activation, recontrôler ces réglages et la destination exacte
   `AW-18489285500/WOz2COeP5I0dEPy2sPBE`. Vérifier qu'aucune conversion fondée sur la seule
   URL de confirmation et aucun import GA4 ne double ce même achat. Relever les réglages,
   sans modifier action, campagne ou budget.
2. Après publication et activation autorisées, contrôler avec Tag Assistant la balise
   unique du relais, le consentement et les paramètres dynamiques. Refus : zéro balise.
   Tag Assistant ne justifie aucun faux achat ni envoi de conversion fictive.
3. Sur une vente légitime future issue d'une annonce, consentie et réellement payée,
   comparer UUID stable, montant net et devise du reçu avec la conversion enregistrée
   dans le compte Google. Contrôler également l'absence de doublon après retour/rechargement.
   Le callback ou la commande remise au SDK ne prouvent ni réception ni attribution.

Conserver séparés : correctif préparé localement, publication contrôlée et mesure réelle
vérifiée. Le traitement Google peut être différé ; l'absence immédiate dans l'interface
ne prouve pas, à elle seule, un échec.

Sources officielles examinées pour ce chantier :

- [Balise et événement Google Ads](https://support.google.com/google-ads/answer/7548399?hl=fr).
- [Identifiant de transaction](https://support.google.com/google-ads/answer/6386790?hl=fr).
- [Mode de consentement](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [Paramètres du tag Google Ads](https://support.google.com/google-ads/answer/13438166?hl=fr).
- [Conversions améliorées et collecte automatique](https://support.google.com/google-ads/answer/13258081?hl=fr).
- [Cookies et traceurs CNIL](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies).
