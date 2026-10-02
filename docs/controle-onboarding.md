# Contrôle indépendant — accueil et aide apprenant

Contrôle local du 1 octobre 2026, branche `codex/onboarding-apprenant-20261001`, base `d7aa2e6`. Niveau renforcé : identité apprenant, droits LMS et session. Aucun compte réel, appel de données Supabase réel, envoi de mail, commit ou publication effectué par ce contrôle.

## Résultats vérifiés directement

- Helper : `node --test src/lib/learnerOnboarding.test.js`, 7 tests réussis, 0 échec.
- Interface et hébergement : `npx vitest run --config vitest.config.ts src/pages/DashboardOnboarding.test.jsx src/pages/LearnerGettingStarted.test.jsx src/pages/OnboardingRoutes.test.jsx src/pages/OnboardingHosting.test.js`, 24 tests réussis dans 4 fichiers, 0 échec. Exécution finale à 14:18:54, heure locale.
- Lecture des différences : lecture de progression filtrée par `user_id`, contrôle du propriétaire de chaque ligne de leçon, catalogue de parcours et leçons connus ; simple consultation `in_progress` exclue du signal de progression. Les réponses d'exercice sont lues avec filtre utilisateur. Le composant du tableau de bord est recréé au changement d'identité ; une garde `active` ignore les résultats tardifs. Les tests couvrent changement de compte et résultat tardif, ligne d'un autre propriétaire, indisponibilité de progression et stockage local bloqué.
- Configuration publique rechargée sans cache ; médias limités au dossier `/media/onboarding/` de la même origine, sans jeton, fragment ou paramètre. Le marqueur local est propre au compte et à la version ; il ne donne aucun droit et ne modifie aucune progression.
- Les routes tableau de bord et aide passent par `RequireAuth`. Une session absente ou retirée protège l'aide dans les tests. Le nouvel accès Apache est limité à `aide/bien-demarrer` et placé avant la règle 404 ; aucun élargissement générique de toutes les routes d'aide.
- `git diff --name-only -- src/pages/CoursePlayer.jsx src/pages/LearningPath.jsx src/lib/courseAccess.js src/lib/courseAccessLifecycle.js supabase` : aucune différence. Les lecteurs existants, droits et fichiers Supabase sont inchangés.

## Vérification navigateur locale

Serveur `http://127.0.0.1:4181`, navigateur isolé, compte fictif `demo.apprenant@example.invalid`. Avant navigation, toutes les requêtes vers les domaines Supabase sont remplacées par des réponses fictives et les autres domaines distants sont bloqués ; seules les ressources locales sont chargées. Aucune leçon réelle n'a été ouverte. Les fixtures du tableau de bord ne comprennent aucun droit ni document réel.

- Tableau de bord et aide consultés à 1440 × 1000 et 320 × 800. À 320 pixels, largeur du document = largeur de fenêtre, sans défilement horizontal. Raccourcis mobiles visibles, titres et boutons lisibles. Captures relues visuellement.
- Navigation du bouton « Découvrir mon espace » vers l'aide constatée. Au clavier, Tab atteint « Retour à mon espace apprenant » avec contour visible.
- Aide sans média : zéro élément vidéo ; guide présent ; un seul élément `main` ; métadonnée `noindex, nofollow` constatée.
- Navigateur anonyme séparé : accès direct à l'aide redirigé vers `/login?redirect=%2Faide%2Fbien-demarrer`, guide privé absent. Un premier contrôle utilisait le mauvais titre « Connexion » et a expiré ; le contrôle corrigé vérifie le titre réel « Bon retour ! » et la destination.
- Fixture temporaire de vidéo WebM locale absente : lecteur avec contrôles, `preload=none`, `autoplay=false`, `paused=true`, source sans type MIME MP4 imposé et piste française configurée. Aucun marqueur de consultation créé à l'ouverture. Après tentative de lecture, le repli « La vidéo ne peut pas être chargée » est affiché, le lecteur retiré, le guide conservé et le marqueur toujours absent. Aucun fichier vidéo ni sous-titre n'a été créé.
- Axe sur le contenu principal de l'aide : trois violations initiales `link-in-text-block` corrigées par soulignement des liens dans les paragraphes ; nouveau contrôle après correction : zéro violation sur ce périmètre. Cela ne constitue pas un audit d'accessibilité exhaustif du site.

Captures : `webapp/output/playwright/onboarding-control/dashboard-desktop.png`, `dashboard-mobile320.png`, `aide-desktop.png`, `aide-mobile320.png`. Les journaux automatiques de la CLI sont des artefacts de contrôle, pas du code applicatif.

## Corrections intégrées et limites

Le contrôle a signalé l'incohérence d'un type `video/mp4` imposé pour des URLs WebM/OGV ; le type forcé a été supprimé par l'agent interface. Le contrôle Axe a motivé le soulignement des liens du guide. La route, les sections du guide et le cahier de tournage concordent avec les actions existantes : brouillon, réponse terminée et validation du formateur distincts, reprise à la leçon, ressources et documents conditionnels. Aucune page de profil éditable n'est annoncée.

La vidéo finale, ses sous-titres, son son, son hébergement et la lecture d'un vrai média restent à contrôler lorsqu'ils seront disponibles. Les droits réels et règles RLS de production n'ont pas été interrogés. Les tests généraux et le build sont exécutés et consignés séparément par le coordinateur ; ce rapport n'en déduit aucun résultat. Le mail de confirmation existant et un éventuel message de bienvenue distinct ne sont pas modifiés.

Avis : aucune anomalie bloquante restante observée dans le périmètre local contrôlé. Le lot est prêt pour revue de Thierry ; cet avis n'autorise ni fusion ni publication.

## Bilan final du coordinateur

État : **PASS AVEC RÉSERVES**. Les skills de coordination, Supabase et Playwright ont conduit à séparer réalisation et contrôle, conserver les droits existants et tester uniquement avec des comptes fictifs locaux. Aucune vidéo créée, aucune migration, aucun email envoyé, aucun commit, push, demande de fusion, fusion ou déploiement.

### Fonctionnement livré

- Accueil sous le titre de `/dashboard`, avant les diagnostics et formations ; titre, description et bouton « Découvrir mon espace » conformes à la mission.
- Lien permanent « Aide » dans la navigation connectée, ordinateur et mobile, et « Aide → Bien démarrer » dans le tableau de bord ; destination `/aide/bien-demarrer`.
- Nouveau compte : accueil développé après chargement réussi, sans exercice connu commencé ni module connu terminé. Compte actif : accueil compact. Une simple consultation de module ne suffit pas. Pendant chargement ou erreur de progression : état compact neutre, sans conclure que l'apprenant est nouveau.
- La lecture réelle de la vidéo (`playing`) crée uniquement une préférence locale par compte et version. Ouvrir l'aide ou échouer à lire ne la crée pas. Cette préférence n'est pas synchronisée entre appareils ; elle demeure dans le navigateur jusqu'à son effacement.
- Sans vidéo : guide écrit immédiatement utilisable. Avec vidéo : lecteur natif volontaire, sans lecture automatique, avec miniature et sous-titres lorsqu'ils sont renseignés ; descriptif configurable affiché. Les formations restent accessibles indépendamment de la configuration vidéo.
- Aucun écran de profil éditable n'existe dans le LMS audité ; le guide situe l'adresse du compte dans le tableau de bord et les procédures de connexion existantes, sans inventer une fonctionnalité.

### Contrôles globaux réellement exécutés

Depuis `C:\fp-onboarding-apprenant-20261001\webapp`, sur le code final :

| Contrôle | Résultat |
| --- | --- |
| `npm run test:app` | 193 réussis, 0 échec. |
| `npm run test:stripe` — tests existants, sans modification des paiements | 311 réussis, 1 ignoré car fichier LIVE local optionnel absent, 0 échec. |
| Suite React `test:studio`, relancée avec 2 workers et rapport JSON | 432 réussis sur 434 ; 2 échecs préexistants du calendrier des groupes. |
| Tests ciblés onboarding | Helper 7/7 et interface/routes/hébergement 24/24. |
| `npm run test:release` | 7/7. |
| `npm run lint`, puis `npm run typecheck` | Réussis, codes de sortie 0 après corrections finales. |
| `npm run build` complet | Réussi : construction, pré-rendu public et vérification ; 285 fichiers, 32 pré-rendus, 929 références d'assets. |
| Contrôle du JSON construit et du service worker | JSON présent et identique à la source ; absent du précache. |
| `git diff --check` et contrôle du périmètre protégé | Sans erreur ; aucun changement Supabase, Stripe, lecteurs pédagogiques, règles de droits ou Training Lab. |

La construction utilise uniquement la configuration publique Vite validée, sans afficher sa clé et sans contourner les contrôles existants. L'avertissement Browserslist sur l'ancienneté des données est non bloquant ; aucune dépendance n'a été mise à jour.

Les deux tests en échec sont `AdminCourseCohorts.test.jsx` : conservation de choix répartis sur plusieurs mois et chargement mensuel sous StrictMode. Ils attendent septembre 2026 alors que le composant initialise le mois courant à octobre. L'agent configuration les a exécutés aussi sur la base `d7aa2e6` : mêmes deux échecs, 11 réussites, composants et tests identiques par SHA-256, dépôt de départ toujours propre. Aucun correctif hors périmètre n'a été fait. La suite globale n'est donc **pas verte**.

### Fichiers du lot

Modifiés : `webapp/src/App.jsx`, `webapp/src/pages/Dashboard.jsx`, `webapp/src/components/Header.jsx`, `webapp/src/components/Header.test.jsx`, `webapp/src/components/Layout.jsx`, `webapp/public/.htaccess`, `webapp/vite.config.js` et `suivi-formaprompt.md`.

Ajoutés : `webapp/src/components/LearnerWelcome.jsx`, `useLearnerOnboarding.js`, `LearnerOnboarding.css` ; `webapp/src/pages/LearnerGettingStarted.jsx`, `LearnerGettingStarted.test.jsx`, `DashboardOnboarding.test.jsx`, `OnboardingRoutes.test.jsx`, `OnboardingHosting.test.js` ; `webapp/src/lib/learnerOnboarding.js`, `learnerOnboarding.test.js` ; `webapp/public/config/learner-onboarding.json` ; `docs/onboarding-video-configuration.md`, `docs/cahier-tournage-onboarding.md` et ce rapport.

Ces changements préparent un accueil minimal, une aide durable, une configuration remplaçable et leurs contrôles. Aucun paquet ajouté. Les captures, rapports JSON et journaux sont des artefacts locaux sous `output/`, exclus de Git.

### Base, email et prochaine vidéo

Impact en base : aucune écriture ni modification de schéma. Une lecture supplémentaire des modules terminés, filtrée sur le compte connecté, exploite la table de progression existante ; les politiques RLS sont vérifiées dans les migrations, pas réinterrogées en production. Aucun droit ni progression pédagogique utilisé pour enregistrer la consultation du tutoriel.

La confirmation de création de compte est déléguée à Supabase Auth ; son retour existant mène à `/dashboard`. Aucun email de bienvenue distinct après activation trouvé. Le template réel non versionné reste à vérifier avant d'y ajouter « Découvrir mon espace apprenant » ; aucune nouvelle infrastructure ni pièce jointe MP4.

Quand la vidéo sera produite et validée : suivre `docs/cahier-tournage-onboarding.md` (3 min 20), vérifier masquages et droits des médias, préparer miniature et sous-titres, renseigner titre/descriptif/durée réelle et chemins publics dans le JSON, changer sa version si nécessaire, puis tester un vrai média et son repli sur ordinateur/mobile/clavier. Les champs médias sont actuellement `null`, sans fausse URL. Après publication initiale autorisée du code, le JSON et les médias pourront être remplacés seuls, sans reconstruire les pages. Tout transfert exige un accord distinct.

Contrôle : **RENFORCÉ**. Fusion recommandée maintenant : **NON** ; validation de Thierry attendue et deux tests généraux préexistants à stabiliser dans un lot séparé. Le code d'onboarding local est prêt à être examiné.
