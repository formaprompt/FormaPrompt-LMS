# Suivi du projet FormaPrompt

Dernière mise à jour : 15 juillet 2026

## Objectif général

Construire et fiabiliser FormaPrompt comme site de formation et LMS professionnel : accès apprenants, formations, paiements, réservations, positionnements, émargements et suivi Qualiopi.

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
- Un test fonctionnel complet avec plusieurs comptes apprenants reste conseillé avant la mise en production.

## Prochaine action recommandée

Effectuer les tests fonctionnels ci-dessus, puis poursuivre les améliorations du LMS à partir des éventuels problèmes constatés.

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
