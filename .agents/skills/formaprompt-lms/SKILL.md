---
name: formaprompt-lms
description: Appliquer les invariants d'architecture, sécurité, Git, tests et publication de FormaPrompt LMS. Utiliser pour toute analyse, modification, Sprint, migration Supabase, Edge Function, paiement Stripe ou déploiement IONOS dans ce dépôt.
---

# FormaPrompt LMS

Appliquer ces règles avant `AGENTS.md` comme référence opérationnelle du projet. Vérifier l'état réel Git et production : ne jamais le déduire d'un rapport ancien.

## Socle et autorisations

- Stack : React/Vite, Supabase, Stripe, GitHub, IONOS, développement Windows. GitHub ne déploie pas automatiquement le site.
- Ici, une autorisation de `commit` signifie `commit + push` sur la branche de travail.
- Exiger une autorisation distincte pour : migration Supabase production, Edge Function, IONOS, Stripe production, merge `main`, création/push d'un tag stable.
- Ne jamais déployer sans autorisation, utiliser un `db push` global en production, rejouer une migration logique appliquée, inventer un état, fusionner/taguer avant validation manuelle de Thierry, ni supprimer des données réelles pour simplifier un rollback.
- Cycle normal : branche → tests → commit/push → rollback capturé → déploiement coordonné autorisé → contrôles automatiques → validation manuelle Thierry → merge `main` → tag stable.

## Invariants métier

### Paiements directs

- Interdiction de suspendre ou retirer les paiements directs sans instruction explicite.
- Maintenir achetables `formation-ia`, `formation-prompt-level-1` et `formation-ia-act`.
- Préserver Stripe et `automatic_tax: false` sauf instruction explicite.
- Tunnel : qualification → consentements appropriés → Stripe.
- Ne pas résoudre un problème juridique par `checkoutEnabled: false`, masquage/suppression Stripe, fermeture générale des ventes ou désactivation de `create-checkout`.

### Droits pédagogiques

- `course_access` est l'unique source de droits LMS ; seul un accès `active` valide autorise le contenu.
- Ne créer aucune table parallèle de droits (`funding_access`, `opco_access`, `purchase_access`, etc.).
- Ne jamais réactiver automatiquement `suspended`, `revoked`, `refunded` ou `expired`, y compris après achat ou financement.
- `expires_at = NULL` signifie uniquement « aucune échéance prédéfinie ».

### Juridique

- TVA exacte : `TVA non applicable - article 293 B du CGI`, centralisée dans `legalBusiness.js`. Ne pas la modifier sans instruction explicite.
- CM2C confirmé jusqu'au `21/07/2028` ; ne jamais écrire « adhésion CM2C à confirmer ».
- CGV de référence : `CGV-B2C-2026-08-12`, SHA-256 `2638f1ae962efb81a8f8b7f1ed96a4ba673fd3300b6dd507ba39e53979a7d459` ; `CGV-B2B-2026-08-12`, SHA-256 `5ef0c09d8c454ad72f089aad6fc332c007011830aeb972e791eff9c0e80d3702`.
- Ne pas modifier/republier les CGV ou leurs hashes sans nécessité explicitement validée.
- Ne jamais promettre un accès « à vie ». Formulation : « accès sans limitation de durée prédéfinie tant que le service FormaPrompt et la formation demeurent exploités ».

## Données, preuves et contenus privés

- Protéger toute mutation sensible côté serveur ; appliquer RLS, isolation des utilisateurs, audit et refus des paramètres manipulés côté frontend.
- RGPD : analyse préalable → décisions par catégorie → double confirmation → audit → anonymisation douce Supabase Auth → exécution serveur admin uniquement.
- Conserver les preuves légalement nécessaires : achats, consentements, rétractations, documents commerciaux et historiques réglementaires. Ne jamais supprimer arbitrairement une preuve légale.
- Documents pédagogiques : bucket privé `paid-course-content`, contrôle serveur de `course_access`, URL signée courte.
- Pièces disciplinaires : bucket privé `disciplinary-evidence`, jamais d'URL publique permanente.

### Vidéo IONOS — règle absolue

- `FP_-_Capsule_001_-_Rediger_un_bon_prompt_finale_with_captions.mp4` reste sur IONOS et hors `dist`.
- SHA-256 actuel : `da16d1d40f463a1a4486dc2ac1b0a7a1265cb05f850edaf9bb9b238197c6459b`.
- Si le hash est identique : aucun transfert, déplacement, remplacement ou suppression ; ne jamais l'envoyer vers Supabase Storage.
- Tout média lourd modifié est une opération séparée avec autorisation explicite.
- Protection requise : contrôle `course_access` Supabase → grant HMAC court → cookie HttpOnly/Secure → `paid-video.php` → HTTP Range ; accès MP4 direct = 403.

## Build, secrets et publication

### Build Vite

- Le build production doit échouer si l'URL/clé publique Supabase attendue manque ou est invalide, si une clé serveur arrive côté frontend, ou si l'URL FormaPrompt est incorrecte.
- Ne jamais contourner ce garde-fou. Aucun secret serveur dans React, Git ou `VITE_*`.

### SMTP

- SMTP IONOS production est validé. Secrets serveur : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- Ne jamais afficher leurs valeurs, lire/journaliser le mot de passe, les committer, les placer dans React ou créer leur équivalent `VITE_*`.

### IONOS

- Limiter normalement le déploiement à `/Formaprompt` et capturer une archive rollback avant modification importante.
- Déployer les assets avec contrôle des hashes, puis HTML/prérendus/service worker en dernier.
- Ne pas parcourir/modifier arbitrairement d'autres dossiers, ni retransférer les fichiers inchangés.

## Validation et rollback

- Selon le changement, exécuter : tests applicatifs, serveur et React ; TypeScript ; ESLint ; Deno Check ; build ; `git diff --check` ; recherche de secrets ; pgTAP.
- Si Docker/WSL local est indisponible, utiliser GitHub Actions public `ubuntu-latest` avec Docker/Supabase local, coût obligatoire `0 €`, sans connexion production ni branche Supabase payante.
- Supprimer un workflow GitHub temporaire après usage sauf intérêt durable démontré.
- Avant production, capturer migrations, versions Edge Functions, compteurs pertinents, archive IONOS et hashes.
- En échec : arrêter rapidement ; restaurer frontend/Edge si nécessaire ; corriger en avant une migration additive ayant reçu des données réelles ; ne supprimer aucune preuve réelle ; aucun remboursement ni réactivation d'accès automatiques.

## Git, périmètre et cadence

- Préserver non suivis sauf instruction contraire : `AUDIT-FONCTIONNEL-FORMAPROMPT-2026-08.md`, `AUDIT-METIER-ROADMAP-FORMAPROMPT-1.0.md`, `webapp/supabase/.branches/`.
- État fonctionnel après Sprint 4 : accès/incidents ; RGPD/fin de vie dans v0.7 ; cycle commercial ; OF/OPCO.
- Sprint 5 uniquement : après-paiement Stripe — remboursements, litiges/chargebacks, échecs, doublons, réconciliation paiements/accès.
- Sprint 6 uniquement : cockpit/qualité d'exploitation — alertes, réclamations, améliorations, BPF, indicateurs.
- Ne pas anticiper un Sprint suivant sans nécessité technique démontrée.
- Avancer par blocs cohérents, regrouper les opérations compatibles et produire des rapports synthétiques. Ne pas refaire un audit général à chaque reprise ni demander une confirmation par micro-étape déjà autorisée ; conserver strictement les frontières Git/Supabase/Edge/IONOS/Stripe/merge/tag.
