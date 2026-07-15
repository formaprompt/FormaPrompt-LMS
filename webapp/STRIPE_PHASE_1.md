# Stripe Checkout — formation AI Act et déblocage automatique

Cette intégration concerne uniquement la formation `formation-ia-act`, vendue **187 EUR** en paiement ponctuel.
Le passage au **mode réel Stripe** a été autorisé le 14 juillet 2026. Le code accepte le mode test ou réel, mais
refuse tout mélange entre la clé Stripe et le tarif configuré.

## Fonctionnement

1. L'apprenant doit être connecté à son compte FormaPrompt.
2. La page appelle la fonction Supabase `create-checkout` avec le seul identifiant de formation.
3. La fonction vérifie le JWT Supabase, récupère elle-même le `user_id` et contrôle le prix Stripe : actif,
   ponctuel, en euros, dans le même mode que la clé utilisée et égal à 18 700 centimes.
4. Stripe reçoit `client_reference_id`, `metadata.user_id` et `metadata.course_id`.
5. Après le paiement, Stripe envoie `checkout.session.completed` à `stripe-webhook-ai-act`.
6. Le webhook vérifie la signature, la cohérence du mode, le statut payé, le montant, la devise et les métadonnées.
7. Une ligne est ajoutée ou mise à jour de façon idempotente dans `purchases`.
8. Les règles RLS autorisent l'apprenant à lire uniquement ses propres accès. Le tableau de bord et le lecteur
   détectent alors immédiatement la formation AI Act.

Le navigateur ne reçoit jamais la clé Stripe, la clé serveur Supabase ni le montant à facturer. Il ne peut pas
écrire directement dans `purchases`.

## 1. Préparer Stripe

Dans le tableau de bord Stripe, dans le mode correspondant à l'environnement :

1. créer ou ouvrir le produit « IA : acculturation et préparation à la conformité AI Act » ;
2. créer un prix ponctuel de **187,00 EUR** ;
3. copier son identifiant `price_...` ;
4. vérifier les informations publiques de l'entreprise et les liens :
   `https://formaprompt.com/cgv`, `https://formaprompt.com/mentions-legales` et
   `https://formaprompt.com/politique-confidentialite` si cette dernière page est publiée ;
5. laisser Stripe Tax désactivé tant que la situation « TVA non applicable — article 293 B du CGI » est valide.

Le lien CGV doit être renseigné dans les **informations publiques Stripe** avant le test : Checkout affiche une
case d'acceptation obligatoire qui renvoie vers cette URL. La quantité est imposée à 1 par le serveur, les codes
promotionnels et Stripe Tax sont désactivés, et seule la carte est activée pour cette première phase.

## 2. Variables d'environnement

### Application React (`webapp/.env.local`)

| Variable | Contenu | Sensibilité |
|---|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase | publique |
| `VITE_SUPABASE_ANON_KEY` | clé publique/anon Supabase | publique, protégée par RLS |

Ne jamais placer une clé Stripe ou une clé `service_role` dans une variable préfixée par `VITE_` : elle serait
incluse dans le code envoyé au navigateur.

### Fonctions Supabase

| Variable | Contenu | Sensibilité |
|---|---|---|
| `STRIPE_SECRET_KEY` | clé secrète Stripe correspondant à l'environnement (`sk_test_...` ou `sk_live_...`) | secrète |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | secret de signature `whsec_...` du webhook du même environnement | secrète |
| `STRIPE_AI_ACT_PRICE_ID` | identifiant du prix de 187 EUR du même environnement | configuration serveur |
| `SITE_URL` | `https://formaprompt.com` en ligne | configuration serveur |

Supabase fournit automatiquement aux fonctions hébergées `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY`. Cette dernière ne doit jamais être copiée dans le site React.

Les secrets peuvent être renseignés dans **Supabase > Edge Functions > Secrets**. Pour un test local, copier
`supabase/functions/.env.example` vers `supabase/functions/.env.local` et remplacer uniquement les valeurs
d'exemple. Le fichier local est ignoré par Git.

## 3. Installer la base et déployer les fonctions

La CLI Supabase n'était pas installée sur le poste lors de l'intégration. Deux possibilités :

- exécuter le contenu de `supabase/migrations/20260713120000_create_stripe_purchases.sql` dans l'éditeur SQL
  Supabase ;
- ou installer/configurer la CLI, lier le projet, puis appliquer la migration selon le processus Supabase retenu.

Avant l'exécution, cette requête permet de repérer d'éventuels doublons historiques qui empêcheraient la création
de l'index unique :

```sql
SELECT user_id, course_id, count(*)
FROM public.purchases
GROUP BY user_id, course_id
HAVING count(*) > 1;
```

Ne supprimer ni fusionner automatiquement ces lignes : vérifier d'abord les achats concernés.

Déployer ensuite :

```powershell
# À lancer dans C:\Users\Thier\OneDrive\Documents\formation\Formaprompt\webapp
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook-ai-act --no-verify-jwt
```

L'option publique du webhook est également déclarée dans `supabase/config.toml`. La sécurité de ce point d'entrée
repose sur la signature Stripe vérifiée à partir du corps brut de la requête.

## 4. Configurer le webhook Stripe

Créer un point de terminaison Stripe dans le même mode que le prix et la clé :

```text
https://PROJECT_REF.supabase.co/functions/v1/stripe-webhook-ai-act
```

Sélectionner uniquement l'événement :

```text
checkout.session.completed
```

Copier ensuite le secret `whsec_...` de ce point de terminaison dans
`STRIPE_WEBHOOK_SIGNING_SECRET`. Le secret d'un `stripe listen` local est différent du secret du webhook hébergé.

## 5. Tests avant ouverture au public

Tests locaux disponibles :

```powershell
# À lancer dans C:\Users\Thier\OneDrive\Documents\formation\Formaprompt\webapp
npm run test:stripe
npm run lint
npm run build
```

Le test unitaire vérifie notamment le refus d'un montant différent, d'un paiement non confirmé, d'un autre cours
et d'un `user_id` incohérent.

Pour valider le parcours complet après déploiement :

1. valider d'abord le parcours en mode test/sandbox Stripe ;
2. créer un compte apprenant de test sur FormaPrompt et se connecter ;
3. ouvrir la page AI Act, puis « Acheter la formation — 187 € » ;
4. utiliser exclusivement une carte de test Stripe, jamais une vraie carte ;
5. vérifier la redirection vers `/paiement-reussi` ;
6. vérifier dans Stripe que l'événement `checkout.session.completed` reçoit une réponse HTTP 200 ;
7. vérifier dans Supabase la ligne `purchases` et l'accès `/course/formation-ia-act` ;
8. relivrer le même événement depuis Stripe : aucune deuxième ligne ne doit être créée.

## RGPD et passage ultérieur en production

Stripe reçoit l'identifiant technique du compte, l'adresse e-mail et le téléphone demandé pour personnaliser le
suivi pédagogique. L'adresse postale n'est pas imposée par FormaPrompt. Le téléphone est enregistré dans Supabase
et visible uniquement par l'apprenant concerné et l'administration ; il ne doit pas être utilisé pour de la
prospection sans consentement distinct. Il faut documenter Stripe comme destinataire/sous-traitant et définir une
durée de conservation des données d'achat, de facturation et de suivi.

Avant l'ouverture au public, valider les CGV et le droit de rétractation, la facturation, la TVA, la politique de
confidentialité, la supervision des webhooks, la procédure de remboursement et la rotation des secrets.
