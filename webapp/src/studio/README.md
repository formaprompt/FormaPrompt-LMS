# FormaPrompt Studio — architecture du MVP

## Périmètre actuel

Le Studio est intégré à l'application React/Vite existante sous la route publique `/studio`.

Le MVP :

- fonctionne uniquement dans le navigateur ;
- ne fait aucun appel à un fournisseur d'intelligence artificielle ;
- n'utilise ni Supabase, ni Stripe, ni l'authentification ;
- ne conserve aucune saisie dans `localStorage`, `sessionStorage`, un cookie ou une base de données ;
- construit un prompt et son diagnostic avec des fonctions déterministes.

Seize catégories sont disponibles : `professional-email` pour les courriels professionnels, `professional-documents` pour les rapports, comptes rendus, procédures, notes de synthèse, lettres, propositions commerciales et cahiers des charges, `editorial-content` pour les articles de blog, techniques, d'actualité, tutoriels, comparatifs et contenus de fond, `training` pour les activités, séquences et ressources pédagogiques, `presentation` pour les diaporamas, leur prise de parole et leur adaptation à PowerPoint, Google Slides, Gamma, Prezi, Canva, Keynote ou LibreOffice, `social-media` pour les publications destinées aux réseaux sociaux, `marketing-communication` pour les pages, brochures, newsletters, campagnes, argumentaires et plans de communication, `image-creation` pour les consignes visuelles, `video` pour les scénarios, storyboards, briefs de tournage ou de montage et consignes destinées aux outils vidéo, `audio` pour les podcasts, voix off, capsules pédagogiques, interviews, messages sonores et briefs de montage accessibles, `analysis-synthesis` pour l'analyse de sources et les synthèses traçables, `office-data` pour les tâches bureautiques, les traitements de données et les automatisations, `research` pour les recherches documentaires, la vérification des sources et les restitutions traçables, `productivity` pour l'organisation des tâches, l'amélioration des processus et leurs contrôles humains, `code` pour les créations, corrections, tests, explications et revues de code, et `ai-agent` pour cadrer la mission, l'autonomie, les permissions, les données, les contrôles humains, la traçabilité et l'arrêt d'un futur agent. Toutes les catégories prévues dans le catalogue sont désormais développées et activées.

Le catalogue est regroupé en cinq familles afin de rester lisible sur mobile : Écrire, Transmettre, Analyser, Créer et Construire. Ce regroupement relève de la navigation ; chaque catégorie conserve sa configuration, son schéma, son constructeur et ses règles de score propres.

## Organisation

- `types.ts` : contrats génériques des catégories, champs, règles et diagnostics ;
- `categories/` : configuration et logique propres à chaque catégorie ;
- `engine/` : fonctions métier communes, indépendantes de React ;
- `SCORING.md` : grille déterministe détaillée et limites d'interprétation ;
- `components/` : composants de formulaire, résultat et diagnostic ;
- `StudioPage.tsx` : composition de la page publique et contenus SEO ;
- `studio.css` : styles mobile-first limités au Studio ;
- fichiers `*.test.*` : tests unitaires et test du parcours React ;
- `tests/e2e/studio.spec.ts` : parcours navigateur et contrôles WCAG sur ordinateur et mobile ;
- `scripts/prerender-studio.mjs` : production du HTML indexable de `/studio/` ;
- `scripts/audit-studio.mjs` : audit Lighthouse reproductible du build.

## Ajouter une catégorie

Une nouvelle catégorie doit fournir un objet `StudioCategoryConfig<TValues>` comprenant :

1. un identifiant et un libellé ;
2. un schéma Zod strict et des valeurs initiales ;
3. la liste des champs et leur rattachement à C, R, O ou P ;
4. un constructeur de prompt pur ;
5. quatre règles de score dont le total maximal vaut 100 ;
6. les messages d'aide, exemples et recommandations ;
7. des tests unitaires du constructeur et du score.

La catégorie est ensuite ajoutée au registre. Le moteur commun et les composants n'ont pas à être réécrits.

## Points d'extension futurs — non implémentés

### Historique et comptes utilisateurs

Prévoir des tables Studio séparées des preuves pédagogiques et Qualiopi. Toute table exposée devra avoir des droits minimaux, la RLS, des politiques par propriétaire et une nouvelle migration Supabase. Aucune migration déjà appliquée ne devra être modifiée.

### Quotas et suivi des coûts

Prévoir un registre technique minimisé par compte et par période. Il devra comptabiliser les requêtes et les unités facturables sans conserver automatiquement le contenu complet des prompts.

### Appels à un fournisseur d'intelligence artificielle

Créer une passerelle serveur dédiée, avec validation Zod côté serveur, limites de taille, limitation de débit, délais d'attente, budget maximal et secrets dans les variables d'environnement. Le navigateur ne devra jamais recevoir une clé privée. Le fournisseur sera placé derrière une interface pour permettre son remplacement.

### Export

L'export texte peut utiliser le prompt déjà produit. Tout export PDF ou document devra être généré à partir d'un modèle contrôlé et ne pas transmettre le contenu à un service externe sans information préalable.

### Offre premium

L'offre, les tarifs, les quotas, le produit Stripe et les droits associés devront être validés avant toute intégration. Les achats de formation existants ne doivent pas être détournés pour représenter un abonnement Studio.

## Contrôles avant évolution

- conserver l'expression « espace apprenant » dans les contenus visibles ;
- ne pas présenter le score comme une mesure scientifique ;
- maintenir `SCORING.md` et les tests en cohérence avec chaque modification des seuils ;
- rappeler la protection des données avant toute saisie ;
- maintenir un parcours clavier complet et des messages annoncés aux lecteurs d'écran ;
- vérifier réellement le téléphone, l'ordinateur, le lint, les types, les tests et le build.

## Commandes de validation

À lancer dans `webapp` :

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run audit:studio
```

Le build et les tests navigateur utilisent Google Chrome installé localement. Les rapports Lighthouse JSON sont placés dans `.lighthouse/` et ne sont pas versionnés.
