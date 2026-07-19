# Suivi — FormaPrompt Studio 2026

## État actuel

- Tranche verticale « courriel professionnel » développée dans l'application React/Vite existante.
- Quatorze catégories déterministes sont désormais développées, dont « Articles et contenus éditoriaux », « Recherche », « Productivité », « Code » et « Vidéo », avec des sources vérifiables, des contrôles humains et des validations techniques explicites.
- MVP public, déterministe, sans stockage, sans authentification et sans appel à un fournisseur d'IA.
- Aucun schéma Supabase, produit Stripe ou migration n'a été créé ou modifié pour le Studio.
- Le brief de démarrage est disponible dans `brief-formaprompt-studio-2026.md`.
- Le dernier socle FormaPrompt validé correspond au commit `19614bc feat: finaliser la formation IA Act`.

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
