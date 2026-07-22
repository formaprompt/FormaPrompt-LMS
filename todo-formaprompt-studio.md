# Suivi — FormaPrompt Studio 2026

## État actuel

- Tranche verticale « courriel professionnel » développée dans l'application React/Vite existante.
- Seize catégories déterministes sont désormais développées, dont « Articles et contenus éditoriaux », « Recherche », « Productivité », « Code », « Vidéo », « Audio » et « Agent IA », avec des sources vérifiables, des contrôles humains et des validations techniques explicites.
- MVP public, déterministe, sans stockage distant, sans authentification et sans appel à un fournisseur d'IA. Le Sprint 1 ajoute uniquement un brouillon local dans le navigateur.
- Aucun schéma Supabase, produit Stripe ou migration n'a été créé ou modifié pour le Studio.
- Le brief de démarrage est disponible dans `brief-formaprompt-studio-2026.md`.
- Le Sprint 1 UX part du commit de référence `86a1bc7 fix: fiabiliser l'aperçu Meta du Studio`.

## Phase 0 — audit et décisions

- [x] Auditer l'application React/Vite existante et ses composants réutilisables.
- [x] Comparer intégration dans `webapp` et application Next.js séparée.
- [x] Définir les publics prioritaires et les usages du MVP.
- [x] Choisir la tranche verticale modèle « courriel professionnel ».
- [x] Cartographier les données, les appels futurs, les risques RGPD et les coûts.
- [x] Définir les critères d'acceptation, les tests et les mesures de performance.
- [x] Faire valider l'architecture React/Vite et le MVP déterministe par Thierry.

## Phases suivantes provisoires

Ces phases devront être confirmées après l'audit.

- [x] Phase 1 : parcours UX mobile-first et page publique de la tranche verticale.
- [x] Phase 2 : moteur CROP déterministe, documenté et testable.
- [ ] Phase 3 : éventuels appels à un fournisseur externe côté serveur, avec quotas et protections, uniquement après validation.
- [ ] Phase 4 : sauvegarde personnelle, historique et réutilisation dans l'espace apprenant.
- [ ] Phase 5 : offre gratuite et premium, après validation de la valeur réelle du produit.
- [ ] Phase 6 : outils complémentaires, statistiques et enrichissements pédagogiques.

## Décisions à ne pas prendre sans validation

- migration de l'application vers Next.js ou création d'une seconde application ;
- choix du ou des fournisseurs d'IA ;
- stockage des prompts et réponses ;
- nouveau schéma ou nouvelle migration Supabase ;
- création ou modification d'un produit Stripe ;
- tarifs, quotas et limites des offres ;
- système de score public ;
- gamification ;
- commit, push ou déploiement.

## Principes permanents

- Une seule étape et une seule tranche verticale à la fois.
- Aucun secret dans le navigateur ou le dépôt.
- Aucune donnée personnelle, sensible ou confidentielle dans les exemples et tests.
- Aucune modification d'une migration Supabase déjà appliquée.
- Réutiliser l'existant avant de créer une nouvelle infrastructure.
- Mesurer réellement accessibilité, performance et qualité avant de les déclarer validées.

## Validation de la première tranche verticale — 18 juillet 2026

- Route publique propre : `/studio` avec titre, description, Open Graph, canonical, JSON-LD, FAQ, exemple avant-après et liens internes.
- Pré-rendu HTML produit automatiquement pendant `npm run build` dans `dist/studio/index.html`.
- Grille CROP sur 100 documentée dans `webapp/src/studio/SCORING.md`.
- Tests unitaires du moteur et test du parcours React réussis.
- Parcours navigateur ordinateur et mobile, copie, amélioration et contrôles WCAG automatisables : 4 tests réussis.
- Contrôle visuel mobile réel effectué, sans débordement ni erreur navigateur.
- Lighthouse local sur le build : mobile 97 performance, 99 accessibilité, 100 bonnes pratiques, 100 SEO ; ordinateur 100, 99, 100, 100.
- Aucun commit, push ou déploiement réalisé.

## Sprint 1 — refonte UX de la version gratuite — 20 juillet 2026

- [x] Remplacer le sélecteur historique par les seize cartes regroupées en cinq familles.
- [x] Ajouter la recherche, les quatre raccourcis populaires et les exemples contextualisés.
- [x] Rendre la sélection compacte après le choix d'un cas d'usage.
- [x] Ajouter la progression et améliorer les aides et erreurs CROP.
- [x] Ajouter un brouillon local versionné, restaurable et supprimable, sans stockage distant.
- [x] Clarifier le résultat et rendre la confirmation de copie accessible.
- [x] Préserver les identifiants, les constructeurs de prompts et les calculs de score existants.
- [x] Valider TypeScript, lint, 124 tests, 40 scénarios navigateur et le build de production.
- [x] Déployer sur IONOS et comparer les 152 fichiers par SHA-256.
- [x] Vérifier l'accueil, `/studio/`, les fichiers principaux, le sitemap et `robots.txt` en production.

## Sprint 1.1 — UX, prévisualisation et pédagogie — 20 juillet 2026

- [x] Ajouter une prévisualisation déterministe différée de 400 ms sans modifier le constructeur final.
- [x] Afficher le score CROP existant en direct et trois améliorations prioritaires au maximum.
- [x] Ajouter quatre modèles guidés à variables sans génération automatique ni écrasement silencieux.
- [x] Ajouter les aides CROP contextuelles et améliorer la lisibilité de la progression.
- [x] Afficher un espace de travail en deux colonnes sur ordinateur et un panneau repliable sur mobile.
- [x] Ajouter « Tester dans mon IA » avec copie préalable et ouverture explicite d’un service externe, sans prompt dans l’URL.
- [x] Condenser les contenus éditoriaux, ajouter cinq exemples publics et un bloc auteur daté.
- [x] Corriger les mentions de confidentialité et centraliser le domaine et l’adresse de contact visibles.
- [x] Conserver le brouillon uniquement dans `localStorage` et ne connecter aucun fournisseur d’analytics.
- [x] Préserver les seize identifiants, les constructeurs de prompts et la grille CROP 25/15/25/35.
- [x] Valider TypeScript, lint, 134 tests, le build, le pré-rendu et les 42 parcours Chrome ordinateur/mobile : 41 réussis et un ignoré par la configuration.
- [x] Atteindre Lighthouse 99/98/100/100 sur mobile et 100/98/100/100 sur ordinateur.
- [ ] Effectuer une dernière vérification visuelle humaine sur téléphone réel avant publication.
- [x] Déployer sur IONOS, puis effectuer le commit et le push après autorisation explicite de Thierry.
- [x] Vérifier par SHA-256 les 161 fichiers publiés et contrôler que `/studio/` sert un HTML strictement identique au build local avec la canonical attendue.

## Sprint 1.1.1 — cohérence, confidentialité et validation — 22 juillet 2026

- [x] Harmoniser les explications du brouillon local sur l’accueil, le Studio, la FAQ et la politique de confidentialité.
- [x] Supprimer les références publiques à `formaprompt.fr` et centraliser le domaine, le courriel et l’identité publique dans `src/config/site.ts`.
- [x] Autoriser la description d’une situation réelle avec des termes génériques, sans prétendre à une anonymisation automatique.
- [x] Harmoniser « courriel » dans les contenus visibles du Studio.
- [x] Fiabiliser le focus après le chargement différé d’une catégorie.
- [x] Vérifier la prévisualisation et le score déterministes sur plusieurs familles de catégories.
- [x] Tester les brouillons valides, corrompus, expirés et indisponibles, leur restauration et leur suppression sans appel réseau.
- [x] Copier le prompt avant l’ouverture du service externe, sans prompt dans l’URL, et ne rien ouvrir si la copie échoue.
- [x] Vérifier les largeurs de 320 à 1 920 px et les reflows équivalents aux zooms 125, 150 et 200 % sans débordement horizontal.
- [x] Valider TypeScript, lint, 150 tests automatisés et les 44 parcours Chrome : 42 réussis et 2 ignorés par la matrice.
- [ ] Effectuer une dernière vérification visuelle humaine sur téléphone et tablette réels avant publication.
- [x] Déployer sur IONOS, puis effectuer le commit et le push après autorisation explicite de Thierry : 161 fichiers vérifiés par SHA-256, 90 transférés, 71 déjà identiques et aucune divergence.
