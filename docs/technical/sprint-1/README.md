# Sprint 1 — Accès, incidents et journal d’audit

État au 11 août 2026 : implémentation et validation locales terminées. La migration n’a pas été appliquée au projet Supabase de production et aucun déploiement IONOS n’a été réalisé.

## Architecture retenue

### Droits d’accès

La table existante `course_access` reste l’unique source des droits LMS.

- `status` accepte `active`, `suspended`, `revoked`, `refunded` et le statut historique `expired`.
- `completed` est exclu : la fin pédagogique ne retire pas le droit d’accès.
- `expires_at IS NULL` signifie qu’aucune échéance n’est prédéfinie ; l’accès reste conditionné par l’utilisateur, la formation et un statut ouvert.
- `status_changed_at` trace la date serveur du dernier changement.
- `suspension_ends_at` permet d’indiquer une fin prévisionnelle sans réactivation automatique.
- La progression, les évaluations, les présences, les preuves et les dossiers OF/OPCO ne sont jamais supprimés par une suspension ou une révocation.

Les changements sensibles passent par des fonctions `SECURITY DEFINER` qui vérifient le rôle `admin` côté PostgreSQL :

- `admin_change_course_access` ;
- `admin_grant_course_access` ;
- `admin_create_disciplinary_incident` ;
- `admin_update_disciplinary_incident` ;
- `admin_save_disciplinary_hearing`.

Les webhooks Stripe et l’attribution OF/OPCO ne recréent plus un droit déjà présent : une relivraison ne peut donc pas réactiver silencieusement un accès suspendu, révoqué ou remboursé. Aucun automatisme de remboursement n’est ajouté.

### Incidents et discipline

Nouvelles tables :

- `incident_categories` : catégories configurables, sans sanction automatique ;
- `disciplinary_incidents` : apprenant, formation, session éventuelle, faits, signalement, catégorie, gravité, état du dossier, décision humaine, mesures, dates et responsables ;
- `disciplinary_hearings` : convocation, date, modalité, lien Meet/Teams externe, observations, assistance et compte rendu.

`incident_status` et `disciplinary_outcome` restent séparés. Une mesure conservatoire peut être reliée à un incident et suspendre l’accès, mais elle n’est jamais une sanction définitive. Une exclusion disciplinaire reste une décision humaine ; la révocation technique est une conséquence distincte et explicitement tracée.

Les pièces disciplinaires, leur bucket privé et leurs URL signées sont reportés : aucun stockage de pièce n’a été créé dans ce sprint.

### Journal d’audit

La table `audit_log` enregistre notamment l’auteur, l’action, la cible, l’apprenant, la formation, le motif, l’état précédent, le nouvel état, les métadonnées et un timestamp serveur.

- Les insertions sont produites par les fonctions et déclencheurs contrôlés.
- `UPDATE`, `DELETE` et `TRUNCATE` ne sont pas accordés aux rôles ordinaires.
- Des déclencheurs refusent en plus les modifications et suppressions directes.
- Le dispositif est décrit comme append-only raisonnablement protégé, pas comme infalsifiable.

Sont tracés : attribution, suspension, réactivation, révocation, création et évolution d’incident, décision/clôture, mesure conservatoire et entretien disciplinaire.

## RLS et confidentialité

- Les apprenants ne voient que leurs propres lignes `course_access` compatibles avec les politiques existantes.
- Les incidents, entretiens et journaux d’audit sont invisibles aux apprenants et à `anon`.
- Les opérations disciplinaires et les changements de droit sont réservés au rôle strict `admin` côté base.
- Le rôle `employee` ne peut pas signaler ni décider dans le Sprint 1 ; une ouverture limitée du signalement est reportée.
- L’interface React complète ces contrôles mais ne constitue pas la barrière de sécurité.

Les contenus payants actuellement intégrés au bundle JavaScript public ne bénéficient pas d’une confidentialité absolue. Dette technique : **Sécurisation serveur des contenus de formation payants**, avec récupération après authentification et contrôle de `course_access`.

## Préparation Qualiopi et Sprint 1.1

L’architecture permet de tracer incidents, discriminations, harcèlement, violences, mesures, décisions, suivi et une référence vers une future action corrective. Elle ne traite pas le projet réglementaire annoncé pour novembre 2026 comme un texte définitivement applicable.

Sont reportés au Sprint 1.1 :

- pièces disciplinaires et stockage privé ;
- registre complet des risques qualité ;
- actions correctives avancées et mesure d’efficacité ;
- signalement limité au rôle `employee` ;
- durées de conservation configurables après validation juridique ;
- intégration Stripe explicite des remboursements ;
- workflow RGPD d’effacement/anonymisation.

## Préparation du futur workflow RGPD

Le Sprint 1 ne crée ni bouton `DELETE USER`, ni cascade globale, ni purge automatique, ni statut `erasure_request_pending`. Le futur traitement devra analyser les dépendances avant toute décision et produire l’un des diagnostics suivants :

- `EFFACEMENT COMPLET POSSIBLE` ;
- `EFFACEMENT PARTIEL / ANONYMISATION NÉCESSAIRE` ;
- `CONSERVATION JUSTIFIÉE`.

### Matrice de dépendances actuelle

| Domaine | Relations actuelles | Orientation future à valider |
|---|---|---|
| Auth et profil | `profiles` est lié à `auth.users` en cascade | Supprimable si aucune autre donnée ne justifie une conservation |
| Droits et réservations simples | `course_access`, demandes, séances et positionnements sont principalement en cascade | Supprimables dans le cas d’une inscription erronée sans activité ni obligation |
| Progression de leçons | cascade depuis `auth.users` | Supprimable s’il n’existe aucune preuve à conserver |
| Achats | `purchases` bloque implicitement la suppression Auth | Vérifier paiement, facture, obligations comptables et défense de droits ; anonymiser ou conserver si justifié |
| Exercices, évaluations, corrections | plusieurs relations `RESTRICT` | Analyse pédagogique et juridique avant suppression ou pseudonymisation |
| Émargements et audit de présence | relations `RESTRICT` | Conservation potentiellement requise comme preuve ; anonymisation contrôlée à étudier |
| Attestations | relations `RESTRICT` | Conservation/anonymisation selon obligation et preuve délivrée |
| OF/OPCO et documents | relations `RESTRICT` | Conserver ou anonymiser selon dossier, financement et obligations documentaires |
| Satisfaction | utilisateur en `SET NULL` | Détachable, mais vérifier les champs textuels et métadonnées |
| Incidents et entretiens | apprenant, déclarant et auteur en `RESTRICT` | Le blocage impose une décision explicite ; prévoir pseudonyme technique ou anonymisation contrôlée, jamais une cascade silencieuse |
| Audit transverse | acteur et utilisateur cible en `SET NULL`, mais UUID et états JSON peuvent subsister | Définir les données strictement nécessaires, la base de conservation et une stratégie d’anonymisation sans réécriture silencieuse de l’historique |

Une personne inscrite par erreur, sans achat, accès utile, progression, présence, évaluation, document, incident ni autre preuve, doit pouvoir être déclarée éligible à un effacement complet par ce futur diagnostic. Les contraintes `RESTRICT` sur les preuves et incidents rendent l’effacement non automatique lorsqu’un motif de conservation peut exister ; elles n’empêchent pas une future migration d’anonymisation contrôlée.

Workflow cible documenté : demande → vérification d’identité si nécessaire → inventaire des dépendances → aperçu → décision humaine → confirmation administrateur → suppression/anonymisation/conservation → journal de traitement → confirmation à la personne.

## Validation locale

Environnement : Docker Engine directement dans WSL, Supabase CLI local, snapshot du schéma existant, aucune écriture distante.

- Migration depuis le snapshot : réussie.
- Lint PostgreSQL `public,private` : aucune erreur.
- pgTAP : 26/26 assertions réussies, dont les scénarios A à J.
- Test critique serveur/RLS : `expires_at IS NULL` + `status = suspended` → écriture/lecture de contenu refusée (`42501`).
- Auth/REST local : isolation entre apprenants, incidents et audit invisibles à l’apprenant, modification de l’audit refusée.
- Edge local : attribution initiale `201`, suspension `200`, nouvelle attribution `409`, statut suspendu conservé.
- Tests applicatifs : 49/49.
- Tests Stripe et OF/OPCO : 21/21.
- Tests Studio : 106/106.
- TypeScript : réussi.
- ESLint : réussi.
- Build et pré-rendus : réussis.
- Playwright desktop/mobile : 49 réussis, 3 ignorés volontairement par la matrice, aucun échec.
- Contrôle navigateur réel : administration, confirmation contextuelle, registre d’incidents, message apprenant neutre, refus de l’administration à l’apprenant, absence de débordement mobile et absence d’erreur console.

## Déploiement et retour arrière

La migration reste non appliquée en production. Un retour arrière local raisonnable consiste à restaurer le snapshot ou réinitialiser la base locale. En production, une éventuelle migration corrective devra préserver les données d’audit et d’incident ; aucune suppression automatique de ces tables ne doit être utilisée.
