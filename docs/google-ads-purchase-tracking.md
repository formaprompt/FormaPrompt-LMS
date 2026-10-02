# Suivi des achats Google Ads — préparation pour revue

## État et limites

Lot validé localement ; suivi désactivé et non déployé. La mesure dans Google Ads n'est pas vérifiée.
Thierry autorise le 2 octobre 2026 le commit et le push sur la branche dédiée
`codex/google-ads-purchase-tracking-20261002`, après revue finale et préservation des autres travaux.
Cet accord ne couvre ni création d'une demande de fusion, ni fusion, ni déploiement, ni activation.
Le résultat Git (SHA et référence distante) est consigné dans le rapport local, pas anticipé ici.
Compte fourni : `248-573-7298`. Balise : `AW-18489285500`.
Destination Achat : `AW-18489285500/WOz2COeP5I0dEPy2sPBE`.

Réglages Google : Thierry confirme le 2 octobre 2026 la désactivation des données utilisateur,
de leur détection automatique, des interactions de formulaire et du suivi avancé des conversions.
La réserve correspondante est levée sur cette confirmation ; le coordinateur n'a pas modifié
ni inspecté directement le compte. Cela n'autorise pas une activation ou un déploiement.

Aucune modification de campagne, budget, dates, code DIAGIA, prix, paiement,
remboursement, droits `course_access`, webhook ou Training Lab.
Aucune migration. La nouvelle fonction est une lecture authentifiée, sans écriture métier.

## Existant contrôlé et choix retenu

Le frontal examiné ne comporte pas de balise Google Ads, GA ou GTM active.
L'ancien bandeau `react-cookie-consent` annonçait uniquement des stockages techniques.
Son ancien cookie accepté ne constitue donc pas un consentement publicitaire.
La même bibliothèque est réutilisée pour un choix publicitaire explicite, versionné,
avec refus aussi accessible que l'acceptation et accès permanent « Gérer mes cookies ».

Le mode de consentement est **basique** : aucune balise Google chargée avant accord.
Pas de personnalisation publicitaire ni de Google Analytics. Ce lot n'implémente aucune
conversion améliorée ; les réglages automatiques désactivés ont été confirmés par Thierry.
L'activation exige `VITE_GOOGLE_ADS_PURCHASE_ENABLED=true`, une compilation production
et le domaine `formaprompt.com` ou `www.formaprompt.com`. Valeur par défaut : `false`.
Un paiement test ou un mode de paiement inconnu ne produit pas de conversion.

## Source de vérité

Seules `/paiement-reussi` et `/diagnostic-ia/confirmation` raccordent le suivi.
Le bouton Acheter, les pages d'annulation, un droit pédagogique existant ou une URL de succès
ne prouvent pas un achat et ne déclenchent rien par eux-mêmes.

`get-purchase-conversion-receipt` exige une session connectée validée par Supabase Auth.
Le serveur recherche la session de paiement exacte et vérifie son propriétaire,
la transaction, la commande associée et le dernier événement Checkout enregistré
par le webhook existant : paiement `paid`, mode réel confirmé, empreinte et état de traitement cohérents.
Les états en attente, annulés, échoués, remboursés ou litigieux ne fournissent pas de reçu.
Les événements historiques sans preuve de mode sont exclus.

Réponse minimale : `verified`, `livemode`, UUID opaque `transaction_id`,
`amount_total_cents`, `currency`. Aucune identité, adresse, téléphone, détail pédagogique
ou code promotionnel n'est transmis à Google. Les URLs et référents sont réduits à leur origine,
le titre transmis est constant (« FormaPrompt ») et les groupes d'intérêt sont désactivés.
Le chargement d'une balise Google implique néanmoins les données techniques propres à ce fournisseur,
dont les identifiants publicitaires et l'adresse IP : le bandeau et la confidentialité l'expliquent.

La valeur vaut le montant serveur réellement payé divisé par 100, et non le prix catalogue.
Le scénario fictif DIAGIA utilise un reçu `11900` centimes → `119 EUR`.
La validité actuelle de ce code en production n'a pas été interrogée ni modifiée.

Le dédoublonnage local couvre les remontages et rechargements ; Google reçoit toujours
le même identifiant de transaction pour son propre dédoublonnage. Un bloqueur, une erreur
de stockage ou l'absence de consentement peuvent entraîner une sous-mesure ; le LMS reste utilisable.
Le retour du transport « sent » signifie commande transmise au lecteur de balise,
pas preuve d'attribution ou de réception dans Google Ads.

## Contrôles locaux sans alimenter Google Ads

### Reçu : intégration HTTP isolée terminée le 2 octobre 2026

Test ajouté : `supabase/functions/_tests/purchaseConversionReceipt.integration.test.js`.
Le vrai SDK Supabase 2.105.1 (même version que l'import Edge) appelle un serveur HTTP
éphémère sur `127.0.0.1`. Auth et les réponses PostgREST sont fictifs, mais les requêtes
du SDK et le handler applicatif ne sont pas remplacés par un faux client fluent.
Tout `fetch` hors de cette origine est interdit, les redirections sont refusées,
aucun fichier d'environnement ni secret réel n'est chargé, et le serveur est arrêté à la fin.

Résultats : 56 tests d'intégration réussis (55 sous-tests et leur parent),
211 requêtes locales capturées, dont 159 Auth/SELECT ; zéro requête externe et zéro mutation métier.
Les 44 tests unitaires du reçu et 30 tests React de raccordement ont également été relancés avec succès.
La suite serveur complète compte désormais 411 réussites, un ignoré préexistant et zéro échec.

Contrôlés : reçu payé formation/diagnostic à 119 EUR, filtres exacts propriétaire/session,
session absente/refusée/expirée simulée, paiement d'autrui, montant fourni par le navigateur,
annulation/attente/remboursement/litige/mode test, cohérence de l'événement et réponse minimale.
Toutes les réponses du handler, erreurs et prévol inclus, sont `no-store`.

Limite explicite : aucune instance Supabase, base PostgreSQL/RLS ou passerelle Edge réelle
n'est démarrée. La signature cryptographique des JWT n'est pas testée ; le rejet Auth est simulé.
`verify_jwt=true` est contrôlé statiquement et le handler exige toujours `auth.getUser`.
Les contrôles de la plateforme cible seront à exécuter lors d'un déploiement séparément autorisé.
Ce résultat valide le reçu en environnement HTTP isolé, pas un fonctionnement en production.

Pour reproduire depuis `C:\fp-onboarding-apprenant-20261001\webapp` :

```powershell
node --test supabase/functions/_tests/purchaseConversionReceipt.test.js supabase/functions/_tests/purchaseConversionReceipt.integration.test.js
npm run test:studio -- src/pages/useGoogleAdsPurchase.test.jsx src/pages/PaymentSuccessConversion.test.jsx
```

### Autres contrôles du lot

Les tests utilisent des utilisateurs, transactions et reçus fictifs ainsi qu'un transport Google simulé.
Aucun Checkout réel et aucune conversion test envoyée à Google. Les appels Supabase sont simulés.
Les contrôles navigateur doivent bloquer tout trafic hors boucle locale avant la navigation.

Depuis `C:\fp-onboarding-apprenant-20261001\webapp` :

```powershell
npm run test:app
npm run test:stripe
npm run test:studio
npm run test:release
npm run lint
npm run typecheck
npm run build
```

Le build exige la configuration publique Supabase et l'URL du site prévues par les gardes
existantes du dépôt. Pour ce contrôle, seules les variables publiques nécessaires de la
configuration locale approuvée ont été chargées en mémoire, sans afficher les valeurs,
avec `VITE_GOOGLE_ADS_PURCHASE_ENABLED=false`. Aucun secret serveur n'est utilisé par le front.
Le pré-rendu normal du build lit les articles publics existants ; il ne modifie aucune donnée.

Attendus : reçu payé → montant/devise/UUID corrects ; annulation → zéro conversion ;
rechargement → aucune nouvelle transaction ; refus et ancien cookie → zéro balise et conversion ;
DIAGIA simulé → `119 EUR`, jamais `149` ou `1` ; session d'autrui et paiement test → aucun reçu.
Vérifier également retrait du consentement, stockage indisponible, balise indisponible
et maintien de l'accès au site. Les preuves et résultats exécutés sont dans
`output/google-ads-achats-20261002/rapport-coordinateur.md` (rapport local non versionné).

## Activation future — accord Thierry requis

1. Enregistrer et pousser le lot sur sa branche dédiée, selon l'accord Git de Thierry.
   Attendre les contrôles CI du nouveau SHA, puis obtenir les accords distincts pour
   créer la demande de fusion, la fusionner et publier. Ne pas déduire une publication du push.
   Conserver les réglages désactivés confirmés par Thierry : conversions améliorées,
   détection automatique des données utilisateur et interactions de formulaires.
   Aucun changement du compte Google n'est nécessaire dans ce lot ; obtenir un accord
   distinct si une modification ultérieure devient nécessaire.
2. Publier la fonction `get-purchase-conversion-receipt` avec JWT vérifié, après contrôle
   du schéma réellement déployé et des autorisations. Réutiliser uniquement les variables
   serveur sécurisées existantes ; ne jamais embarquer la clé service role dans le frontal.
   Ne pas modifier les migrations ni redéployer les fonctions de paiement existantes.
3. Préparer la compilation du frontal avec le flag désactivé pour les contrôles prépublication.
   Le contrôle HTTP isolé du reçu est terminé. Avant activation, contrôler en plus
   le gateway JWT et les réponses de la plateforme cible après autorisation de son déploiement.
   Après accord explicite de publication et d'activation, compiler le frontal avec
   `VITE_GOOGLE_ADS_PURCHASE_ENABLED=true` ; ce flag Vite nécessite une nouvelle compilation,
   ce n'est pas un interrupteur runtime. Ne jamais changer les clés Stripe ni les promotions.
   Préparer le plan SFTP différentiel exact, zéro suppression et aucun transfert de MP4,
   avec sauvegarde des seuls fichiers remplacés, puis faire valider ce plan avant transfert.
   Respecter son ordre : assets versionnés vérifiés d'abord, documents HTML/shell en dernier ;
   contrôler les hashes et les headers HTTP réellement servis, sans se fier au seul build local.
4. Contrôler les requêtes réellement servies, le consentement, la balise unique et le reçu.
   Une publication du seul frontal sans fonction valide ne doit rien compter.
5. Retour arrière : remettre le flag à `false` dans la release front validée ou restaurer
   les fichiers précédents selon le plan de sauvegarde. Aucun changement de données métier à annuler.

## Vérification dans Google Ads — sans conversion fictive de production

Cette procédure n'a pas été exécutée dans le compte Google Ads.

1. Ouvrir le compte **248-573-7298**, puis Objectifs → Conversions et l'action **Achat**.
   Vérifier la destination exacte ci-dessus, la source Site Web, les valeurs dynamiques,
   la devise et le comptage adapté aux achats. Vérifier qu'une conversion basée seulement sur
   l'URL de confirmation ou un import GA4 du même achat ne crée pas un second comptage.
   Relever les réglages ; ne modifier ni action, ni campagne, ni budget sans accord.
   Vérifier spécialement l'absence de collecte automatique des données de formulaires :
   l'absence de `user_data` dans notre code ne garantit pas, à elle seule, les réglages du compte.
2. Après publication autorisée, utiliser Tag Assistant pour contrôler la balise unique
   et le consentement. Refus : aucune balise ni conversion ; accord : balise autorisée.
   Les commandes de personnalisation et d'audience restent refusées.
3. Pour contrôler les paramètres de conversion sans statistiques de production,
   rester dans le dispositif local à transport simulé. **Ne pas** envoyer un faux reçu
   « live » à la destination Achat et ne pas compter un paiement Stripe test.
4. L'attribution réelle se vérifie sur une vente légitime future, consentie et réellement payée,
   sans provoquer un achat artificiel : montant net, EUR, UUID stable, puis état de l'action
   et valeur enregistrée. Vérifier le retour après rechargement et l'absence de doublon.
   L'acceptation d'une commande `gtag` ou Tag Assistant seul ne prouve pas une vente attribuée.
5. Distinguer les trois jalons : **préparé localement**, **déployé et contrôlé**,
   **mesure réelle vérifiée dans Google Ads**. Un délai de traitement Google peut s'appliquer.

Sources officielles contrôlées le 2 octobre 2026 :

- [Balise et événement Google Ads](https://support.google.com/google-ads/answer/7548399?hl=fr).
- [Dédoublonnage par ID de transaction](https://support.google.com/google-ads/answer/6386790?hl=fr).
- [Modes de consentement](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [Paramètres de la balise Google Ads](https://support.google.com/google-ads/answer/13438166?hl=fr).
- [Conversions améliorées et collecte automatique](https://support.google.com/google-ads/answer/13258081?hl=fr).
- [Règles cookies CNIL](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies).
- [Authentification des Edge Functions](https://supabase.com/docs/guides/functions/auth-headers).
