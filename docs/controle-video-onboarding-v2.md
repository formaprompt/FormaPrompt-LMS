# Contrôle indépendant de l’intégration vidéo V2

Contrôle local exécuté le 2 octobre 2026 à 06:25:58 UTC (08:25:58 Paris), résultat **PASS**, code de sortie 0. Rapport brut : `webapp/output/playwright/onboarding-video-integration/verification.json`. Aucun commit, service de production, compte réel ou déploiement.

## Environnement et reproduction

Depuis PowerShell, dossier `C:\fp-onboarding-apprenant-20261001\webapp` :

```powershell
node scripts/verify-onboarding-video.mjs
```

Le contrôle CLI utilise `launchOnboardingDemo({ headless: false, videoIntegration: true })`, le même lanceur certifié que le tournage. Chrome démarre avec un contexte neuf, réseau filtré avant la première page, services workers bloqués, données et authentification fictives en mémoire. Origine et port uniques : `http://127.0.0.1:4182`. Aucune spécification `@playwright/test`, dépendance ajoutée, capture vidéo ou réencodage.

Le mode explicite `--video-integration` sert le JSON runtime réel et autorise uniquement `/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4`. Les chemins MP4 autres, le média privé d’essai et `/sw.js` répondent 403. Une configuration absente, invalide, comportant un autre média, une miniature ou un fichier de sous-titres est refusée. Le mode de tournage par défaut reste sans vidéo ; le contrôle original `node scripts/verify-onboarding-demo.mjs` a également réussi 8/8, zéro réponse externe.

## Résultats observés

| Contrôle | Preuve réelle |
| --- | --- |
| Nouvel apprenant, « Découvrir mon espace » | Guide et lecteur V2 affichés ; source exacte attendue. |
| Aide du menu | Même URL vidéo ; lecteur arrêté, position initiale zéro. |
| Chargement manuel | `preload=none`, autoplay absent, aucune requête MP4 avant action, état initial arrêté. |
| Clavier et reprise | Vidéo focalisée ; Espace démarre, temps progresse ; Espace met en pause ; Espace reprend. |
| Volume | Flèche bas sur le lecteur natif passe réellement de 1 à 0,95. |
| Audio | Décodage AAC observé dans Chrome ; AudioContext actif et signal non nul. Volume 0,4, mute/unmute observés via API média. |
| Plein écran | Véritable `document.fullscreenElement` vidéo après clic avec activation utilisateur ; capture 1440 px et paysage 844 × 390. |
| Fin | Seek vers les dernières 0,5 s puis lecture : événement/état `ended=true`, arrêt à 197,322993 s. |
| Petits écrans | 320 et 390 px, vidéo dans le viewport, aucun débordement horizontal. Captures en lecture à 20 s et en fin. |
| Accessibilité automatisée | Axe exécuté dans la page isolée, périmètre `.learner-getting-started` : zéro violation ; vérification humaine `video-caption` requise. |
| Média indisponible | Interception de l’unique MP4, message d’échec rendu ; guide écrit et retour tableau de bord fonctionnels. |
| Serveur média local | Range `bytes=0-1023` : 206, `video/mp4`, `Content-Range: bytes 0-1023/36752453`, 1024 octets. |
| Intégrité | SHA-256 `F789A022E206D565D1DAFB406ED240E8F1E2598FAF850CAD8DEC7216F6A81E4D`, correspondant au fichier validé. |
| Isolation | Zéro réponse externe, aucune erreur JavaScript de page, aucun module auth/Supabase réel/entrée normale chargé. Journal HTTP local conservé séparément du journal navigateur. |

Les captures plein écran et mobiles ont été ouvertes et relues. Les sous-titres sont bien incrustés dans les images du fichier, et ne constituent pas une piste VTT activable. À 320 px en lecture intégrée, leur taille est petite ; les commandes natives affichées peuvent masquer le bas de l’image. La capture plein écran paysage affiche des caractères nettement plus grands. L’aide conseille donc le plein écran paysage ; le guide écrit reste disponible. Cette observation ne permet pas d’annoncer une lisibilité équivalente au bureau.

La sortie du plein écran est vérifiée via `document.exitFullscreen()` : la touche Échap injectée par l’automatisation Chrome ne l’a pas quitté de façon fiable. L’entrée utilise réellement un clic utilisateur et le plein écran du navigateur ; elle ne constitue pas une imitation CSS. Le contrôle axe est injecté dans la même page, car AxeBuilder ouvre une page supplémentaire interdite par l’isolation ; cette protection reste active.

Tests complémentaires réellement exécutés : `node --test src/lib/learnerOnboarding.test.js` **8/8** ; `npx vitest run src/pages/LearnerGettingStarted.test.jsx src/pages/DashboardOnboarding.test.jsx --config vitest.config.ts` **23/23**. Ils couvrent notamment consultation par compte/version, stockage absent ou bloqué, données runtime et remplacement du lecteur sur changement de compte/configuration. ESLint ciblé sur les fichiers de contrôle réussi. Le diff des composants CoursePlayer, LearningPath, TrainingDocument, de l’auth réelle, du client Supabase et du dossier Supabase est vide par rapport à Git.

## Limites explicites

Présence d’un signal audio et décodage vérifiés, aucune prétention à une écoute humaine ni à une sortie audible sur les haut-parleurs. Les états mute/unmute sont exercés via API ; le volume a aussi été modifié avec le clavier natif. Tests Chrome Windows avec viewports simulés : aucun téléphone physique, Safari/iOS ou autre navigateur. Les contrôles HTTP concernent Vite local ; Range/MIME/cache/lecture sur IONOS restent non testés, car aucune publication n’est autorisée. L’absence de réseau externe concerne l’application dans le contexte isolé, pas toutes les activités de Windows/Chrome.

Fichiers du contrôleur : `webapp/demo/isolation.js`, `webapp/vite.demo.config.js`, `webapp/scripts/start-onboarding-demo.mjs`, nouveau `webapp/scripts/verify-onboarding-video.mjs`, ce rapport. Aucune modification produit, JSON ou MP4 par le contrôleur. Les artefacts PNG/JSON sont dans le dossier local de preuves exclu de Git.

IMPORTANT MAINTENANT : intégration locale vérifiée ; conserver le fichier V2 et son hash.

À FAIRE ENSUITE : vérification d’hébergement uniquement lors d’une publication distinctement autorisée.

PEUT ATTENDRE : contrôles téléphone réel et autres navigateurs.

BLOQUANT : Aucun pour l’intégration locale contrôlée.

DÉCISION THIERRY NÉCESSAIRE : accord distinct avant commit, transfert ou déploiement.

## Bilan du coordinateur du site

État : **PASS pour l’intégration locale — contrôle RENFORCÉ**. Thierry a validé explicitement ce MP4 dans sa mission du 2 octobre 2026 ; aucune nouvelle version n’a été produite. La branche reste `codex/onboarding-apprenant-20261001`, dans `C:\fp-onboarding-apprenant-20261001`, base `d7aa2e6`. Les changements des précédents lots d’accueil et de démonstration, encore non commités, ont été conservés. Le coordinateur a relu les modifications sensibles, les journaux JSON finaux et les captures.

### Stockage retenu et alternatives

| Possibilité | Compatibilité et contraintes | Décision |
| --- | --- | --- |
| MP4 sur IONOS, même origine, dossier dédié | Réutilise l’hébergement et le JSON runtime déjà prévus ; aucun nouveau service. Pages authentifiées, lien direct public pour une vidéo générale sans donnée réelle. | Retenu |
| Supabase Storage public distinct | Nouveau bucket et origine externe à configurer ; URL publiquement accessible aussi, sans avantage nécessaire pour ce fichier. | Non retenu |
| Supabase Storage privé distinct | Lecture autorisée ou URL temporaire et règles supplémentaires ; pertinent si le média devenait confidentiel, inutile pour cette prise en main générique. | Non retenu |
| Lecteur vidéo externe | Dépendance, intégration et éventuelles règles de confidentialité d’un service supplémentaire ; non nécessaire pour le MP4 validé. | Non retenu |

Les modèles public et privé de Storage sont décrits dans la [documentation Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals). Aucun bucket, politique, fonction ou paramètre Supabase n’a été créé ou modifié. Aucun abonnement ou tarif supplémentaire n’est engagé ; les limites contractuelles d’espace et de trafic IONOS ne sont pas réauditées dans cette mission locale.

Fichier source du site : `webapp/public/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4`. Destination prévue après une publication autorisée : `/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4`. Un seul fichier sert les deux accès ; sa copie dans `dist` est l’artefact normal de construction, pas un second média propre à l’aide. Source validée, fichier public local et artefact construit ont la même empreinte SHA-256 et la même taille, 36 752 453 octets. Le fichier n’a été ni converti ni réencodé.

### Accès et comportement

- Tableau de bord : bloc « Bienvenue dans votre espace FormaPrompt », bouton « Découvrir mon espace ». Il ouvre `/aide/bien-demarrer#learner-intro-video`, place le focus sur le titre et permet une lecture volontaire dans le lecteur natif.
- Accès permanent : menu « Aide », page « Bien démarrer », même vidéo et guide écrit. Rien n’est lancé automatiquement, y compris avec le son.
- Nouveau compte sans progression : panneau particulièrement visible. Dès que la lecture commence réellement, le marqueur local existant du compte et de la version rend l’accueil plus discret au retour. Une progression réelle existante le rend aussi compact. Ce marqueur n’est ni une validation de formation ni une preuve de visionnage complet, et n’est pas synchronisé entre appareils.
- Les tests vérifient le changement de compte A/B, les requêtes tardives, les versions et le stockage absent ou bloqué. Aucune réponse, progression ou donnée personnelle n’est ajoutée par la vidéo ; tous les apprenants voient le même contenu fictif validé.
- Guide écrit intégral maintenu. Échec du MP4 ou de sa configuration : ni le guide ni l’accès à l’espace apprenant ne sont bloqués. Le lecteur est recréé lors d’un changement d’URL/version, même après une erreur.
- Sous-titres incrustés conservés exactement. Ils ne sont pas désactivables ou personnalisables comme une piste séparée. Conseil plein écran paysage ajouté pour les téléphones, sans modifier la vidéo validée.

### Remplacement futur sans reconstruire le front

1. Faire valider le nouveau MP4 sans donnée réelle, conserver son empreinte et un nom versionné dans le même dossier dédié, par exemple `bien-demarrer-espace-apprenant-v3.mp4`.
2. Après autorisation distincte de publication, transférer le nouveau média, vérifier sa lecture, son type MIME et les réponses Range ; ne pas toucher aux vidéos payantes. Si le nouveau nom nécessite un réglage MIME, le limiter à ce média.
3. Remplacer ensuite `/config/learner-onboarding.json` : nouvelle `videoUrl`, nouvelle `version`, durée et déclaration des sous-titres. Le JSON est chargé sans cache ; aucune reconstruction du code n’est nécessaire. Un nouveau nom évite la réutilisation d’une ancienne vidéo par le cache navigateur.
4. Tenir les sources `public/config/` et `public/media/onboarding/`, leur inventaire et le suivi à jour pour qu’une release suivante ne rétablisse pas l’ancienne configuration. Si le nouveau binaire doit être versionné, étendre explicitement l’exception Git à ce seul fichier validé ; tous les autres médias restent ignorés. Conserver l’ancienne version pour retour arrière jusqu’à une décision de nettoyage.
5. Refaire les contrôles lecteur, petits écrans, clavier et panne. Le contrôle local à whitelist stricte doit être adapté explicitement au nouveau chemin et à sa nouvelle empreinte, pas ouvert à tous les MP4.

Pour désactiver seulement la vidéo, mettre `videoUrl` à `null` en conservant `enabled: true` : le guide et son accès restent disponibles. Le retour arrière consiste à restaurer le JSON de la version antérieure, sans migration ni changement de droits.

### Fichiers concernés par ce lot

- `.gitignore` : exception unique pour la V2 validée ; les autres MP4 restent exclus.
- `webapp/public/config/learner-onboarding.json` : version 2, URL unique, durée et sous-titres incrustés.
- `webapp/public/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4` : copie identique du fichier validé.
- `webapp/public/.htaccess` : type MIME ciblé et JSON sans cache. La protection de la capsule payante est inchangée.
- `webapp/src/components/LearnerWelcome.jsx`, `LearnerOnboarding.css` : accès au repère vidéo, focus visible et dimensions 16:9/responsive.
- `webapp/src/pages/LearnerGettingStarted.jsx` et `.test.jsx` : vidéo manuelle, sous-titres signalés, conseil mobile, repli et récupération du lecteur.
- `webapp/src/lib/learnerOnboarding.js` et `.test.js` : déclaration booléenne des sous-titres incrustés et contrôles de configuration ; mécanisme par compte/version conservé.
- `webapp/src/components/AdminCourseCohorts.test.jsx` : stabilisation de la date de deux tests, sans changement du calendrier réel.
- `webapp/demo/isolation.js`, `webapp/vite.demo.config.js`, `webapp/scripts/start-onboarding-demo.mjs`, `webapp/scripts/verify-onboarding-video.mjs` : mode explicite local de contrôle de la V2, toujours isolé des services réels.
- `docs/onboarding-video-configuration.md`, ce rapport et `suivi-formaprompt.md` : configuration, preuves et passation.

Aucune migration, dépendance, règle `course_access`, achat, remboursement, fonction Stripe, webhook, progression pédagogique, contenu payant ou ressource Training Lab modifié. Le diff des fichiers métier protégés et de `package-lock.json` est vide. La branche principale de référence est restée propre au même commit.

### Tests exécutés et calendrier

| Contrôle | Résultat final |
| --- | --- |
| Tests Node applicatifs `npm run test:app` | 194/194 |
| Tests React globaux `npm run test:studio` avec deux workers | 437/437, 82 fichiers, 0 échec et 0 ignoré, relancés sur sources gelées |
| Calendrier `AdminCourseCohorts.test.jsx` | 13/13, dont les deux tests auparavant en échec |
| Tests ciblés onboarding | 8 Node, 27 React réussis ; contrôle indépendant 8 Node et 23 React également réussi |
| Tests serveur existants `npm run test:stripe` | 311 réussis, 0 échec, 1 ignoré préexistant lié à une configuration LIVE locale optionnelle absente ; aucun appel Stripe réel |
| Tests de construction `npm run test:release` | 7/7 |
| `npm run lint`, `npm run typecheck`, ESLint des scripts, `git diff --check` | Réussis |
| `npm run build` complet | Réussi : compilation, 32 pré-rendus et vérification de release ; 286 fichiers, 929 références d’assets |
| Intégrité du paquet | MP4 et JSON identiques aux sources ; ni MP4 ni JSON dans le précache PWA |
| Lecture, desktop/mobile, clavier, panne et réseau | PASS dans le périmètre décrit plus haut |
| Démonstration originale | 8/8, zéro réponse externe, mode par défaut toujours sans vidéo |

Avant correction, les deux tests calendrier échouaient dans le lot local et dans la base `C:\fp-release-main` propre : 11 réussites et 2 échecs identiques. Le composant utilisait correctement octobre, alors que ces tests supposaient septembre. Les fichiers source et tests étaient identiques par SHA-256. La correction fixe uniquement `Date` au 15 septembre 2026 dans ces deux tests, laisse les temporisations asynchrones réelles et restitue systématiquement l’horloge dans `afterEach`. Aucune assertion n’a été retirée, aucun test n’a été ignoré. **Dette préexistante corrigée, pas de régression provenant de la vidéo.** Le SHA-256 du composant réel reste `97223AF561087269E396A14FA41302B0E6E82B1209CC98BEEDCD0667046C28DF`.

La construction utilise uniquement la configuration publique existante validée, sans affichage de clé. Son pré-rendu existant lit les articles publics du blog, notamment par GET Supabase anonyme, et garde le blocage des méthodes susceptibles d’écrire ; aucune session réelle, modification du backend ou publication n’en découle. Ces lectures de construction sont distinctes du contrôle navigateur de la vidéo, intégralement isolé. L’avertissement Browserslist sur l’ancienneté de ses données reste non bloquant, sans mise à jour de dépendances hors périmètre. Le rapport global JSON final et les preuves navigateur sont dans `webapp/output/playwright/onboarding-video-integration/` ; l’inventaire de construction est dans `output/release/`, hors Git.

### Vérifier localement et étapes autorisées

Pour ouvrir la version intégrée avec le compte fictif, depuis PowerShell :

```powershell
Set-Location 'C:\fp-onboarding-apprenant-20261001\webapp'
node scripts/start-onboarding-demo.mjs --video-integration
```

Le compte `demo.apprenant@example.invalid` est connecté automatiquement dans un navigateur dédié. Aucun identifiant réel n’est nécessaire. Fermer ce navigateur ou utiliser Ctrl+C pour arrêter. Le port 4182 doit être libre. Le lancement sans `--video-integration` garde le mode de tournage précédent, sans vidéo, et ne sert pas ce MP4.

Ces commandes décrivent les outils de contrôle conservés dans ce worktree local. Les fixtures, lanceurs, configuration de démonstration, scripts de vérification vidéo, cahier de tournage et rapport de démonstration sont volontairement non versionnés et exclus de la release. Un clone du dépôt produit ne contient pas ces outils ; le script npm temporaire de démonstration a été retiré.

Impact actuel sur la production : **aucun**. Aucun commit, push, demande de fusion, fusion, migration, téléversement de média ou déploiement effectué. Une future publication doit encore vérifier sur IONOS le MIME, les réponses Range, le cache du JSON et les deux routes authentifiées ; elle nécessite un accord explicite distinct. Aucun Docker ou WSL utilisé.

IMPORTANT MAINTENANT : contrôle RENFORCÉ ; fusion recommandée maintenant : OUI, sous réserve de l’accord de Thierry et des contrôles de la future demande de fusion. Ce n’est pas une fusion exécutée.

À FAIRE ENSUITE : validation de ce lot, puis autorisations distinctes pour son enregistrement, son partage, sa fusion et sa mise en production.

PEUT ATTENDRE : essai sur téléphone physique/autres navigateurs et modernisation de Browserslist. Le conseil paysage et le guide écrit couvrent la limite observée des sous-titres en lecture intégrée.

BLOQUANT : Aucun pour l’intégration locale contrôlée.

DÉCISION THIERRY NÉCESSAIRE : accord avant toute opération Git ou publication ; la validation du MP4 ne vaut pas autorisation de mise en ligne.

PRÊT POUR FUSION ET DÉPLOIEMENT - VALIDATION THIERRY REQUISE
