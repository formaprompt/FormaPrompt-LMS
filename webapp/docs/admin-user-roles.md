# Gestion administrative des rôles — préparation locale

Ce lot ajoute une gestion des rôles existants `user` (inscrit), `employee` (formateur / collaborateur) et `admin`. Il ne change pas les droits attachés à `employee` dans le reste du LMS.

## Contrat

`public.admin_set_user_role(p_user_id uuid, p_role text, p_expected_role text)` renvoie `{ userId, role, protected, changed }`. Seul un compte dont `public.profiles.role` vaut actuellement `admin` peut appeler cette opération. Le rôle est relu sous verrou ; aucune métadonnée JWT ne fait autorité. L'ancien rôle attendu évite d'écraser une modification concurrente.

- `42501` : accès refusé ou compte propriétaire protégé (messages distincts).
- `22023` : UUID/rôle attendu/rôle demandé invalide ou absent.
- `40001` : rôle attendu devenu obsolète ; actualiser la liste.
- `P0002` : profil cible absent.

Le wrapper public est `SECURITY INVOKER`. L'opération privilégiée est dans `private`, avec chemin de recherche vide, noms qualifiés, révocation PUBLIC/anon/service_role et accès `authenticated` uniquement avec garde interne. Le schéma `private` doit rester absent des schémas exposés dans la Data API.

## Protection du propriétaire

La migration identifie uniquement `auth.users.email = thierry227@gmail.com` (insensible à la casse), puis conserve son UUID dans `private.admin_role_owner`. Aucun lien avec `profiles.email`, les métadonnées ou un jeton. L'UUID n'a pas de clé étrangère susceptible d'effacer la protection. La protection persiste après changement de l'email Auth et interdit d'attribuer l'adresse canonique à une autre identité.

Avant toute installation future autorisée en production, vérifier manuellement l'identité Auth canonique, son UUID et son profil déjà administrateur. La migration refuse un propriétaire existant sans profil `admin` ; elle n'attribue aucun rôle. Une base fictive vierge sans propriétaire passe. Pour un propriétaire créé ultérieurement, la création du profil `user` reste possible ; un administrateur doit le promouvoir explicitement, sans autopromotion.

Un trigger sur `profiles` refuse la rétrogradation et la suppression du propriétaire, y compris par `service_role`. Un trigger Auth refuse la suppression ou le remplacement de l'UUID propriétaire et fige l'ancrage. Les créations ordinaires de profils et les maintenances de profils non propriétaires sans session utilisateur restent possibles. Les administrateurs ordinaires peuvent rétrograder d'autres administrateurs ou eux-mêmes ; une session conservée après rétrogradation est refusée au prochain appel.

Ces gardes portent sur les écritures applicatives et les rôles techniques usuels. Un superutilisateur PostgreSQL capable de supprimer/désactiver les triggers ou modifier leur définition reste hors de cette garantie.

## Concurrence et journal

La RPC verrouille les lignes acteur et cible dans l'ordre des UUID avant de relire le rôle acteur et le rôle attendu. La transaction conserve les verrous jusqu'à sa fin. Les écritures directes sont contrôlées par un trigger qui verrouille aussi l'acteur ; des écritures directes à plusieurs lignes peuvent provoquer un deadlock PostgreSQL, qui annule une transaction plutôt que d'autoriser une décision obsolète.

Le journal existant `public.audit_log` reçoit uniquement acteur, cible, ancien et nouveau rôle pour chaque changement effectif (`profile_role_changed`). Aucun nouvel email ni contenu pédagogique n'y est copié. Les appels sans changement ne créent pas de ligne. Sa politique de conservation et les analyses RGPD existantes s'appliquent ; leur validation relève de l'organisme avant mise en production.

`admin_list_learners` conserve son contrat existant et ajoute un booléen `protected` fondé sur l'identité serveur. L'interface doit se fier à ce champ ; une comparaison d'email est seulement une prudence visuelle.

## Vérification locale

Fichier migration créé par `supabase migration new admin_user_roles` : `20261010144659_admin_user_roles.sql`.
Test fictif transactionnel : `supabase/tests/admin_user_roles.sql` (rollback final). Il couvre les permissions, les rôles existants, le propriétaire, les écritures directes, les emails et métadonnées falsifiés, l'idempotence, le journal et les décisions obsolètes. Le contrôle de concurrence exige deux sessions indépendantes avec suspension sur verrou, réalisé séparément par QA.

Aucune migration distante, aucune modification de rôles réels et aucune publication ne font partie de ce lot.

L'identifiant profiles.id est immuable. Toute suppression de profil avec une session utilisateur exige aussi un administrateur relu sous verrou. Les mises a jour Auth ordinaires ne verrouillent pas l'ancrage proprietaire.

## Résultat des contrôles locaux du 10 octobre 2026

QA indépendant : 40/40 contrôles SQL réussis sur PostgreSQL 17, dans une base fictive neuve. Les contrôles avec deux sessions ont vérifié la révocation de l'acteur pendant l'attente, le conflit sur le rôle attendu, les changements entre administrateurs et l'absence de verrou global sur les mises à jour Auth ordinaires. Migration contrôlée : SHA-256 `486C98E03D5813E91269BD3F58F72F1BF3D076888FA729873AF9656A92BCE915`.

Le fichier pgTAP `supabase/tests/admin_user_roles.sql` n'a pas été exécuté : l'extension pgTAP est absente de l'installation PostgreSQL native utilisée. Les 40 contrôles exécutés sont ceux du banc SQL indépendant ; ils ne prouvent pas une exécution du fichier pgTAP ni de toutes les migrations historiques. Le cluster de test a été arrêté. Aucun service distant n'a été contacté pour ces contrôles.
