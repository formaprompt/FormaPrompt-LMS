# IAG : sources publiques et contenu privé

Le dépôt contient le code du parcours IAG, ses contrôles d'accès et ses migrations. Les textes pédagogiques payants, grilles détaillées, médias, chemins privés, reçus d'import vérifiés et preuves de recette restent hors Git.

## Migrations canoniques

Les huit migrations `20261024064118` à `20261024064351` reprennent les versions effectivement appliquées lors de la publication du 24 octobre 2026. Leurs commentaires de proposition sont conservés comme provenance historique ; leur présence dans Git ne demande aucune réexécution distante. Aucune migration antérieure n'est réécrite.

La migration `20261024064209_iag_assessments.sql` conserve le schéma, les fonctions, les politiques et les privilèges, mais omet volontairement l'unique `INSERT` de la grille pédagogique payante dans `private.iag_rubric_versions`. Elle n'est donc pas identique octet pour octet à l'original privé. Les sept autres scripts reprennent les originaux. Le manifeste de provenance avec empreintes originales et publiques reste dans les preuves locales du coordinateur.

Une base reconstruite depuis ce dépôt ne contient pas cette grille et ne peut pas recevoir de travaux IAG avant son alimentation privée. La clé étrangère sur `rubric_version` reste en place : aucune grille fictive, aucune désactivation de contrôle ni validation automatique ne la remplace. Sur la base publiée, les données et grilles existantes ne sont pas modifiées par cet enregistrement Git.

## Préparation privée avant une future publication

1. Retrouver le paquet opérateur privé approuvé et vérifier ses empreintes. Le coordinateur conserve les originaux de SQL et le paquet de contenu ; ils ne doivent jamais être copiés dans un checkout public.
2. Sur une nouvelle base, faire importer par l'opérateur autorisé l'unique seed original de `private.iag_rubric_versions`, après les migrations et avant l'ouverture des remises. Vérifier version, empreinte source et données importées contre le paquet privé. Ne pas rejouer le script complet sur une base déjà migrée.
3. Assembler les fonctions avec les trois modules privés externes : catalogue, allowlist et reçu. Le script local `scripts/iag-edge-private-bundle.mjs` prépare un paquet externe et n'effectue aucun déploiement. Son entrée non promue reste `NOT_IMPORTED` ; une promotion exige les preuves réelles de l'import autorisé et le contrôle des médias.
4. Conserver les contrôles d'authentification, de droit actif, de questionnaire et de rôle. Vérifier séparément le reçu et le contenu privé avant toute publication autorisée.

Les modules publics `iagPrivateCourseCatalog.js` et `iagPrivateResourceAllowlist.js` sont vides, les grilles valent `null`, et le reçu public est `NOT_IMPORTED` sans entrée. Leur absence provoque un refus explicite de livraison privée ; le code public seul ne constitue pas un paquet serveur publiable.

## Vérification et retour arrière

Les tests locaux vérifient le code public et ses refus d'accès, pas la reconstruction complète des contenus privés ni leur état distant. Aucun média ni vrai compte apprenant n'est nécessaire aux tests.

Un retour arrière Git se prépare dans un nouveau changement relu, sans restauration globale de base, suppression de tables, perte de progression, travaux, notes, certificats ou paiements. Une fusion Git n'autorise aucun déploiement. Après activité réelle, privilégier une correction en avant ; toute intervention distante exige son périmètre propre et une sauvegarde fraîche vérifiée.
