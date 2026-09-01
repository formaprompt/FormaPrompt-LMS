# LOT 1G — Validation PostgreSQL sur runner GitHub Actions

## Finalité

Le PostgreSQL natif Windows n'est pas disponible et les tentatives locales WSL/Docker ne sont pas relancées. Le workflow manuel `LOT 1G PostgreSQL validation` prépare donc une validation réelle sur un runner GitHub Ubuntu éphémère. Docker s'exécute uniquement sur ce runner GitHub, jamais sur le PC de Thierry. Le workflow ne lève la dette PostgreSQL qu'après une exécution GitHub effectivement réussie.

Cette infrastructure ne contacte aucun projet Supabase distant et n'utilise aucune ressource Stripe. Elle ne demande aucun secret GitHub, aucun project ref, aucun jeton Supabase et aucune clé de production.

## Déclenchement et périmètre

Le fichier `.github/workflows/promotion-postgres-validation.yml` utilise uniquement `workflow_dispatch`. La validation PostgreSQL a été retirée de la CI applicative automatique afin que ce traitement Docker/Supabase plus lourd ne démarre pas sur chaque push ou pull request avant sa première validation contrôlée.

Le job utilise :

- `actions/checkout@v5` ;
- `supabase/setup-cli@v3` avec la version stable et reproductible `2.116.0` de la CLI ;
- le PostgreSQL Supabase local du runner sur `127.0.0.1:54322` ;
- un timeout global de 35 minutes ;
- `supabase stop --no-backup` dans une étape exécutée même après échec.

Les variables de connexion distante (`SUPABASE_ACCESS_TOKEN`, mot de passe, project ref/id ou URL de base externe) sont explicitement refusées si elles sont présentes. Aucune commande `link`, aucun push de base et aucun déploiement de fonction ne fait partie du workflow.

La sortie standard de `supabase start`, qui peut contenir les identifiants locaux éphémères de la stack, est masquée. Les erreurs de démarrage restent visibles sans qu'aucun identifiant de production ne soit disponible dans le job.

## Initialisation de la base

Le job reprend le bootstrap local existant du dépôt :

1. mise à l'écart temporaire des migrations suivies ;
2. démarrage de la stack Supabase locale vierge ;
3. chargement de `supabase_schema.sql` ;
4. ajout du socle historique minimal `calendar_bookings` et du bucket local `blog-images` ;
5. restauration des migrations suivies ;
6. application de toutes les migrations avec `supabase migration up --local --include-all` ;
7. affichage de la liste locale des migrations appliquées ;
8. inventaire statique des assertions, puis exécution pgTAP réelle.

`supabase db reset --local` n'est pas utilisé ici : l'historique Git commence après un schéma FormaPrompt déjà existant (`supabase_schema.sql`, `calendar_bookings` et bucket local). Un reset Supabase standard supprimerait ce socle avant de rejouer les migrations et ne reproduirait donc pas l'ordre historique réel du dépôt. Le runner étant neuf, la séquence ci-dessus construit déjà une base vide, charge explicitement ce socle antérieur puis applique chaque migration suivie dans l'ordre. Aucune migration cassée n'est ignorée.

Une migration historique en erreur fait échouer le job. Le workflow ne masque ni ne corrige un écart antérieur au LOT 1G.

## pgTAP

`supabase test db --local` exécute toutes les suites SQL de `supabase/tests` contre le PostgreSQL réel du runner, chaque fichier pgTAP dans sa propre transaction. Les quatre suites LOT 1G attendues contiennent statiquement :

| Sous-lot | Fichier | Assertions présentes |
|---|---|---:|
| 1G-A | `promotion_engine.sql` | 78 |
| 1G-B | `diagnostic_promotion_integration.sql` | 43 |
| 1G-C | `course_promotion_integration.sql` | 53 |
| 1G-D | `promotion_administration.sql` | 56 |
| **Total** | | **230** |

Le script `verify_promotion_pgtap_counts.sh` protège uniquement cet inventaire. Il ne transforme jamais la présence des assertions en résultat PASS. À ce stade, **0 assertion a été exécutée sur PostgreSQL réel**.

## Validations runtime complémentaires

`promotion_runtime_security.sql` s'exécute dans une transaction annulée et vérifie notamment :

- `ENABLE ROW LEVEL SECURITY` et `FORCE ROW LEVEL SECURITY` sur les trois tables promotionnelles ;
- l'absence d'accès direct excessif pour `anon` et `authenticated` ;
- les ACL des RPC serveur réservées à `service_role` ;
- les ACL, le propriétaire, `SECURITY DEFINER` et le `search_path` vide des quatre RPC d'administration ;
- le refus serveur d'un utilisateur authentifié non-admin ;
- l'accès d'un strict admin aux quatre opérations et la production de l'audit attendu ;
- l'inaccessibilité des helpers privés d'administration.

`promotion_engine_concurrency.sh` emploie des transactions simultanées dans des processus `psql` distincts. Il observe dans `pg_stat_activity` que la seconde session attend réellement un verrou PostgreSQL pendant que la première conserve sa transaction, puis contrôle l'état final :

- dernier usage global avec `max_uses = 1` ;
- dernier usage par utilisateur avec `max_uses_per_user = 1` ;
- deux codes différents pour un même contexte idempotent ;
- double préparation Diagnostic, double consommation et double libération ;
- même `checkout_request_id` formation, avec une seule intention, un seul jeu de consentements et une seule réservation ;
- absence de nouveau `purchase` et de nouveau `course_access` avant paiement confirmé ;
- réservation formation couvrant encore plus de 34 minutes après la concurrence, conformément au tampon de 35 minutes.

Ces scénarios n'appellent ni Stripe, ni Calendar, ni Meet. Les durées Checkout applicatives de 31 minutes et la convergence après erreur Stripe ambiguë restent couvertes par les tests serveur à mocks ; le job PostgreSQL ne contacte pas Stripe.

Le script force lui-même `127.0.0.1:54322`, l'utilisateur et le mot de passe standard de la stack locale, neutralise les URL/service files hérités et impose des délais de connexion, de requête et de verrou. L'étape entière est également limitée à cinq minutes afin qu'un verrou inattendu ne bloque pas le job complet.

## Résultats et critères PASS

Le workflow réussit uniquement si :

- Supabase local démarre sur le runner ;
- toutes les migrations suivies s'appliquent réellement ;
- toutes les suites pgTAP du dépôt réussissent, dont les 230 assertions LOT 1G ;
- les contrôles RLS/ACL/propriétaires/`SECURITY DEFINER` réussissent ;
- tous les scénarios concurrents convergent vers l'état attendu.

Les sorties texte non sensibles sont conservées sept jours comme artefact GitHub Actions. Une erreur de migration, une assertion en échec, un privilège inattendu ou une race non sérialisée fait échouer le job.

Le premier run doit être lancé explicitement depuis l'onglet Actions après un futur push autorisé. Il peut légitimement échouer sur une migration historique : ce résultat devra être traité comme un blocage réel, sans correction artificielle ni contournement. Vérifier également avant ce futur push qu'aucune règle de protection de branche ne dépend encore du nom de l'ancien job automatique `Local migrations and pgTAP`.

## Dette restante avant exécution

Cette préparation locale n'est pas une exécution PostgreSQL. Avant tout déploiement du moteur promotionnel, une exécution manuelle réussie du workflow reste obligatoire afin de valider réellement migrations, PL/pgSQL, transactions, verrous, concurrence, RLS, ACL, propriétaires et privilèges.

Aucun déploiement, aucun accès Supabase distant, aucune ressource Stripe LIVE et aucun paiement réel ne sont réalisés par cette infrastructure.
