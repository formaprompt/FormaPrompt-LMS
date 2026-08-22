# Plan de déploiement Sprint 4

Ce plan ne vaut pas autorisation de déploiement. Il s’applique uniquement après validation explicite de Thierry FREZARD.

## Périmètre exact

- branche : `feat/sprint-4-of-opco-exceptions` ;
- migration unique : `20260822082342_sprint_4_of_opco_exceptions.sql` ;
- Edge Function mise à jour : `admin-manage-enrollment` ;
- frontend : build du commit Sprint 4 validé, limité au répertoire `/Formaprompt` ;
- aucun changement Stripe, SMTP, média, remboursement ou cockpit.

## Captures avant déploiement

1. Vérifier le commit déployable et un arbre Git propre.
2. Capturer l’historique des migrations et la version de `admin-manage-enrollment`.
3. Relever les compteurs de `training_enrollments`, `training_documents`, `purchases` et `course_access`.
4. Archiver `/Formaprompt` sur IONOS et calculer son SHA-256.
5. Archiver la source actuellement déployée de `admin-manage-enrollment`.

## Ordre coordonné

1. Appliquer exclusivement `20260822082342_sprint_4_of_opco_exceptions.sql`, sans `db push` global.
2. Vérifier les colonnes, contraintes, index, RLS, politiques et triggers append-only.
3. Confirmer que les compteurs et statuts de `purchases` et `course_access` sont inchangés.
4. Déployer `admin-manage-enrollment`, puis tester authentification, refus des mutations directes et actions contrôlées.
5. Construire le frontend depuis le commit validé et publier uniquement `/Formaprompt`, sans retransférer les médias inchangés.

## Contrôles après déploiement

- financement demandé, accordé, partiel, refusé et reste à charge ;
- annulation, report, transfert et abandon avec motif et historique ;
- avenant numéroté, versionné, figé et imprimable ;
- conservation des versions documentaires antérieures ;
- filtres et recherche sur ordinateur et à 390 px ;
- isolation RLS et refus d’une manipulation frontend ;
- `course_access` demeure l’unique source de droits et aucun statut suspendu, révoqué, remboursé ou expiré n’est réactivé ;
- paiements directs des trois formations, `automatic_tax:false`, webhook, rétractation, SMTP, RGPD, Qualiopi, HIBP et contenus payants inchangés.

## Rollback

- restaurer immédiatement la version précédente de l’Edge Function en cas d’échec serveur ;
- restaurer `/Formaprompt` depuis l’archive si le frontend régresse ;
- conserver la migration additive si des données réelles ont été créées et corriger en avant ;
- ne supprimer aucune preuve, inscription, donnée commerciale, version documentaire, ligne `purchase` ou `course_access` ;
- ne déclencher aucun remboursement et ne modifier ni Stripe ni SMTP.
