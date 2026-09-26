# AGENTS.md - Projet FormaPrompt LMS

## Contexte du projet

Ce projet concerne FormaPrompt, site professionnel de Thierry FREZARD, formateur en bureautique, outils numériques, prompt engineering et IA générative.

Le site doit progressivement évoluer vers un LMS permettant de présenter des formations, structurer des parcours, accueillir des apprenants, diffuser des ressources pédagogiques et gérer éventuellement des inscriptions, accès privés, quiz, ressources, attestations ou certificats.

## Langue et style

Répondre en français.

Les contenus visibles par les utilisateurs doivent être rédigés dans un style professionnel, clair, pédagogique et naturel.

Éviter le ton trop commercial, les promesses exagérées, les formulations vagues et les textes génériques.

Privilégier des formulations concrètes, orientées compétences, usages réels et accompagnement pédagogique.

## Méthode de travail

Avant toute modification importante, analyser la structure du projet.

Respecter l'architecture existante, les conventions de nommage, les dépendances et le style de code déjà en place.

Faire des modifications progressives, limitées et testables.

Ne pas réécrire tout le projet si une correction ciblée suffit.

Après chaque modification, indiquer :

- les fichiers modifiés ;
- les changements réalisés ;
- la raison des changements ;
- la méthode de test ;
- les points de vigilance éventuels.

## Site et LMS

Le projet doit rester simple, professionnel, responsive, accessible et maintenable.

Pour les pages de formation, vérifier la cohérence des éléments suivants :

- titre clair ;
- public visé ;
- objectifs pédagogiques ;
- prérequis ;
- durée ;
- modalités ;
- programme ;
- méthodes pédagogiques ;
- modalités d'évaluation ;
- accessibilité ;
- appel à l'action sobre et professionnel.

Pour les fonctionnalités LMS, penser aux rôles, aux accès, à la progression pédagogique, aux quiz, aux ressources, aux attestations et à la protection des données personnelles.

Ne pas créer une logique LMS complexe sans validation préalable.

## Sécurité et RGPD

Ne jamais stocker de clé API, mot de passe, token ou secret directement dans le code.

Utiliser des variables d'environnement pour les informations sensibles.

Pour les formulaires, comptes utilisateurs, inscriptions, paiements, emails ou données apprenants, appliquer les principes RGPD : minimisation des données, consentement, information claire, sécurité et durée de conservation.

Signaler tout traitement de données personnelles ou toute transmission à un service externe.

## Git et demandes de fusion

Le projet est travaillé localement sous Windows et synchronisé avec GitHub.

- Toujours travailler sur une branche de travail dédiée, jamais directement sur la branche principale `main`.
- Avant toute modification, vérifier la branche active, l'état du dépôt et les changements déjà présents avec `git status`.
- Préserver les travaux existants et limiter chaque lot à un périmètre cohérent.
- Quand un lot est terminé et réellement testé, préparer son enregistrement, son envoi et une demande de fusion vers la branche principale. Exécuter ces actions uniquement après l'autorisation explicite de Thierry.
- La création d'une demande de fusion n'autorise jamais sa fusion.
- Ne jamais fusionner dans la branche principale sans autorisation explicite de Thierry.
- Ne jamais déclencher ou déduire une mise en production depuis un enregistrement, un envoi, une demande de fusion ou une fusion. Toute mise en production exige une autorisation explicite distincte.
- Ne jamais supprimer une branche, réécrire son historique ou forcer un envoi sans confirmation explicite.

La demande de fusion doit rester concise et utiliser le modèle `.github/pull_request_template.md`. Le coordinateur choisit un contrôle proportionné au risque et indique clairement à Thierry si la fusion est recommandée maintenant.

Protection GitHub recommandée pour `main`, à activer séparément après validation de Thierry : exiger une demande de fusion, interdire les envois forcés et interdire la suppression de la branche. Ne pas activer l'auto-fusion ni ajouter de contrôles complexes sans besoin démontré.

Proposer un message d'enregistrement clair après une modification utile, mais ne pas l'exécuter sans demande explicite.

## Tests et validation

Si le projet contient des scripts comme `npm run dev`, `npm run build`, `npm test` ou `npm run lint`, les utiliser ou les proposer selon le contexte.

Ne jamais affirmer qu'une commande a réussi si elle n'a pas été réellement exécutée.

## Comportement attendu

Travailler avec prudence.

Demander confirmation avant une action risquée ou irréversible.

Chercher la cause réelle des erreurs au lieu de masquer les symptômes.

Aider à construire FormaPrompt comme un site LMS professionnel, sobre, pédagogique et durable.
