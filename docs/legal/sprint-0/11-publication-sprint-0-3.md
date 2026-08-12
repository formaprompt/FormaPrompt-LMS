# Sprint 0.3 — état de publication du socle juridique

Date de préparation : 12 août 2026.

Ce document consigne les contrôles techniques et la correction locale de la stratégie commerciale. Les incertitudes juridiques sont isolées par composante et par parcours sans supprimer le paiement direct des trois offres.

## 1. Données d'identification

| Donnée | Valeur trouvée | Source dans le dépôt | Publiable | À confirmer |
|---|---|---|---|---|
| Entrepreneur / éditeur | Thierry FREZARD, entrepreneur individuel | `webapp/src/config/site.ts`, pages et documents de formation | oui, cohérent | justificatif RNE récent absent du dépôt |
| Nom commercial | FormaPrompt | configuration du site et documents contractuels | oui | non |
| Adresse professionnelle | 6 rue Webster, 62100 Calais, France | configuration des attestations, administration de formation et pages juridiques | cohérente | justificatif récent absent du dépôt |
| SIREN | 511 151 615 | pages juridiques ; SIRET confirmé par l'attestation CM2C ; registre Sirene public consulté le 12/08/2026 | oui | archiver un avis Sirene récent lors du déploiement |
| SIRET | 511 151 615 00016 | attestation CM2C analysée dans `00-audit-existant.md` et `07-sources-et-validations.md` | oui, vérifié documentairement | non pour l'identifiant ; actualité RNE à contrôler |
| Code APE / NAF | 4791A | ancienne page de mentions légales ; registre public Sirene consulté le 12/08/2026 | oui | changement NAF annoncé pour 2027 à surveiller |
| Déclaration d'activité | 32620346362, préfet de région Hauts-de-France | documents OF, attestations générées et données BPF publiques consultées le 12/08/2026 | oui | archiver le récépissé dans le dossier interne |
| TVA | TVA non applicable - article 293 B du CGI | décision métier de Thierry FREZARD du 12 août 2026 | oui | référence actuelle à conserver jusqu'à demande explicite de modification |
| Courriel | thierry@formaprompt.com | `webapp/src/config/site.ts` et usages publics | oui | non |
| Téléphone | +33 (0)6 12 19 53 81 | pages juridiques | cohérent | justificatif distinct non nécessaire, contrôle propriétaire à effectuer |
| Hébergeur | IONOS SARL, 7 place de la Gare, BP 70109, 57200 Sarreguemines Cedex | mentions existantes et documentation IONOS | oui | produit contractuel exact à archiver |

Aucune contradiction entre deux valeurs du dépôt n'a été trouvée. L'absence de justificatifs récents est distincte d'une contradiction.

## 2. Versions juridiques

Convention retenue :

- `CGV-B2C-2026-08-12` — `/cgv-particuliers` ;
- `CGV-B2B-2026-08-12` — `/cgv-professionnels` ;
- versions publiques datées `2026-08-12` pour les autres pages.

La table `legal_document_versions` accepte les principaux types documentaires. Un déclencheur refuse toute modification ou suppression d'une ligne déjà `published`. Une évolution doit créer une nouvelle version. Aucune ligne de production n'est créée pendant ce sprint local.

## 3. Qualification commerciale avant Stripe

`course_access` reste l'unique système de droits. Les trois offres conservent
`checkoutEnabled: true`. React présente quatre contextes : particulier,
professionnel pour soi, entreprise achetant pour un bénéficiaire et OPCO. La
fonction `create-checkout` recalcule le parcours autorisé, vérifie la version
des CGV et chaque consentement obligatoire, puis crée Stripe pour tout parcours
direct valide. Une valeur inventée ou une preuve incomplète est refusée côté
serveur.

Le particulier utilise les CGV B2C. L'accès immédiat exige des accords séparés
pour les composantes service et numérique ; l'accès différé permet de payer
sans créer immédiatement `course_access`. Les parcours professionnel et
bénéficiaire utilisent les CGV B2B sans consentements consommateurs inutiles.
Le parcours bénéficiaire diffère l'attribution du droit au compte vérifié. Le
parcours OPCO reste un parcours devis/convention distinct.

Une session Stripe ancienne, correctement payée mais dépourvue de `commercial_checkout_intent`, est désormais destinée à `commercial_payment_reviews`. Elle ne crée automatiquement ni achat nouveau ni droit d'accès. Un achat historique déjà enregistré avec le même identifiant de session reste reconnu comme déjà traité.

## 4. Rétractation et accusé durable

L'accusé téléchargeable contient la référence de demande, l'horodatage serveur, l'identité déclarée, la référence de commande, la formation, l'adresse d'accusé et la déclaration reçue. Il précise que la réception ne vaut pas acceptation d'un remboursement.

L'accusé électronique est préparé dans l'Edge Function existante après l'enregistrement en base. Le transport retenu est le SMTP IONOS sur `smtp.ionos.fr:465` avec SSL/TLS. Les secrets restent exclusivement côté serveur sous les noms `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM`. Un échec laisse la demande valide, conserve l'accusé téléchargeable et enregistre un statut `failed` réessayable. La mise en production exige encore de vérifier que `thierry@formaprompt.com` est une boîte IONOS autorisée à envoyer, de configurer ces secrets puis d'effectuer un envoi contrôlé.

Le dépôt ne contient aucun transport d'e-mail transactionnel applicatif. Supabase Auth ne constitue pas un service d'envoi arbitraire. Les secrets SMTP ne peuvent pas être placés dans React.

Option déjà comprise à vérifier sur le contrat IONOS : envoi serveur depuis l'hébergement PHP avec une adresse `@formaprompt.com`, ou SMTP IONOS authentifié (`smtp.ionos.fr`, TLS, port 465). La capacité PHP et la boîte d'envoi doivent être confirmées dans le compte IONOS, puis le secret doit rester hors du dépôt et du répertoire public. Aucun abonnement supplémentaire n'est nécessaire si ces éléments sont inclus dans le contrat actuel.

Tant que cet envoi n'est pas configuré et testé, la base trace honnêtement `acknowledgement_delivery_status = pending_configuration` et l'interface ne prétend pas qu'un courriel a été envoyé.

## 5. Décision locale

La correction commerciale reste locale. Avant toute publication, il faut
publier dans `legal_document_versions` les textes exactement validés, appliquer
la migration additive de contexte commercial, puis déployer ensemble le
frontend, `create-checkout` et le webhook afin d'éviter une incompatibilité de
contrat entre versions.

L'archivage d'un avis Sirene/RNE récent et du récépissé NDA reste recommandé avant la réouverture d'une vente, mais ne bloque pas la publication informative. La situation fiscale actuelle est « TVA non applicable - article 293 B du CGI » et reste la référence FormaPrompt jusqu'à demande explicite de Thierry FREZARD.

La qualification précise des composantes mixtes et les critères du contrat
individuel de formation restent à valider juridiquement offre par offre. Cette
validation ne supprime pas les autres parcours de paiement valides.
