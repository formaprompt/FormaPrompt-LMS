# Artefact de publication FormaPrompt

Depuis `webapp`, sur un état Git identifié :

```powershell
npm ci
npm run build
```

Prérequis : Node/npm, Chrome pour Playwright et la configuration cliente publique
Vite habituelle (notamment `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Fournir
cette configuration dans l'environnement de build sécurisé ; aucune clé serveur
n'est nécessaire. Ne jamais la journaliser ni l'inclure dans un manifeste.

## Ordre et sources

1. Vite compile l'application et copie `public/`, dont la source versionnée
   `public/404.html`. Aucun HTML d'un autre worktree ou de production n'est utilisé.
2. `prerender-studio.mjs` conserve le HTML Vite vierge dans `public-shell.html`
   et dans `app-shell.html` (avec `noindex, nofollow`).
3. Le même script pré-rend les six pages initiales, les autres pages publiques du
   sitemap et les routes publiques complémentaires existantes. `/contact` et
   `/blog` deviennent `contact.html` et `blog.html`. Studio et les trois formations
   conservent leurs sorties `route/index.html`. L'accueil est généré en dernier.
   `/retractation` reste servi par le shell applicatif selon `.htaccess`.
4. `release-artifact.mjs` contrôle l'inventaire, les cibles HTML littérales Apache,
   les routes pré-rendues, H1, canonicals, descriptions, shells, fichiers exclus,
   signatures de secrets serveur et références locales d'assets HTML/CSS/JS.

Les articles et la liste du blog nécessitent une lecture des contenus publics
Supabase existants. Le pré-rendu bloque les requêtes autres que GET/HEAD/OPTIONS
et échoue si les contenus nécessaires ne sont pas disponibles. Il ne publie rien.
Un contenu public distant peut évoluer entre deux builds : conserver l'artefact
validé, ne pas le reconstruire au moment du transfert.

## Validation et traçabilité

```powershell
npm run test:release
npm run test:app
npm run lint
npm run typecheck
npm run verify:release
git diff --check
```

Le livrable est `webapp/dist/`. L'inventaire SHA-256 est écrit hors du livrable,
dans `output/release/manifest.json` à la racine du dépôt (ignoré par Git).
Après le commit, relancer `verify:release` pour associer l'inventaire au hash final,
puis figer une copie locale de l'artefact et du manifeste.

Les contrôles de routage Node sont statiques : un preview Vite ne prouve pas le
comportement Apache. Après publication autorisée, contrôler les réponses HTTP,
redirections, canonicals et la vraie réponse 404 sur le serveur réel.

## Préparation du transfert, sans déploiement automatique

Utiliser la procédure SFTP FormaPrompt : clé hôte vérifiée, comparaison SHA-256
en lecture seule, liste exacte des ajouts/remplacements et zéro suppression.
Préserver tous les fichiers distants exclusifs, notamment les ressources privées.
Avant toute écriture autorisée, sauvegarder seulement les fichiers remplacés.
Prévoir les assets avant les HTML et les fichiers d'entrée/cache ; ne pas appliquer
aveuglément un plan dont l'ordre de transfert ne garantit pas cette séquence.
Le rollback rétablit ces sauvegardes, sans effacer les ressources distantes.

Un commit ou un push Git ne constitue jamais une autorisation de déploiement.
