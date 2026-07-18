# FormaPrompt — application web

Application React/Vite de FormaPrompt : site public de formations, fonctionnalités pédagogiques et espace apprenant.

## Préparer le projet

Dans `C:\Users\Thier\OneDrive\Documents\formation\Formaprompt\webapp` :

```powershell
npm install
npm run dev
```

Les secrets Supabase, Stripe et les autres paramètres sensibles doivent rester dans les variables d'environnement. Ils ne doivent jamais être ajoutés au dépôt.

## Commandes principales

```powershell
npm run typecheck     # Vérification TypeScript
npm run lint          # Analyse du code
npm test              # Tests applicatifs, Stripe et Studio
npm run test:e2e      # Parcours Studio sur ordinateur et mobile
npm run test:all      # Tous les tests précédents
npm run build         # Build Vite puis pré-rendu de /studio/
npm run audit:studio  # Lighthouse du build sur mobile et ordinateur
npm run preview       # Prévisualisation du build
```

Google Chrome doit être installé localement pour le pré-rendu, les tests navigateur et Lighthouse.

## FormaPrompt Studio

Le Studio est intégré à la route publique `/studio`. Sa première catégorie, « courriel professionnel », fonctionne sans appel à un fournisseur d'IA, sans stockage et sans compte utilisateur.

- architecture et extensions : `src/studio/README.md` ;
- grille exacte du score : `src/studio/SCORING.md` ;
- tests navigateur : `tests/e2e/studio.spec.ts` ;
- HTML indexable généré : `dist/studio/index.html` après le build.

Le build ne modifie aucune migration ni aucune donnée Supabase, Stripe ou Qualiopi.
