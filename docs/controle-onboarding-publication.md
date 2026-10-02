# Contrôle précommit du lot accueil apprenant et vidéo V2

Préparation vérifiée le 2 octobre 2026, worktree `C:\fp-onboarding-apprenant-20261001`, branche `codex/onboarding-apprenant-20261001`, base `d7aa2e6fc35769a40053b4065567f61a721ed495`. Thierry a validé l'accueil et la vidéo V2 et autorisé commit, push, fusion et déploiement. Ce rapport constate les contrôles locaux précommit ; aucune opération Git de publication ni mise en production n'est exécutée à cette étape.

## Périmètre produit et exclusions

Le lot contient l'accueil apprenant, le guide authentifié et la lecture volontaire de l'unique MP4 V2 validé, leur configuration runtime, leurs tests, les réglages Apache/PWA et les rapports produit. La stabilisation de deux tests calendrier dépendants de la date est incluse, sans modification du composant métier.

`.gitignore` exclut précisément `webapp/demo/`, `webapp/vite.demo.config.js`, les trois scripts locaux `start-onboarding-demo.mjs`, `verify-onboarding-demo.mjs`, `verify-onboarding-video.mjs`, `docs/cahier-tournage-onboarding.md` et `docs/controle-demo-onboarding.md`. Les fichiers sont conservés physiquement et ignorés par Git. Les dossiers de sorties, constructions, environnements et médias hors exception restent exclus. Seule l'exception MP4 V2 validée est conservée.

Le script npm temporaire `demo:onboarding` est retiré : `webapp/package.json` ne présente aucune différence logique par rapport à HEAD, aucune dépendance ajoutée. Les documents produit indiquent désormais `node scripts/start-onboarding-demo.mjs --video-integration` pour l'outil local volontairement non versionné. Un clone produit ne contient pas cet outil.

## Contrôles réellement exécutés après cette préparation

Depuis `C:\fp-onboarding-apprenant-20261001\webapp`, sous PowerShell :

| Contrôle | Résultat |
| --- | --- |
| `npm run test:app` | 194 tests réussis, zéro échec/ignoré |
| `npm run test:release` | 7 tests réussis |
| Vitest ciblé guide, accueil, routes et hébergement avec deux workers | 27 tests réussis, 4 fichiers |
| `npm run test:studio -- --maxWorkers=2 --minWorkers=1` | 437 tests réussis, 82 fichiers, zéro échec/ignoré |
| `npm run lint` et `npm run typecheck` | Réussis |
| `npm run build` complet | Réussi : 286 fichiers, 32 pré-rendus, 929 références d'assets |
| `git diff --check` depuis la racine | Réussi ; avertissements habituels de normalisation CRLF uniquement |
| Fichiers métier protégés et Supabase | Diff vide pour auth/client Supabase, CoursePlayer, LearningPath, TrainingDocument/TrainingLab, achats, remboursements, finance, Stripe et dossier Supabase |

La première tentative de construction a été refusée par la garde existante car la configuration publique disponible ne contenait pas `VITE_SITE_URL`. La construction finale charge en mémoire les seules variables `VITE_` existantes via `loadEnv('production', 'D:/OneDrive/Documents/formation/Formaprompt/webapp', 'VITE_')` et fixe la valeur publique canonique `VITE_SITE_URL=https://formaprompt.com`, déjà exigée par `vite.config.js`. URL Supabase et clé publique ont été vérifiées par booléens sans affichage des valeurs ; aucune écriture `.env`, clé serveur, session réelle ou mutation backend. Le pré-rendu existant lit uniquement les contenus publics du blog ; il ne constitue pas un déploiement. Avertissement Browserslist non bloquant, sans mise à jour de dépendances.

Les contrôles navigateur vidéo et les tests serveur consignés antérieurement dans `controle-video-onboarding-v2.md` n'ont pas été réexécutés pour ces seules exclusions et corrections documentaires. Les suites ci-dessus ont bien été réexécutées. Les essais d'hébergement IONOS restent à faire lors de la publication autorisée.

## Intégrité et absence de démonstration dans la release

Source et copie `dist/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4` : SHA-256 `F789A022E206D565D1DAFB406ED240E8F1E2598FAF850CAD8DEC7216F6A81E4D`. JSON source et construit : SHA-256 `8E7DA50BAF40FF6D568D54711F50639B507B9169C48D37BB0F71E5181366EDD1`.

Recherche exécutée dans les fichiers JS/HTML/CSS construits : absence de `__FORMAPROMPT_DEMO__`, `demo.apprenant@example.invalid`, du bandeau fictif, `installDemoIsolation`, `resetDemoState`, `formaprompt-demo-reset` et du port local 4182. Le service worker construit ne contient ni `learner-onboarding.json`, ni le MP4 V2, ni aucune entrée `.mp4` dans son précache. Les exclusions Git ont été vérifiées avec `git check-ignore`. Aucun fixture, tournage ou résultat de test ne doit être ajouté au commit produit.

IMPORTANT MAINTENANT : contrôles précommit réussis ; stage limité au lot produit et aux rapports.

À FAIRE ENSUITE : enregistrement, push, contrôles GitHub, fusion puis déploiement autorisés, à exécuter et vérifier par le coordinateur.

PEUT ATTENDRE : essais sur téléphone physique et autres navigateurs ; modernisation Browserslist.

BLOQUANT : Aucun détecté pour la préparation locale.

DÉCISION THIERRY NÉCESSAIRE : Aucune supplémentaire dans le périmètre déjà autorisé ; toute extension de ce périmètre demande une nouvelle décision.
