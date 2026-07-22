# Suivi du projet FormaPrompt

Dernière mise à jour : 16 juillet 2026

## Objectif général

Construire et fiabiliser FormaPrompt comme site de formation et espace apprenant professionnel : accès apprenants, formations, paiements, réservations, positionnements, émargements et suivi Qualiopi.

## Chantier en cours : finalisation de la formation Prompt Engineering — Niveau 1

### Offre pédagogique retenue

- Intitulé : « IA générative : comprendre, pratiquer et sécuriser ses usages ».
- Identifiant technique conservé : `formation-ia`.
- Durée : 10 heures accompagnées, complétées par les ressources et exercices disponibles dans l'espace apprenant.
- Présentiel : 2 séances de 5 heures.
- Classe virtuelle : 4 séances de 2 h 30 ou 3 séances réparties en 4 h + 4 h + 2 h.
- Tarif individuel maintenu : 497 EUR par apprenant.
- Présentiel proposé dans un rayon maximal de 100 km autour de Calais, sous réserve de validation de la distance.
- Une participation unique de 30 EUR est prévue pour le second déplacement lorsque la formation est organisée en présentiel sur deux séances.
- Au-delà de 100 km, la formation est proposée à distance ou sur devis.

La formation est positionnée comme un parcours d'acculturation et de mise en pratique professionnelle. Elle ne doit pas dupliquer la formation Prompt Engineering, plus approfondie sur la conception de prompts, ni la formation AI Act, centrée sur la réglementation et la conformité.

### Public visé

- Salariés, indépendants, dirigeants et fonctions support souhaitant utiliser l'IA générative dans leur activité.
- Formateurs, responsables pédagogiques et professionnels de l'accompagnement.
- Adultes en reconversion ou en évolution professionnelle souhaitant développer des usages numériques actuels.

### Prérequis

- Savoir utiliser un ordinateur, un navigateur et des outils numériques courants.
- Disposer d'une adresse électronique et, pour la classe virtuelle, d'un ordinateur connecté avec microphone.
- Aucun prérequis technique en intelligence artificielle n'est exigé.
- Le questionnaire de positionnement initial permet d'adapter les exemples et l'accompagnement au niveau du participant.

### Objectifs pédagogiques

À l'issue de la formation, le participant sera capable de :

1. expliquer simplement le fonctionnement général et les limites d'une IA générative ;
2. identifier des usages pertinents dans son contexte professionnel ;
3. formuler une demande structurée et améliorer progressivement un résultat ;
4. produire, reformuler, synthétiser et organiser des contenus avec une validation humaine ;
5. vérifier les réponses et protéger les données personnelles, sensibles ou confidentielles ;
6. construire un plan d'utilisation responsable adapté à son activité.

### Programme de 10 heures

1. **Comprendre l'IA générative et ses usages — 2 h** : définitions, principaux outils, différences avec un moteur de recherche, possibilités, limites et identification des besoins professionnels.
2. **Dialoguer avec une IA et structurer ses demandes — 2 h** : objectif, contexte, public, contraintes, format attendu, exemples, questions de clarification et amélioration progressive.
3. **Produire des contenus professionnels — 2 h** : rédaction, reformulation, synthèse, préparation de supports, comparaison de résultats et adaptation à différents destinataires.
4. **Vérifier, sécuriser et utiliser l'IA de façon responsable — 2 h** : hallucinations, biais, sources, confidentialité, données personnelles, propriété intellectuelle et validation humaine.
5. **Mettre en pratique et préparer son plan d'utilisation — 2 h** : cas pratique contextualisé, restitution, évaluation finale et construction d'un plan d'action individuel.

### Méthodes, évaluation et accessibilité

- Méthodes : apports courts, démonstrations, essais guidés, analyse de réponses, exercices progressifs et cas pratique final.
- Évaluation : positionnement initial, observations pendant les activités, exercices par module, cas pratique final et restitution.
- Livrables : aide-mémoire, guide de structuration d'une demande, grille de vérification, exercices et ressources de l'espace apprenant.
- Accessibilité : les besoins d'adaptation sont étudiés avant l'inscription afin d'ajuster les supports, le rythme ou les modalités lorsque cela est possible.
- Suivi Qualiopi : conserver le positionnement initial, les réservations, les émargements, les évaluations et la satisfaction sans supprimer les données historiques.

### Avancement du chantier

- Étape 1 terminée : offre pédagogique, durée, modalités, public, prérequis, objectifs et programme définis.
- Étape 2 terminée : page publique reconstruite avec une présentation complète, accessible et responsive ; durée ajoutée sur la page d'accueil.
- Étape 3 terminée : espace apprenant structuré en cinq modules ; positionnement porté à dix questions pour les nouveaux apprenants ; cinq exercices progressifs, cas pratique final et lexique enrichi.
- Étape 4 réalisée : ancien lien Stripe de test supprimé ; paiement sécurisé à 497 EUR relié au parcours commun ; réservation ajoutée en 2 séances de 5 h en présentiel, ou en 4 séances de 2 h 30 ou 3 séances de 4 h + 4 h + 2 h en classe virtuelle.
- Les contrôles de réservation, de participation au déplacement, d'administration et d'émargement prennent en charge ces rythmes.
- La migration `20260716111228_add_generative_ai_remote_4_4_2.sql` ajoute le rythme distant 4 h + 4 h + 2 h sans modifier les réservations existantes. Elle a été appliquée au projet Supabase FormaPrompt le 16 juillet 2026.
- Après cet ajout, `npm run lint`, `npm run build` et les 13 tests de réservation ont réussi.
- La migration `20260716081042_add_generative_ai_booking.sql` élargit les contraintes et les règles d'accès sans modifier les données historiques. Elle a été appliquée au projet Supabase FormaPrompt le 16 juillet 2026.
- Vérifications réussies : `npm run lint`, `npm run build`, 10 tests Stripe et 15 tests de réservation. La page publique et la redirection sécurisée vers la connexion ont été contrôlées sur le serveur local.
- Les positionnements initiaux déjà enregistrés restent valides et ne sont pas redemandés. Aucune donnée historique Qualiopi n'a été modifiée.
- Le produit Stripe de test « Formation IA générative – 10 heures » et son tarif ponctuel de 497 EUR ont été créés le 16 juillet 2026. Ils restent isolés dans l'environnement de test Stripe.
- Le produit réel « Formation IA générative », déjà présent dans Stripe avec un tarif ponctuel de 497 EUR, a été identifié. La variable serveur Supabase `STRIPE_GENERATIVE_AI_PRICE_ID` utilise désormais ce tarif réel, cohérent avec la clé Stripe réelle déjà configurée.
- L'ouverture de Stripe Checkout à 497 EUR a été contrôlée avec un compte authentifié ne possédant pas la formation. Le formulaire de paiement s'est affiché correctement et aucun paiement n'a été effectué.
- Les fonctions Supabase `create-checkout`, `stripe-webhook-ai-act`, `create-course-booking` et `create-travel-fee-checkout` ont été déployées avec leurs contrôles d'authentification et de signature conservés.
- La version web complète a été déployée sur l'hébergement IONOS le 16 juillet 2026 après validation du lint, du build et des 13 tests de réservation. Le transfert SFTP a envoyé 93 fichiers sans échec.
- Le site public affiche désormais la réservation de la formation IA générative dans l'espace apprenant. Le compte de contrôle `thierry@formaprompt.com` présente bien ses trois séances distantes de 4 h, 4 h et 2 h.
- Étape 5 pédagogique démarrée : une checklist réutilisable pour toutes les formations a été créée dans `todo-pedagogie-formations.md`.
- Le module 1 de la formation IA générative a été enrichi pour un grand débutant : explications simples, distinctions essentielles, méthode en cinq étapes, démonstration professionnelle, exemple commenté, erreurs fréquentes et synthèse.
- Le module 1 conduit maintenant directement à l'exercice pratique correspondant. Cette structure sert de modèle aux modules 2 à 5.
- Après cet enrichissement, `npm run lint`, `npm run build` et la vérification locale du parcours module 1 vers exercice 1 ont réussi.
- Le module 2 explique désormais comment structurer une demande : objectif, contexte utile, informations autorisées, format, critères de réussite et amélioration progressive. Il comprend une démonstration professionnelle, un exemple commenté, les erreurs fréquentes et une synthèse.
- Le passage direct du module 2 vers l'exercice 2 a été vérifié localement. `npm run lint` et `npm run build` ont réussi après cet enrichissement.
- Le module 3 présente désormais une méthode complète pour produire un contenu professionnel : préparer les informations de référence, définir le destinataire, produire deux versions, les comparer avec une grille puis construire un livrable final vérifié.
- Le passage direct du module 3 vers l'exercice 3 a été vérifié localement. `npm run lint` et `npm run build` ont réussi après cet enrichissement.
- Le module 4 apprend désormais à suspendre la diffusion, repérer les éléments à contrôler, vérifier les sources, examiner les données et les droits, puis décider d'utiliser, corriger ou rejeter le résultat en conservant une validation humaine.
- Le passage direct du module 4 vers l'exercice 4 a été vérifié localement. `npm run lint` et `npm run build` ont réussi après cet enrichissement.
- Le module 5 guide désormais l'apprenant dans le choix d'un cas maîtrisable, la conservation des preuves, la présentation des contrôles et la préparation d'une expérimentation réaliste sous 30 jours.
- Les cinq modules comportent maintenant une explication pour débuter, une méthode guidée, une démonstration professionnelle, un exemple commenté, les erreurs fréquentes, une synthèse et un accès direct à leur exercice respectif.
- Le passage du module 5 vers l'exercice 5 et la présence du cas pratique final ont été vérifiés localement. `npm run lint` et `npm run build` ont réussi après cet enrichissement.
- La restitution du questionnaire de positionnement présente désormais trois domaines : usages, formulation, vérification et sécurité. Chaque carte affiche un score normalisé, un niveau et un conseil orientant l'apprenant vers les modules utiles.
- Les nouvelles réponses enregistrent l'identifiant du domaine dans le JSON déjà existant. Aucun schéma Supabase, aucune migration et aucun positionnement historique n'ont été modifiés.
- Les deux tests du calcul par domaine, `npm run lint` et `npm run build` ont réussi.
- La grille de vérification annoncée dans la formation existe désormais sous la forme d'un PDF FormaPrompt de cinq pages. Elle comprend l'identification du cas, le cadrage du risque, le contrôle des sources et données, les biais, les droits, la décision finale et la validation du formateur.
- La grille est téléchargeable directement depuis le module 4, le cas pratique final et l'onglet « Supports et liens ». Le rendu des cinq pages, les trois liens locaux, `npm run lint` et `npm run build` ont été vérifiés.
- Les cinq exercices comportent désormais un mode d'emploi en quatre étapes et quatre critères d'autoévaluation observables. Le modèle à personnaliser reste clairement séparé des consignes pédagogiques.
- L'exercice 4 propose directement la grille de vérification. Les cinq cartes, les vingt étapes, les vingt critères, `npm run lint` et `npm run build` ont été vérifiés localement.
- Chaque exercice possède désormais un espace de réponse personnel avec deux actions explicites : enregistrer un brouillon ou déclarer la réponse terminée. La dernière version retrouvée, sa nature et sa date sont affichées à l'apprenant.
- La migration `20260716142844_add_course_exercise_responses.sql` crée un historique append-only : une sauvegarde ajoute une version et aucun droit de modification ou de suppression n'est accordé aux apprenants. Les règles RLS limitent la lecture au propriétaire et au personnel autorisé.
- Cette migration a été appliquée séparément au projet Supabase FormaPrompt le 16 juillet 2026, puis enregistrée avec le même numéro dans l'historique distant. Aucun `supabase db push` global n'a été utilisé.
- Un test transactionnel a confirmé que le propriétaire retrouve sa réponse, qu'un autre utilisateur ne peut pas la consulter et qu'aucune réponse d'essai n'est conservée après l'annulation. La table refuse l'accès anonyme et n'accorde aucun droit de modification ou de suppression aux apprenants.
- `npm run lint` et `npm run build` ont réussi. La structure accessible et l'affichage de la zone de réponse ont été contrôlés localement sur ordinateur et sur un écran de 390 px de large.
- Un nouvel onglet d'administration « Corrections » est prêt localement : il présente les dernières réponses terminées, le compte apprenant, la formation, l'exercice et l'historique des appréciations.
- Le formateur peut préparer une appréciation, valider l'exercice ou demander une reprise. Une nouvelle correction est ajoutée à l'historique au lieu de remplacer la précédente.
- L'apprenant retrouve le dernier retour sous l'exercice concerné, avec la date et la version de sa réponse qui a été évaluée. Une nouvelle version reste identifiable après le retour du formateur.
- La migration `20260716150459_add_course_exercise_reviews.sql` crée la table append-only, les vues de dernière soumission et d'historique, les droits minimaux et les règles RLS. Elle a été appliquée séparément au projet Supabase le 16 juillet 2026 et enregistrée avec le même numéro dans l'historique distant.
- Un test transactionnel annulé a confirmé que le personnel autorisé peut créer et relire une correction, que l'apprenant propriétaire la retrouve, qu'un autre apprenant ne la voit pas et qu'une correction existante ne peut pas être modifiée. Zéro donnée temporaire a été conservée.
- Les contrôles Supabase ne signalent aucune alerte de performance liée à cette migration. L'unique avertissement de sécurité reste la protection contre les mots de passe compromis, déjà identifiée et indépendante de cette fonctionnalité.
- `npm run lint`, `npm run build` et `git diff --check` ont réussi après cette étape. La page publique de connexion reste fonctionnelle.
- Le parcours visuel a ensuite été vérifié localement dans Chrome avec le compte réel déjà connecté : l'administration présente une réponse terminée, son statut « Validé », l'appréciation « Bon travail ! » et l'historique ; l'espace apprenant présente le même retour et les dates correspondantes.
- Sur un écran simulé de 390 px, la carte de retour apprenant reste lisible et passe correctement en colonne. Le titre « Panneau d'Administration » a été rendu responsive : il se répartit sur deux lignes et ne provoque plus aucun débordement horizontal. L'affichage ordinateur reste sur une seule ligne.
- Les seules erreurs relevées dans la console correspondent au canal de l'extension de contrôle Chrome fermé pendant la navigation ; aucune erreur Supabase ou erreur applicative liée aux corrections n'a été observée à l'écran.
- Un indicateur de progression simple et réutilisable est désormais affiché dans la formation et sur chaque carte de l'espace apprenant. Il distingue les exercices commencés, terminés et validés par le formateur ; le pourcentage repose uniquement sur les exercices déclarés terminés.
- L'indicateur utilise les vues Supabase existantes et leurs règles RLS. Aucune migration, aucune nouvelle donnée personnelle et aucune modification de l'historique Qualiopi n'ont été nécessaires.
- Le compte de contrôle affiche 2 exercices terminés sur 5, soit 40 %, et 2 validations du formateur. Le test du calcul, `npm run lint` et `npm run build` ont réussi.
- L'affichage a été vérifié dans Chrome sur ordinateur et à 390 px. L'indicateur ne déborde pas ; l'ancien débordement de l'adresse e-mail du titre de bienvenue a également été corrigé.
- La première étape de l'évaluation finale est terminée localement : les quatre critères du cas pratique possèdent maintenant quatre niveaux observables — « Non acquis », « En cours d'acquisition », « Acquis » et « Maîtrisé ».
- L'apprenant dispose d'une explication simple de ce qui est attendu et peut s'autoévaluer avant la remise. La validation exige au minimum le niveau « Acquis » sur les quatre critères ; « Maîtrisé » valorise l'autonomie sans être obligatoire.
- La grille conserve une structure de tableau accessible sur ordinateur et devient quatre fiches verticales par critère sur téléphone. Le rendu a été contrôlé dans Chrome à 390 px sans débordement horizontal.
- `npm run lint`, `npm run build` et `git diff --check` ont réussi. Cette étape est uniquement pédagogique et n'a créé ni migration ni nouvelle donnée Supabase.
- L'identification des quatre livrables est prête localement dans l'évaluation finale : description ou lien sécurisé, brouillon, remise au formateur, compteur de complétude et message facultatif.
- L'interface rappelle les précautions RGPD et n'impose aucun téléversement de fichier vers un service externe. Les champs sont maintenant reliés à Supabase pour les apprenants possédant la formation.
- La migration locale `20260716161334_add_course_final_project_submissions.sql` crée un historique append-only, des contraintes de longueur et de complétude, des droits minimaux, des règles RLS et des vues `security_invoker` pour la dernière version et la dernière remise terminée.
- Cette migration a été appliquée séparément au projet Supabase FormaPrompt le 16 juillet 2026 et enregistrée sous le numéro `20260716161334`, sans synchronisation globale des anciennes migrations divergentes.
- Un test transactionnel annulé a confirmé que le propriétaire peut enregistrer et relire sa remise, qu'un autre apprenant ne la voit pas, qu'un compte sans achat ne peut pas enregistrer de remise et que le personnel autorisé peut la consulter. Les droits de modification et de suppression sont refusés, les deux vues utilisent `security_invoker` et zéro donnée d'essai a été conservée.
- Les contrôles Supabase ne signalent aucune alerte de performance liée à cette migration. L'avertissement général sur la protection contre les mots de passe compromis reste indépendant de cette fonctionnalité.
- Le poste d'évaluation finale du formateur est prêt localement dans l'onglet « Corrections & évaluations ». Il affiche la dernière remise, les quatre livrables, la note de l'apprenant, les quatre critères et leurs descriptions observables.
- La décision « Évaluation validée » est calculée uniquement lorsque les quatre critères atteignent « Acquis » ou « Maîtrisé ». Le formateur doit aussi renseigner une appréciation et des axes de progrès ; une nouvelle évaluation s'ajoute à l'historique sans remplacer la précédente.
- L'apprenant retrouvera dans sa formation les quatre niveaux obtenus, l'appréciation, les axes de progrès, les dates et une consigne de nouvelle remise si nécessaire. Une remise plus récente reste clairement signalée comme en attente d'évaluation.
- La migration `20260716163910_add_course_final_project_reviews.sql` crée la table append-only, les contraintes de cohérence, les droits minimaux, les règles RLS et deux vues `security_invoker`. Elle a été appliquée séparément au projet Supabase FormaPrompt le 16 juillet 2026 et enregistrée sous le même numéro, sans synchronisation globale des anciennes migrations divergentes.
- Le test transactionnel a confirmé que seul le personnel peut créer une évaluation, que le propriétaire la consulte, qu'un autre apprenant ne la voit pas, qu'une validation incohérente avec les niveaux est refusée et qu'aucune évaluation ne peut être modifiée ou supprimée. Aucune donnée d'essai n'a été conservée.
- Le même scénario a été rejoué après activation puis annulé. Les deux vues utilisent `security_invoker`, la table force la RLS, les droits d'insertion sont limités aux neuf colonnes utiles et l'analyse Supabase ne relève aucune alerte de performance.
- Le poste « Évaluations finales » se charge maintenant dans l'administration sans message d'activation. Une remise réelle et sa correction ont été testées avec succès par l'utilisateur le 16 juillet 2026 ; la restitution apprenant fonctionne également.
- Les trois tests du calcul de décision, `npm run lint`, `npm run build` et les affichages ordinateur et téléphone sans débordement horizontal ont réussi.
- Le dossier d'attestation est maintenant préparé localement dans chaque évaluation finale. Il réutilise les données Supabase déjà protégées : identité du positionnement, réservation, séances, émargements et évaluation exacte de la dernière remise.
- L'attestation de réalisation n'est déclarée prête que si le nom complet est disponible, si la réservation est confirmée ou terminée et si chaque séance possède les signatures apprenant et formateur avec une présence validée. La durée réellement suivie est calculée ; un départ anticipé ne produit donc pas artificiellement la durée planifiée.
- L'attestation de compétences exige en plus que les quatre critères du cas pratique final soient validés. Le panneau indique les éléments manquants et rassemble les références de preuve, sans générer ni envoyer automatiquement de document.
- Le dossier réel contrôlé retrouve quatre séances et 10 heures planifiées. Il reste correctement signalé comme incomplet car les émargements ne sont pas finalisés et la dernière évaluation demande une reprise. Les cinq tests du calcul, `npm run lint`, `npm run build` et le contrôle à 390 px sans débordement ont réussi. Aucune donnée Supabase n'a été créée ou modifiée pendant cette étape.
- Deux aperçus imprimables sont maintenant disponibles depuis ce dossier : attestation de réalisation et attestation de compétences. Ils sont réservés au personnel, utilisent les données déjà protégées par les règles Supabase et n'ajoutent aucune écriture en base.
- Les modèles centralisent les mentions de FormaPrompt, l'identité du formateur, le participant, la période, la modalité, la durée réellement suivie, les objectifs et les résultats pertinents. La référence et la date de délivrance sont stables et déduites des preuves validées.
- Tant que les conditions propres au document ne sont pas remplies, l'aperçu affiche « BROUILLON », indique les preuves manquantes, désactive le bouton d'impression et masque la feuille lors d'une tentative d'impression. Le dossier réel a permis de vérifier séparément ces blocages pour les émargements et pour l'évaluation finale.
- L'attestation de compétences indique explicitement qu'elle décrit une évaluation interne et ne constitue ni un diplôme, ni un titre professionnel, ni une certification RNCP ou RS.
- Les 13 tests ciblés, `npm run lint`, `npm run build` et les contrôles visuels sur ordinateur et téléphone ont réussi. `git diff --check` ne relève aucune erreur ; seuls les avertissements habituels de conversion LF vers CRLF apparaissent sous Windows.
- Le registre Supabase append-only des attestations délivrées est maintenant actif sous le numéro `20260717070129`. Il conserve la référence, le type, l'apprenant, la formation, l'auteur, la date réelle d'émission, les références de preuve et une copie figée et minimisée du document.
- La base refuse toute modification ou suppression par les comptes connectés. Les règles RLS limitent la consultation à l'apprenant concerné et au personnel autorisé ; l'accès anonyme a été contrôlé et renvoie bien un refus HTTP 401.
- La délivrance depuis l'administration exige toujours une remise finale, une réservation confirmée ou terminée et le nombre exact d'émargements entièrement signés et verrouillés. L'attestation de compétences exige en plus l'évaluation validée correspondant à la remise.
- Une attestation réellement délivrée apparaît dans la nouvelle rubrique « Mes attestations » de l'espace apprenant. Le document relu depuis cette rubrique utilise exclusivement son contenu figé et peut être imprimé ou enregistré en PDF.
- Les 12 tests ciblés du dossier, des références et du contenu figé, `npm run lint`, `npm run build`, `git diff --check` et le contrôle de schéma distant ont réussi. Aucun document d'essai et aucune donnée personnelle temporaire n'ont été créés. La session de navigateur automatisée n'étant pas connectée, le parcours visuel formateur/apprenant reste à rejouer avec un dossier réellement délivrable.
- La formation IA générative comporte maintenant un guide visible « Comment suivre cette formation ? » conçu pour les grands débutants. Il présente le parcours en cinq étapes, distingue clairement un brouillon d'une réponse terminée et explique quand consulter la correction, préparer le cas final et retrouver les attestations.
- Le guide utilise la structure existante de la page et un contenu configurable dans le catalogue afin de pouvoir être adapté ultérieurement aux autres formations. Il ne crée aucune nouvelle donnée Supabase. `npm run lint`, `npm run build` et `git diff --check` ont réussi.
- La connexion locale ne reste plus bloquée sur « Connexion en cours… » après la création effective de la session. Le formulaire redirige immédiatement après une réponse Supabase réussie et la route `/login` renvoie aussi automatiquement un utilisateur déjà connecté vers son espace. Un délai maximal de 15 secondes réactive le formulaire avec un message clair si le service ne répond pas. L'état de santé Supabase Auth a répondu HTTP 200 ; `npm run lint`, `npm run build` et `git diff --check` ont réussi.
- Le support « Guide du Prompt Engineering » de la formation IA générative renvoie désormais vers un nouveau guide pratique FormaPrompt de 14 pages, cohérent avec les cinq modules. Il comprend le parcours pas à pas, des exemples professionnels, une fiche de consigne imprimable, la méthode de production et de contrôle, quatre modèles de prompts, une fiche action à 30 jours, le cas final, le lexique et la checklist avant diffusion. Contrairement à l'ancien document constitué uniquement d'images, les 24 324 caractères sont sélectionnables et extractibles ; le document possède 26 signets, des contrastes lisibles et un ordre de lecture linéaire. L'ancien PDF reste conservé dans les ressources du projet mais n'est plus proposé dans cette formation.
- La formation IA générative propose maintenant un cahier d'activités textuel et imprimable de 18 pages regroupant les cinq exercices. Chaque activité suit trois temps - préparation, réalisation et bilan - et fournit les modèles à personnaliser, des tableaux de travail, les quatre critères d'autoévaluation et une zone de correction formateur. Le cahier rappelle la minimisation des données, distingue le brouillon du travail terminé et demande de reporter la réponse dans l'espace apprenant afin de conserver l'historique officiel. Il ne modifie aucun enregistrement Supabase.
- Un modèle textuel et imprimable de 12 pages rassemble le cas pratique final et le plan d'action individuel. Il correspond aux quatre champs de remise existants : consigne finale et améliorations, livrable, référence de la grille de vérification et plan d'action. Il ajoute le cadrage du cas, un journal d'itération, les indicateurs et la règle de décision à 30 jours, la checklist de remise, l'autoévaluation et les quatre niveaux de la grille formateur. La validation reste conditionnée à un niveau minimal « Acquis » sur chacun des quatre critères, conformément à l'évaluation en ligne. Aucun schéma ni enregistrement Supabase n'est modifié.
- Le lexique de la formation IA générative comprend désormais 37 notions, contre 13 auparavant. Les définitions restent courtes et comportent toutes un exemple professionnel. Les notions nouvelles expliquent les différences entre IA, IA générative, modèle, assistant, chatbot et moteur de recherche, ainsi que les repères de formulation, de production, de vérification, de protection des données, de droits et de traçabilité utilisés dans les cinq modules. Les termes relatifs aux données ont été alignés sur les définitions officielles de la CNIL, notamment pour l'anonymisation, la pseudonymisation et la minimisation. La liste est triée automatiquement, la recherche couvre les exemples et le compteur de résultats est annoncé aux technologies d'assistance. Le rendu ordinateur et téléphone ainsi que la recherche par exemple ont été vérifiés dans le navigateur local ; le lint, le build et `git diff --check` ont réussi. Aucune donnée Supabase n'est modifiée.
- Le guide formateur IA générative est prêt localement sous la forme d'un PDF interne de 20 pages. Il couvre les trois organisations de 10 heures - présentiel en 2 x 5 h, classe virtuelle en 4 x 2 h 30 et classe virtuelle en 4 h + 4 h + 2 h - avec un déroulé minuté, des points de reprise, les démonstrations, les réponses attendues, les relances, les adaptations pour un grand débutant, la correction des exercices et du cas final, ainsi que les preuves proportionnées à conserver après chaque séance.
- Le document est proposé dans l'onglet unique « Guides formateur » du panneau d'administration et n'est pas ajouté aux supports proposés à l'apprenant. Cet onglet regroupe les guides de toutes les formations afin de ne pas multiplier les boutons dans l'en-tête. Le PDF statique ne contient aucune donnée personnelle ou confidentielle ; comme les autres ressources publiques du site, il reste toutefois accessible à une personne qui connaîtrait son adresse directe. Son texte est sélectionnable et extractible, ses 20 pages ont été rendues et contrôlées visuellement, et aucune donnée Supabase ou Qualiopi existante n'a été modifiée.
- La version incluant le registre et les modèles d'attestation, les supports pédagogiques, le lexique enrichi et le guide formateur a été déployée sur IONOS le 17 juillet 2026. Les 37 tests applicatifs, les 10 tests Stripe, le lint et le build ont réussi avant publication. Les 109 fichiers ont été transférés puis comparés intégralement au build local. L'index public, les routes `/formation-ia-generative` et `/admin`, le script principal, la feuille de style et le guide formateur PDF correspondent au build publié.
- La version complète a été redéployée sur IONOS le 16 juillet 2026 après réussite des 35 tests applicatifs, des 10 tests Stripe, du lint et du build. Les 102 fichiers du build ont été transférés et leurs tailles vérifiées sur le serveur. L'index public correspond exactement au build local ; le script principal, la feuille de style et la route `/formation-ia-generative` répondent correctement.
- Un accès SFTP dédié aux futurs déploiements est conservé à la demande de l'utilisateur. Son mot de passe est stocké chiffré par Windows dans le profil local, hors du projet et hors de Git. Ne révoquer cet accès que sur demande explicite de Thierry.
- Convention de travail demandée par Thierry : pour FormaPrompt, une demande de « commit » comprend également le `push`, sauf indication contraire explicite.

### Démarrage de la finalisation Prompt Engineering — Niveau 1

- Les six modules et leurs six exercices associés sont enrichis localement selon la méthode validée pour la formation IA générative.
- Le cas pratique final possède quatre livrables, quatre critères observables, quatre niveaux d'évaluation et une règle de validation explicite.
- Le lexique comprend désormais 36 notions illustrées par un exemple professionnel. Il couvre le cadrage, les sources, les données, l'adaptation aux publics, la pédagogie, le HTML accessible, les workflows et les contrôles humains.
- La page Notion « Bibliothèque de prompts — Prompt Engineering Niveau 1 » a été synchronisée le 17 juillet 2026 avec les six prompts complets des exercices, leurs variables et les contrôles à conserver. Les anciennes versions abrégées ont été remplacées sans créer de doublon.
- L'ancien guide PDF de 16 pages, composé uniquement d'images et sans texte extractible, reste conservé mais n'est plus proposé dans la formation. Il est remplacé dans l'espace apprenant par un guide pratique FormaPrompt de 19 pages, textuel, contrasté et doté de signets. Le nouveau support reprend les six modules, les productions attendues, les six prompts complets, la méthode d'itération, le cas final, douze notions et une checklist imprimable.
- Un cahier d'activités FormaPrompt de 21 pages accompagne désormais les six exercices. Chaque activité possède trois pages pour préparer le cas, personnaliser le prompt, conserver les essais, analyser un écart, s'autoévaluer avec quatre critères et recueillir le retour du formateur. Le document reste un support imprimable : les réponses terminées et les corrections officielles continuent d'être enregistrées dans l'espace apprenant.
- Un modèle imprimable de 12 pages accompagne désormais le cas pratique final et le plan d'action individuel. Il guide le cadrage, le prompt initial, les trois critères, le premier test, l'écart, la correction ciblée, les quatre livrables, la décision d'usage et le prochain test sous 30 jours. Les deux dernières pages reprennent exactement les quatre critères et les quatre niveaux de la grille formateur. Le PDF ne remplace ni la remise append-only ni l'évaluation enregistrée dans l'espace apprenant.
- Le guide formateur Prompt Engineering est prêt localement sous la forme d'un PDF interne de 16 pages. Il couvre les deux organisations officielles de 7 heures - présentiel en 4 h + 3 h et présentiel ou classe virtuelle en 2 x 3 h 30 - avec les minutages, points de reprise, six démonstrations, réponses attendues, corrections des exercices, adaptations pour un grand débutant, grille finale et preuves Qualiopi proportionnées. Il est regroupé avec le guide IA générative dans l'onglet unique « Guides formateur » du panneau d'administration et n'apparaît pas parmi les supports de l'espace apprenant.
- Le guide statique ne contient aucune donnée personnelle ou confidentielle. Comme les autres fichiers publics du site, il reste toutefois accessible à une personne connaissant son adresse directe ; les preuves pédagogiques réelles ne doivent jamais être ajoutées dans ce PDF.
- Cette étape ne modifie aucun schéma, aucune migration et aucune donnée Supabase, Stripe ou Qualiopi.
- La version comprenant les six modules enrichis, leurs exercices, le cas pratique final, le lexique, les trois supports apprenant, le guide formateur et l'onglet unique « Guides formateur » a été déployée sur IONOS le 17 juillet 2026. Les 37 tests applicatifs, les 10 tests Stripe, le lint, le build et la compilation des quatre générateurs PDF ont réussi. Les 113 fichiers du build, soit 136 794 210 octets, ont été transférés puis comparés intégralement au serveur. L'accueil, la page Prompt Engineering, l'administration et les quatre nouveaux PDF répondent en production ; l'index et les PDF contrôlés par HTTP correspondent exactement au build local.
- Le contrôle pédagogique final croisé du 17 juillet 2026 confirme que la formation répond aux besoins d'un grand débutant, du formateur et de l'organisme de formation. Le parcours publié contient les six modules et leurs exercices liés, les démonstrations, exemples professionnels, réponses attendues, corrections, l'évaluation finale, les supports, le lexique, les ressources, les preuves de progression et le guide formateur.
- Quatre ajustements ciblés ont été réalisés localement après ce contrôle : affichage de la durée « 7 heures accompagnées » dans l'espace apprenant, ajout d'un guide de démarrage en cinq étapes, restitution du positionnement selon trois domaines et activation du menu mobile de l'en-tête jusqu'à 960 px pour supprimer le débordement sur tablette.
- Les parcours formation, exercices et lexique ont été contrôlés localement à 900 px, 768 px et 390 px sans débordement de page. `npm run lint`, les 37 tests applicatifs, les 10 tests Stripe et `npm run build` ont réussi. Aucun schéma, aucune migration et aucune donnée Supabase, Stripe ou Qualiopi n'a été modifié.
- La formation « Prompt Engineering — Niveau 1 » est considérée comme pédagogiquement finalisée. Les quatre ajustements issus du contrôle final ont été déployés sur IONOS le 17 juillet 2026. Les 113 fichiers du build, soit 136 798 045 octets, ont été comparés par SHA-256 ; 52 fichiers ont été transférés et 61 étaient déjà identiques. L'accueil, la route Prompt Engineering, le script principal, la feuille de style et le catalogue répondent en HTTPS avec un contenu identique au build local.
- Le contrôle réel réalisé par Thierry le 18 juillet 2026 valide la formation Prompt Engineering. Il a toutefois révélé qu'une réservation OF restait proposée dans le choix des horaires apprenant. Le verrou transactionnel empêchait déjà l'enregistrement d'une double réservation, mais le filtre d'affichage avait été supprimé involontairement lors de l'élargissement du calendrier aux nouvelles formations.
- La migration corrective `hide_of_bookings_from_learner_availability` a été activée séparément dans Supabase le 18 juillet 2026 sous le numéro distant `20260718092424`. Une option ou réservation OF du matin masque le matin, celle de l'après-midi masque l'après-midi et une journée masque les deux périodes. Un test avec un compte apprenant existant confirme que les horaires OF ne sont plus visibles et que les créneaux réellement libres restent proposés. Aucune réservation ni donnée personnelle n'a été modifiée ; aucun déploiement web n'est nécessaire.
- La formation « IA : acculturation et préparation à la conformité AI Act » est considérée comme pédagogiquement finalisée. Son espace apprenant contient quatre modules progressifs avec leurs exercices liés, un positionnement structuré en trois domaines, un cas pratique final à quatre livrables, une grille d'évaluation à quatre critères, 34 notions de lexique et cinq ressources, dont trois supports apprenant téléchargeables.
- Le guide pratique IA Act de 16 pages, le cahier d'activités de 15 pages, le modèle du cas final de 12 pages et le guide formateur interne de 16 pages ont été contrôlés : aucune page vide, texte extractible et signets présents. Le guide formateur couvre les trois formats de 4 heures guidées et reste regroupé dans l'onglet unique « Guides formateur » de l'administration.
- Le contrôle final croisé du 18 juillet 2026 valide les besoins du grand débutant, du formateur et de l'organisme de formation. Les contenus réglementaires renvoient vers EUR-Lex et la Commission européenne, l'affichage ne déborde pas sur téléphone et ordinateur, et les attestations IA Act reprennent six objectifs pédagogiques ainsi que les libellés lisibles des trois formats de séances.
- La version complète IA Act a été déployée sur IONOS le 18 juillet 2026 après réussite du lint, des 49 tests et du build. Les 117 fichiers du build, soit 138 621 292 octets, ont été contrôlés par SHA-256 : 55 fichiers ont été transférés et 62 étaient déjà identiques. L'accueil, la page publique IA Act, l'espace apprenant et l'administration répondent en HTTPS ; les quatre PDF de la formation sont strictement identiques au build local. Aucun schéma, aucune migration et aucune donnée Supabase, Stripe ou Qualiopi n'a été modifié pendant cette publication.

## État de la dernière correction

- Le questionnaire de positionnement initial n'est plus redemandé lorsqu'il existe déjà pour l'apprenant et la formation.
- L'onglet d'administration « Positionnements » n'affiche qu'un positionnement initial par apprenant et par formation.
- Supabase empêche désormais la création d'un second positionnement initial identique.
- Les anciennes tentatives en double sont conservées comme historique Qualiopi, mais ne sont plus affichées comme positionnements initiaux.
- La migration Supabase correspondante a été appliquée au projet FormaPrompt.
- `npm run lint` et `npm run build` ont réussi après la correction.

## Fichiers modifiés pour cette correction

- `webapp/src/pages/CoursePlayer.jsx`
- `webapp/src/components/PrerequisiteQuiz.jsx`
- `webapp/src/pages/AdminDashboard.jsx`
- `webapp/src/pages/CoursePlayer.css`
- `webapp/supabase/migrations/20260715174723_enforce_single_initial_positioning.sql`

## Décisions importantes

- Un seul questionnaire peut avoir `is_initial = true` pour un couple `user_id` / `course_id`.
- La première réponse enregistrée reste le positionnement initial officiel.
- Les éventuelles réponses ultérieures restent stockées avec `is_initial = false` afin de préserver l'historique.
- Un index unique partiel Supabase protège cette règle au niveau de la base de données.
- Les doublons historiques ne doivent pas être supprimés sans validation explicite.

## Vérifications recommandées

1. Se connecter avec un apprenant ayant déjà rempli le questionnaire IA Générative.
2. Depuis « Mon espace », ouvrir « Formation IA Générative ».
3. Vérifier que le contenu de formation s'ouvre directement, sans nouveau questionnaire.
4. Tester avec un nouvel apprenant et vérifier que le questionnaire initial apparaît une seule fois.
5. Vérifier dans l'administration qu'un seul positionnement est affiché pour chaque apprenant et formation.

## Problèmes encore ouverts

- Aucun défaut confirmé sur la dernière correction.
- La pile Supabase locale n'était pas démarrée. La migration a été appliquée de façon isolée à la base distante dans une transaction, puis vérifiée par des requêtes de contrôle.
- Le produit Stripe réel est maintenant nommé « Formation IA générative – 10 heures ». Son descriptif présente le présentiel en 2 × 5 h et la classe virtuelle en 4 × 2 h 30 ou 4 h + 4 h + 2 h. L'affichage a été vérifié dans Stripe Checkout à 497 EUR sans effectuer de paiement.
- Aucun paiement n'a été finalisé pendant cette configuration.
- L'historique de plusieurs anciennes migrations locales et distantes utilise des numéros différents. Ne pas lancer un `supabase db push` global avant d'avoir réconcilié cet historique ; la migration IA générative a été enregistrée séparément comme appliquée.
- L'analyse Supabase signale que la protection contre les mots de passe compromis est désactivée. Ce réglage Auth, indépendant de la formation, reste à étudier avant la mise en production.
- Un test fonctionnel complet avec plusieurs comptes apprenants reste conseillé avant la mise en production.
- La sauvegarde des réponses et la correction formateur sont actives dans Supabase. Les tests RLS, le parcours visuel réel et l'affichage mobile de l'administration sont réussis.
- Le registre des attestations et son interface sont maintenant déployés sur IONOS. Il reste à délivrer une première attestation sur un dossier réel finalisé et à vérifier son affichage dans l'espace apprenant sur ordinateur et téléphone.

## Prochaine action recommandée

Les formations IA générative, Prompt Engineering — Niveau 1 et IA Act sont pédagogiquement finalisées. La prochaine vérification utile consiste à délivrer une première attestation IA Act à partir d'un dossier réel entièrement finalisé, puis à contrôler son affichage dans l'espace apprenant sur ordinateur et téléphone. Les tests complets du paiement, du déplacement et de l'émargement restent à réaliser séparément avec plusieurs comptes apprenants.

## Préparation de la prochaine tâche — FormaPrompt Studio 2026

- Le prochain chantier produit est un outil public de Prompt Engineering, réutilisable dans les formations, nommé provisoirement « FormaPrompt Studio » et portant le nom de code « Prompt OS ».
- Le prompt de démarrage est conservé dans `brief-formaprompt-studio-2026.md` et le suivi dédié dans `todo-formaprompt-studio.md`.
- La première étape de la nouvelle tâche est strictement un audit produit, UX et technique. Aucun développement, choix d'architecture, schéma Supabase, produit Stripe ou appel IA ne doit être créé avant validation de Thierry.
- L'audit devra comparer l'intégration au projet React/Vite existant avec une éventuelle application Next.js séparée, puis recommander un MVP et une seule tranche verticale modèle.

## FormaPrompt Studio 2026 — première tranche verticale réalisée

- L'architecture React/Vite existante et le périmètre sans appel externe ni stockage ont été validés par Thierry.
- La route publique `/studio` propose le cas d'usage « courriel professionnel », un constructeur CROP générique, un prompt structuré, un score pédagogique explicable et des recommandations d'amélioration.
- Le Studio ne charge ni Supabase, ni authentification, ni bandeau cookies sur cette route et ne conserve aucune saisie.
- La configuration de catégorie regroupe les champs, le schéma Zod, les règles de score, le constructeur, les aides, les exemples et les recommandations.
- La page publique contient les métadonnées SEO, Open Graph, JSON-LD, la FAQ, l'exemple avant-après et les liens internes demandés.
- Le build produit un HTML pré-rendu pour `/studio/` afin que le contenu soit lisible sans attendre l'exécution de React.
- Les tests unitaires, le parcours React, les quatre tests navigateur ordinateur/mobile, les contrôles WCAG automatisables, le lint, les types et le build ont été exécutés avec succès.
- Audit Lighthouse local du build : mobile 97/99/100/100 et ordinateur 100/99/100/100 pour performance/accessibilité/bonnes pratiques/SEO.
- Aucun schéma, aucune migration Supabase et aucun produit Stripe n'ont été ajoutés ou modifiés. Aucun commit, push ou déploiement n'a été réalisé.

## Annonce du Studio et SEO de l'accueil — 19 juillet 2026

- La page d'accueil présente désormais FormaPrompt Studio, la méthode CROP, les neuf cas d'usage disponibles et un accès direct à `/studio`.
- Le titre principal, le titre SEO, la description, l'URL canonique, les métadonnées Open Graph et les données structurées `EducationalOrganization`, `WebSite` et `WebApplication` ont été harmonisés sur `https://formaprompt.com/`.
- L'accueil est pré-rendu pendant le build, comme le Studio, afin que son contenu et ses métadonnées soient directement lisibles par les moteurs de recherche.
- Le sitemap utilise uniquement le domaine sans `www`, contient la route Studio et est déclaré dans `robots.txt`.
- Le typecheck, le lint, le build et les deux tests navigateur ordinateur/mobile ont réussi. Le contrôle automatisé n'a détecté ni violation WCAG A/AA ni débordement horizontal.
- La version a été déployée sur IONOS le 19 juillet 2026. Les 131 fichiers du build, soit 138 998 312 octets, ont été comparés par SHA-256. L'accueil, le Studio, le sitemap et `robots.txt` répondent en HTTPS avec un contenu strictement identique au build local.
- Aucun schéma, aucune migration et aucune donnée Supabase, Stripe ou Qualiopi n'a été modifié pendant cette publication.

## Extension de FormaPrompt Studio à quatorze cas d'usage — 19 juillet 2026

- Le Studio propose désormais quatorze catégories déterministes. Cette extension ajoute « Recherche », « Productivité », « Code », « Vidéo » et « Articles et contenus éditoriaux » aux neuf cas d'usage déjà publiés.
- Chaque nouvelle catégorie possède ses champs et validations Zod, son constructeur de prompt, sa grille CROP explicable sur 100 points, ses aides, exemples, recommandations et garde-fous propres.
- La catégorie éditoriale couvre notamment les articles de blog, techniques, d'actualité, tutoriels, comparatifs, interviews et mises à jour. Elle impose de distinguer les faits, les incertitudes et les dates utiles, sans inventer de source, citation ou lien.
- La page d'accueil et les métadonnées du Studio ont été actualisées pour présenter quatorze cas d'usage. Le vocabulaire visible conserve « espace apprenant » et n'emploie pas les expressions réservées à une version avec fournisseur externe.
- Les 39 tests applicatifs, les 10 tests Stripe et les 58 tests Studio ont réussi, soit 107 tests. Le typecheck, le lint, le build, le pré-rendu et les parcours navigateur ciblés ont également réussi.
- La publication IONOS a comparé les 131 fichiers du build par SHA-256 : 61 fichiers ont été transférés et 70 étaient déjà identiques, pour 139 127 164 octets contrôlés.
- L'accueil et le Studio servis en HTTPS correspondent exactement au build local. La catégorie éditoriale est visible et interactive sans erreur ni débordement sur ordinateur et sur un écran mobile de 390 px ; le sitemap et `robots.txt` répondent en HTTP 200.
- Le démarrage du Studio utilise désormais un rendu React classique sur le HTML pré-rendu, comme l'accueil, afin d'éviter un avertissement d'hydratation tout en conservant le contenu SEO directement lisible.
- Aucun appel à un fournisseur externe, aucun stockage et aucune modification de Supabase, Stripe, de l'authentification, des migrations ou des données Qualiopi n'ont été ajoutés pendant cette extension.

## Finalisation de FormaPrompt Studio à seize cas d'usage — 19 juillet 2026

- Les seize catégories prévues dans le catalogue sont désormais développées et actives. Cette finalisation ajoute « Agent IA » et « Audio » aux quatorze usages déjà publiés.
- « Agent IA » produit uniquement une spécification déterministe : mission, autonomie, mémoire, outils et données autorisés, limites d'action, validations humaines, quotas, traçabilité, tests et procédure d'arrêt. Le Studio ne crée, ne connecte et n'exécute aucun agent.
- « Audio » couvre notamment les podcasts, voix off, capsules pédagogiques, interviews, messages sonores et briefs de montage. Le prompt exige une transcription accessible, le contrôle des faits et prononciations, ainsi que les droits et consentements nécessaires pour les voix, musiques, œuvres et extraits.
- Chaque catégorie conserve ses validations Zod, son constructeur de prompt, sa grille CROP explicable sur 100 points, ses aides, exemples, recommandations et garde-fous propres.
- Les 39 tests applicatifs, les 10 tests Stripe et les 66 tests Studio ont réussi, soit 115 tests. Le typecheck, le lint, le build, le pré-rendu et les parcours ciblés Agent IA, Audio, accueil et accessibilité WCAG sur ordinateur et mobile ont également réussi.
- La publication IONOS a comparé les 131 fichiers du build par SHA-256 : 61 fichiers ont été transférés et 70 étaient déjà identiques, pour 139 177 343 octets contrôlés.
- L'accueil, `/studio/`, les scripts et styles principaux, le sitemap et `robots.txt` répondent en HTTPS avec un contenu strictement identique au build local. L'accueil annonce seize usages et le Studio expose « Audio », « Agent IA » et la méthode CROP.
- Aucun appel à un fournisseur externe, aucun stockage et aucune modification de Supabase, Stripe, de l'authentification, des migrations ou des données Qualiopi n'ont été ajoutés pendant cette publication.

## Sprint 1 — refonte UX de la version gratuite — 20 juillet 2026

- Le sélecteur historique est remplacé par des cartes accessibles regroupant les seize catégories dans cinq familles, avec recherche sans distinction de casse ou d'accent, quatre raccourcis populaires et un résumé compact après sélection.
- Chaque catégorie propose cinq exemples contextualisés modifiables. Le parcours CROP dispose d'un indicateur de progression, d'aides pédagogiques et de messages d'erreur reliés aux champs.
- Le brouillon est sauvegardé uniquement dans `localStorage`, avec validation, expiration, restauration et suppression. Aucune saisie n'est transmise à un serveur.
- La zone de résultat distingue le prompt, le score, les critères, les éléments manquants, les recommandations et les actions. La copie fournit un retour accessible et une solution de repli en cas d'échec.
- Le chargement différé des moteurs de catégorie réduit le JavaScript initial du Studio sans modifier les règles métier, les prompts ni les scores produits pour des données identiques.
- Le typecheck, le lint, les 124 tests applicatifs, Stripe et Studio, les 40 scénarios navigateur ordinateur/mobile et le build de production ont été exécutés. Trente-neuf scénarios navigateur ont réussi et un scénario prévu par la configuration a été ignoré.
- La publication IONOS a contrôlé les 152 fichiers du build par SHA-256 : 82 fichiers ont été transférés et 70 étaient déjà identiques, pour 141 285 644 octets vérifiés.
- L'accueil, `/studio/`, le JavaScript et les styles du Studio, le sitemap et `robots.txt` répondent en HTTPS avec un contenu strictement identique au build local. L'URL canonique reste `https://formaprompt.com/studio/`.
- Aucun schéma, aucune migration et aucune donnée Supabase, Stripe ou Qualiopi n'a été modifié pendant ce sprint et cette publication.

## Sprint 1.1 — UX, prévisualisation et pédagogie — 20 juillet 2026

- Le formulaire et la prévisualisation sont réunis dans un espace de travail en deux colonnes sur ordinateur. Sur mobile, le prompt et le score s’ouvrent dans un panneau compact annoncé par « Score actuel ».
- La prévisualisation utilise le constructeur déterministe de la catégorie avec une temporisation de 400 ms. Les repères pédagogiques des informations absentes ne sont jamais copiés dans le prompt final.
- Le score CROP en direct utilise exactement le moteur existant et conserve la répartition Contexte 25, Rôle 15, Objectif 25 et Précisions 35. Trois améliorations prioritaires au maximum renvoient vers les champs concernés.
- Quatre exemples deviennent des modèles guidés à variables pour le courriel, LinkedIn, la formation et la création d’image. Un modèle ne génère rien automatiquement et n’écrase pas une saisie sans choix explicite.
- Des aides contextuelles repliables expliquent CROP avec une question, une erreur fréquente et un exemple amélioré. Les contenus longs sont condensés dans des blocs repliables, complétés par cinq exemples publics et un bloc auteur daté.
- L’action « Tester dans mon IA » copie d’abord le prompt puis propose les adresses officielles de ChatGPT, Claude, Gemini, Mistral et Copilot. Le prompt n’est jamais ajouté à l’URL ni transmis automatiquement.
- Le brouillon reste exclusivement dans `localStorage`. Les textes de confidentialité ont été corrigés et l’adresse de contact visible est centralisée sur `thierry@formaprompt.com`. Aucun fournisseur d’analytics n’étant configuré, l’interface d’événements reste sans effet réseau et n’accepte aucun contenu de prompt.
- Le formulaire, le panneau en direct et le résultat sont chargés à la demande. Le JavaScript initial du Studio est passé de 190,6 à 136,9 Kio et le logo d’en-tête ne bloque plus le rendu principal.
- TypeScript, lint, les 39 tests applicatifs, les 10 tests Stripe et les 85 tests Studio réussissent, soit 134 tests. Le build et le pré-rendu réussissent.
- Les 42 scénarios navigateur ont été relancés sur ordinateur et mobile : 41 ont réussi et un scénario prévu par la configuration a été ignoré.
- Lighthouse local du build final : mobile 99/98/100/100 et ordinateur 100/98/100/100 pour performance/accessibilité/bonnes pratiques/SEO. Le LCP mobile mesuré est de 1,7 s, le TBT de 30 ms et le CLS de 0.
- La version Sprint 1.1 a été déployée sur IONOS après autorisation explicite. Les 161 fichiers du build, soit 141 323 482 octets, ont été vérifiés par SHA-256 : 91 fichiers ont été transférés et 70 étaient déjà identiques. La page pré-rendue `studio/index.html` a été contrôlée séparément afin de garantir sa publication avec les ressources du Studio.
- La page publique répond en HTTPS avec un HTML strictement identique au build local, les nouveaux styles sont chargés et l’URL canonique reste `https://formaprompt.com/studio/`. Aucun schéma, migration ou donnée Supabase, Stripe ou Qualiopi n’a été modifié.
- Point de vigilance pour les prochaines publications : la procédure SFTP doit inclure tous les fichiers `index.html` imbriqués, notamment `dist/studio/index.html`, et conserver uniquement `dist/index.html` comme dernier fichier transféré.

## Sprint 1.1.1 — cohérence, confidentialité et validation — 22 juillet 2026

- Les textes publics décrivent désormais le fonctionnement réel : le brouillon reste dans le stockage local du navigateur, peut être supprimé et aucune saisie n’est envoyée à FormaPrompt ni à un fournisseur d’intelligence artificielle.
- Les coordonnées publiques utiles sont centralisées dans `webapp/src/config/site.ts` avec le domaine `formaprompt.com`, l’adresse `thierry@formaprompt.com` et l’identité du responsable. Aucune référence publique à `formaprompt.fr` ne subsiste.
- Le Studio accepte une situation professionnelle réelle décrite avec des termes génériques. Les contenus ne prétendent plus qu’une fonction d’anonymisation automatique existe et le vocabulaire visible privilégie « courriel ».
- Le focus vers le formulaire attend maintenant son chargement différé réel. La navigation clavier et les annonces accessibles restent fonctionnelles.
- La prévisualisation et le score en direct ont été comparés au résultat final sur les catégories Courriel, Formation, Analyse et synthèse, Création d’image, Code et Agent IA sans modification des moteurs ni du barème.
- Le brouillon versionné est couvert pour la sauvegarde, la restauration, la poursuite de saisie, la suppression, les données corrompues ou expirées et l’indisponibilité de `localStorage`, sans appel réseau.
- « Tester dans mon IA » copie le prompt puis ouvre l’adresse HTTPS officielle dans un nouvel onglet, sans paramètre ni fragment. En cas d’échec de copie, aucun onglet n’est ouvert et un lien manuel est proposé.
- Les contrôles Chrome couvrent les 16 catégories, les règles WCAG automatisables, les largeurs de 320 à 1 920 px et les reflows équivalents aux zooms 125, 150 et 200 %, sans débordement horizontal.
- TypeScript et lint réussissent. Les 39 tests applicatifs, 10 tests Stripe et 101 tests Studio réussissent, soit 150 tests. Les 44 scénarios Chrome donnent 42 réussites et 2 scénarios ignorés volontairement par la matrice ordinateur/mobile.
- Aucun schéma, migration ou donnée Supabase, Stripe ou Qualiopi n’a été modifié.
- Après autorisation explicite de Thierry, la version Sprint 1.1.1 a été déployée sur IONOS le 22 juillet 2026. Les 161 fichiers du build, soit 141 324 936 octets, ont été comparés par SHA-256 : 90 fichiers ont été transférés, 71 étaient déjà identiques et aucune divergence n’a été détectée. L’accueil et `/studio/` répondent en HTTPS avec un contenu strictement identique au build local ; les URL canoniques restent `https://formaprompt.com/` et `https://formaprompt.com/studio/`.
- Le commit et le push de clôture ont été réalisés après la même autorisation explicite.

## Commandes utiles

À lancer dans `C:\Users\Thier\OneDrive\Documents\formation\Formaprompt\webapp` :

```powershell
npm run dev
npm run lint
npm run build
```

Adresse locale habituelle : `http://127.0.0.1:5173/`

## Précautions

- Vérifier `git status` avant toute nouvelle modification.
- Ne pas supprimer de données Supabase, notamment les preuves Qualiopi, sans autorisation explicite.
- Ne pas modifier une migration déjà appliquée : créer une nouvelle migration corrective.
- Respecter le RGPD pour toutes les données d'apprenants, signatures, questionnaires et paiements.
- Ne jamais placer de clé API, mot de passe ou secret dans le code ; utiliser les variables d'environnement.
- Ne pas effectuer de commit, push, déploiement ou modification de production sans accord explicite.
- Préserver les modifications non liées déjà présentes dans le dépôt.
