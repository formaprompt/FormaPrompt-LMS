# Disponibilités croisées — correctif local du 19 octobre 2026

État : correctif applicatif local uniquement. Une sonde privée distincte, explicitement autorisée, a validé en lecture seule les accès Google réels le 19 octobre à 12 h 13 Paris, puis a été retirée. Aucun changement OAuth/ACL, migration distante, publication du correctif, commit ou push.

## Comportement

Le serveur contrôle les deux calendriers primaires explicitement identifiés (professionnel et personnel), avec l'OAuth professionnel déjà prévu. Le credential serveur existant a réellement accédé à FreeBusy pour les deux primaires et la destination professionnelle. Il n'existe aucun repli vers « libre » lors d'une panne.

La destination des événements demeure le calendrier professionnel secondaire existant. Les fonctions communes refusent toute lecture d'événement ou écriture vers un autre calendrier, notamment le primaire personnel et l'alias ambigu primary. Les autres calendriers secondaires ne sont pas agrégés.

Les réponses client contiennent uniquement les créneaux métier, leurs occupations ou un état temporairement indisponible. Aucun titre, description, lieu ni participant personnel n'est demandé. Le seul Events.list concerne la destination professionnelle, avec projection id/start/end/status/transparency et pagination complète : il ignore un événement propre uniquement si son identifiant et ses dates correspondent aux données serveur. Il conserve tout autre événement au même horaire ; aucune soustraction d'intervalle FreeBusy fusionné.

## Parcours couverts

- Lecture public OF : occupations OF, learner_calendar_blocks et Google, à la demi-journée selon la limite métier existante de 13 h Paris.
- Réservation OF et confirmation administrateur : nouveau manage-calendar-booking avec request_id stable.
- Formations individuelles : affichage get-unified-availability et contrôle de toutes les séances avant réservation.
- Présentiel : approbation de distance via create-course-booking/admin_decision ; contrôle supplémentaire avant ouverture du paiement déplacement. Prix, paramètres Stripe, droits et webhook conservés.
- Cohortes : sauvegarde, publication, confirmation, inscription et inscription administrative créativité ; contrôle des séances et récupération des événements propres lors de génération Meet.
- Diagnostic payé : disponibilité, réservation, reprise et déplacement administratif ; maintien des contrôles paid/propriétaire/consentement/claim/finalisation et identifiant Google déterministe.

Les contrôles SQL métier existants continuent à décider des droits, durées et formats. Une preuve serveur opaque, de courte durée et liée au snapshot exact des créneaux, conditionne les mutations protégées. La même preuve exécutée une seconde fois restitue son résultat initial. Pour une réservation OF, réutiliser request_id après un résultat réseau incertain.

## Délais et bornes

Affichage : cache mémoire maximal 30 secondes, clé incluant calendriers/intervalles/événements propres, uniquement après réponse complète. Une seule fenêtre FreeBusy enveloppe les séances affichées. Confirmation : aucun cache, intervalles exacts fusionnés seulement s'ils se touchent, concurrence maximale de quatre appels externes. Chaque requête Google est bornée à huit secondes ; une preuve expirée échoue sans réserver.

Les plages d'affichage sont limitées à 93 jours par requête. Cela ne crée aucune limite commerciale : le metadata booking_horizon retourne des fenêtres contenant les créneaux effectivement publiés par l'administrateur, y compris au-delà d'un an. Le client ne présente l'ensemble qu'après réussite de toutes ces fenêtres. Les dates doivent comporter un fuseau explicite ; les frontières journalières utilisent Europe/Paris, y compris au changement d'heure.

## Paiement et incidents

Un conflit retourne 409. Une réponse Google partielle, une configuration invalide, un refus de permission, une panne ou un JSON invalide retourne 503/CALENDAR_UNAVAILABLE. Une commande payée reste payée lorsque sa réservation échoue ; l'erreur de synchronisation reste traçable. Une revendication diagnostic est libérée seulement avant toute tentative de création Google. Après une réponse de création incertaine, elle est conservée pour retrouver l'événement déterministe et éviter le doublon.

Google et PostgreSQL ne partagent pas de transaction. Un événement ajouté extérieurement après le dernier contrôle reste possible ; le correctif ne garantit pas d'atomicité entre ces services.

## Configuration et livraison ultérieure

Les noms serveur sont documentés dans .env.example sans valeurs sensibles. Aucun nom serveur ne doit recevoir le préfixe VITE_. Aucune valeur secrète n'a été extraite ni modifiée ; la sonde a utilisé les credentials existants uniquement dans le runtime serveur. Les scopes n'ont pas été inventoriés ni élargis. Un refus Google ne déclenche aucune nouvelle permission.

Les trois wrappers diagnostic et diagnosticAvailability.js ont été restaurés à partir des sources courantes récupérées en lecture seule sur le projet autorisé : confirmation v7, disponibilité v6, déplacement v5. Les copies comparatives sont conservées dans le dossier de travail de la mission.

Toute future mise en production exige une autorisation distincte et une vérification de la configuration serveur. Le lot présent prépare le code et ses contrôles locaux.

## Recette et limites de livraison

Première campagne locale : Node applicatif 273/273 ; backend 486 réussis, zéro échec et une fixture LIVE optionnelle ignorée. PostgreSQL 17 local : 16 groupes réussis, dont six attentes de verrou réellement observées sur des connexions distinctes. Les appels Google et l'identité Supabase y sont fictifs. Le contrôle réel Google séparé est décrit ci-dessous ; il ne constitue pas un test des parcours utilisateurs du correctif déployé.

Suite React complète : 657/658 au premier passage ; la seule attente en échec portait sur l'ancien titre du compteur administratif. Après correction, les 19 tests des deux écrans affectés passent. Les sept tests du calendrier passent aussi séparément en Europe/Paris et America/New_York. ESLint global, TypeScript applicatif et build Vite passent ; pas de typecheck Deno complet. Le build QA utilise une clé fictive et ne constitue pas une release publiable.

Première recette ciblée : 27/27 tests réussis avec HTTP/DB fictifs, dont personnel seul, conflit sur la dernière demi-heure d'une formation de 14 heures et personnel inaccessible (503 et aucune mutation). La première sonde éphémère a confirmé les accès FreeBusy réels ; aucun conflit personnel seul naturel n'avait été observé dans sa fenêtre de 30 jours.

Complément réel autorisé : un relais privé temporaire limité aux deux primaires et à une heure a utilisé les credentials Google uniquement côté serveur. Le candidat local a exécuté les cinq phases avant/pendant/après avec ses vrais helpers et des données Google réelles. Une séance publiée d'une heure du format four_1h est proposée avant, disparaît après ajout d'un événement personnel privé/occupé sur sa dernière demi-heure et expiration du cache, puis revient après retrait et actualisation. Pro et destination restent libres. Le serveur refuse immédiatement 23P01 via assertCalendarAvailable et runCalendarAction, même lorsque l'affichage garde encore son cache de moins de 30 secondes ; aucun exécuteur métier n'est atteint. Même processus/cache entre phases, attentes réelles 31513/31504 ms.

Les 5 tests du vrai composant CourseBooking dans jsdom, alimentés par ces observations réelles, passent. Les dépendances Auth/DB métier restent des fixtures locales explicites : aucune RPC métier distante, réservation cliente ou opération de paiement. La preuve porte sur une séance complète d'une heure, pas sur la réservation des quatre séances ou des 14 heures. Les 48 tests locaux du relais et les 13 tests de normalisation passent ; les refus d'authentification et de paramètres ont aussi été vérifiés réellement avant les lectures Google. Aucun nouvel accès OAuth requis.

Les événements temporaires explicitement autorisés ont tous été retirés et leur absence des événements actifs vérifiée, ainsi que le relais. Inventaire indépendant final : 24 fonctions d'origine identiques. Les processus de recette sont arrêtés. Les erreurs préparatoires de format Calendar ont été corrigées uniquement dans l'orchestration de recette hors dépôt, sans changer les sources fonctionnelles du candidat. Le parcours applicatif publié reste à contrôler après accord distinct.

Les tickets privés nécessaires aux réessais contiennent des données de réservation, jamais des détails d'événement personnel. Leur preuve expire après 30 secondes sans suppression du ticket. Maintenance retenue pour préparation : contrôle manuel quotidien, revue hebdomadaire des exceptions, lots de 100 lignes maximum. Un ticket sans effet métier confirmé devient candidat au plus tôt 24 heures après expiration ; un ticket avec effet métier, au plus tôt 30 jours après la plus tardive de la clôture métier, de la dernière préparation/exécution et de la résolution de son incident. Une réservation ou cohorte future/active, un incident ouvert et toute ambiguïté excluent le nettoyage. executed_at NULL ne suffit pas à conclure à l'absence d'exécution : une préparation Diagnostic peut réarmer ce champ.

Thierry FREZARD est proposé comme responsable de validation, avec un opérateur de base explicitement habilité à désigner. Chaque contrôle journalise uniquement date, opérateur, volumes et résultat. Après dry-run et rapprochement métier/registre d'incidents, la suppression doit être bornée, transactionnelle, verrouillée et contrôlée ; en cas d'erreur ou de résultat réseau incertain, interrompre, vérifier en lecture et traiter l'incident. Ne supprimer aucune réservation ni preuve de paiement. Les délais techniques ne sont pas une obligation légale présumée ; l'opérateur, le registre et la requête opérationnelle seront validés avant activation. Supprimer un ticket supprime aussi son replay : aucune idempotence OF illimitée n'est promise. Aucune purge automatique n'est activée.

## Retour arrière préparé

Le retour local s'appuie sur la révision de départ 449a7349eb5c3aea399cc06aa5840ee0ab87778c et les bundles Diagnostic récupérés, absents de ce commit. Sauvegarder le travail avant toute restauration ciblée ; aucun reset global n'est requis.

Pour une future publication autorisée, recapturer les neuf corps SQL modifiés, les ACL et les versions Edge juste avant intervention. En maintenance des seules réservations, restaurer transactionnellement ces corps et retirer les quatre triggers du lot, puis remettre les Edge antérieures et le frontend antérieur. Garder les nouveaux endpoints en maintenance tant que des clients récents peuvent appeler ; révoquer ensuite la nouvelle façade SQL. Conserver les réservations, paiements, événements Google et contraintes historiques. Ne pas restaurer une ancienne base par-dessus les réservations reçues depuis publication. Les webhooks de paiement restent actifs.

Le retrait des gardes rétablit le comportement historique et retire donc la garantie de croisement des deux agendas. Les sources comparatives et le détail des objets sont archivés dans le dossier de recette de la mission. Aucun retour arrière du correctif, déploiement applicatif ou effacement réel n'a été exécuté. Les seuls déploiements distants ont concerné la sonde autorisée, intégralement retirée.
