# Vidéo de prise en main de l’espace apprenant

La V2 validée par Thierry est intégrée localement le 2 octobre 2026 : un seul MP4 dédié, `/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4`, servi depuis la même origine que le site. Le JSON runtime active la version `2`, annonce `3 min 17 s` et ne définit ni miniature ni piste VTT. Les sous-titres français sont déjà incrustés dans l’image ; le lecteur l’indique explicitement. L’accueil et le guide texte restent disponibles lorsqu’aucun média n’est configuré ou lorsque le fichier de configuration ne répond pas. Cette intégration ne constitue pas une publication sur IONOS.

## Configuration sans reconstruire les pages

Le fichier `webapp/public/config/learner-onboarding.json` est copié vers `/config/learner-onboarding.json` lors de la construction. Le navigateur le charge à l’ouverture avec `cache: no-store`. Après publication initiale du code, on peut remplacer uniquement ce JSON et les médias publics sur l’hébergement, sans reconstruire le site. Toute publication reste soumise à l’autorisation de Thierry et à la procédure de release existante.

| Champ | Valeur et usage |
| --- | --- |
| `enabled` | Booléen ; active l’accueil configurable. |
| `version` | Texte, par exemple `1` ; changer cette valeur pour proposer à nouveau une vidéo remplacée. |
| `title` | Titre, maximum 160 caractères. |
| `description` | Texte simple, maximum 1 200 caractères, sans HTML. |
| `durationLabel` | Durée réelle une fois connue ; `null` en attendant. |
| `videoUrl` | Chemin public depuis la racine ou URL HTTPS de la même origine ; `null` en attendant. |
| `thumbnailUrl` | Miniature publique de la même origine ; `null` possible. |
| `captionsUrl` | Sous-titres français WebVTT publics de la même origine ; `null` possible. |
| `captionsEmbedded` | Booléen ; indique des sous-titres déjà incrustés dans l’image, sans créer de piste VTT. `false` par défaut et sans vidéo. |

Les médias doivent être placés dans le dossier public dédié `/media/onboarding/` sur l’hébergement ; la copie locale V2 se trouve dans `webapp/public/media/onboarding/`. Seuls ses chemins sont acceptés. Les URLs externes, protocoles exécutables, identifiants dans l’URL, paramètres et fragments sont refusés. Les chemins privés, API, authentification et stockage signé sont également refusés. Formats acceptés : vidéo `.mp4`, `.webm`, `.ogv` ; miniature `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif` ; sous-titres `.vtt`. Les URLs absolues doivent correspondre exactement à l’origine affichée, y compris le sous-domaine. Préférer un chemin depuis la racine pour les démonstrations locales.

Le bouton « Découvrir mon espace » ouvre cette même page d’aide au repère vidéo et place le focus sur son titre, sans lecture automatique. Le lecteur natif reste manuel (`controls`, `preload="none"`, `playsInline`). Une modification de l’URL ou de la version recrée le lecteur, y compris après une erreur de média ; le guide écrit reste présent dans tous les cas. Le MP4 est public par URL directe : seules les pages de l’espace sont soumises à connexion. Ce contenu générique validé ne doit comporter aucune donnée réelle ni contenu de formation payante.

Copie source V2 conservée sans conversion ni édition : 36 752 453 octets ; SHA-256 source et copie locale identique `F789A022E206D565D1DAFB406ED240E8F1E2598FAF850CAD8DEC7216F6A81E4D`. La durée affichée provient du rapport V2 validé (197,32 secondes) et doit être confirmée par le contrôle indépendant du lecteur. Aucun changement Supabase, Stripe, email ou accès de formation n’est nécessaire. Le `.htaccess` fournit le type `video/mp4` pour ce seul nom de fichier et `Cache-Control: no-store` pour le JSON runtime.

Une exception unique du `.gitignore` racine rend ce MP4 initial versionnable (moins de 100 Mo) afin qu’un futur clone puisse reconstruire le lot complet ; tous les autres MP4 restent ignorés. Aucun enregistrement Git n’est effectué dans ce lot local. Vite copie normalement le dossier `public` vers l’artefact construit : il n’existe qu’un fichier source MP4 partagé par l’accueil et l’aide, sans copie propre à chaque écran. Après publication initiale autorisée, les médias et leur JSON pourront être remplacés séparément sans reconstruire les pages.

Utiliser une vidéo publique consacrée à la prise en main générale, sans nom, email, réponse d’apprenant, document privé, identifiant ou jeton visible. Ne pas recopier une URL de cours payant, même si son extension est `.mp4`. La validation d’une URL ne peut pas certifier à elle seule que son contenu est public : vérifier le fichier publié. Aucune ressource pédagogique privée ne doit entrer dans ce JSON.

Servir les vidéos avec le bon type MIME (`video/mp4`, `video/webm` ou `video/ogg`) et permettre la lecture partielle HTTP. Servir la miniature avec son type image et les sous-titres avec `text/vtt` en UTF-8. Les sous-titres français sont recommandés pour l’accessibilité. Tester le lecteur, la miniature et les sous-titres sur mobile et au clavier après remplacement. La configuration doit rester un vrai JSON, sans commentaire ni virgule finale.

## Consultation et données

Le marqueur `formaprompt:onboarding-video-seen:<compte>:<version>` ne conserve que `seen` dans le navigateur. Il sert au confort d’affichage : il ne confère aucun accès, ne valide aucune formation et ne modifie ni la progression ni le profil Supabase. Le marqueur est enregistré au démarrage réel de la lecture (`playing`), pas lors d’une simple ouverture ou d’une tentative de lecture. « Consultée » signifie donc ici « lecture commencée », et ne certifie pas un visionnage complet. Si le stockage est bloqué, l’enregistrement retourne `false` sans exception. Il n’est pas synchronisé entre appareils et disparaît lorsque le stockage du navigateur est effacé. Aucun suivi de navigation entre pages ou service tiers n’est ajouté.

Le JSON est public et ne contient aucune donnée personnelle. Aucun schéma, grant, règle RLS ou infrastructure d’email n’est nécessaire pour ce fonctionnement.

## Cache et emails existants

L’application possède un service worker PWA. La version Workbox installée précache par défaut les fichiers JS, WASM, CSS et HTML, et aucun cache runtime générique n’est configuré. `webapp/vite.config.js` exclut aussi explicitement `/config/learner-onboarding.json` du précache, pour préserver son fonctionnement même si les extensions précachées évoluent. Le remplacement des navigations par une page précachée est désactivé. La validation de l’artefact construit doit confirmer que le JSON n’est pas précaché. Un éventuel cache HTTP/CDN de l’hébergeur doit également respecter la mise à jour du fichier.

À la création du compte, `Register.jsx` appelle `secureSignup`, puis la fonction `secure-password-auth` appelle Supabase Auth `signUp` avec un retour de confirmation vers `/dashboard`. Le dépôt ne contient aucun mail de bienvenue distinct envoyé après activation ; le transport SMTP existant couvre d’autres messages métier. Le contenu réel du template de confirmation et les réglages SMTP Auth restent à vérifier dans Supabase.

Proposition pour un lot ultérieur : ajouter un lien vers l’espace apprenant et sa rubrique « Bien démarrer » dans le template de confirmation déjà existant, après vérification de ce template. Aucun template, paramètre Auth ou email n’a été modifié ou envoyé dans ce lot. Créer un véritable mail après activation nécessiterait un flux distinct avec déclenchement et dédoublonnage ; ce fonctionnement n’est pas ajouté ici.
