# Sprint 0 — conformité documentaire, contractuelle et juridique

> **DOSSIER DE TRAVAIL — NON PUBLIÉ — NON OPPOSABLE AUX CLIENTS**  
> Version du dossier : `SPRINT0-LEGAL-DRAFT-2026-08-10-02`  
> Sources vérifiées le : **10 août 2026**

Ce dossier prépare la relecture juridique et métier demandée avant toute modification des pages publiques ou des parcours d'achat FormaPrompt.

## Légende

- **VÉRIFIÉ SUR SOURCE OFFICIELLE** : règle rattachée à une source officielle en vigueur à la date de vérification.
- **À VALIDER JURIDIQUEMENT** : articulation, qualification ou formulation qui nécessite encore une validation professionnelle avant publication.
- **CHOIX COMMERCIAL FORMAPPROMPT** : règle décidée par FormaPrompt, applicable uniquement sous réserve des dispositions impératives.
- **À CONFIRMER DOCUMENTAIREMENT** : information déclarée dans le site ou communiquée par FormaPrompt, mais dont le justificatif n'a pas été contrôlé.

## Documents proposés

1. [Audit de l'existant](00-audit-existant.md)
2. [CGV B2C](01-cgv-b2c-projet.md)
3. [CGV B2B](02-cgv-b2b-projet.md)
4. [Règlement intérieur](03-reglement-interieur-projet.md)
5. [Procédure disciplinaire](04-procedure-disciplinaire-projet.md)
6. [Politique de confidentialité](05-politique-confidentialite-projet.md)
7. [Matrices juridiques, RGPD et preuves](06-matrices-preuves-et-backlog.md)
8. [Sources et validations restantes](07-sources-et-validations.md)
9. [Modèle d'information précontractuelle](08-information-precontractuelle-modele.md)
10. [Contrat individuel de formation professionnelle](09-contrat-individuel-projet.md)

## Compléments intégrés à la Version 02

- RC Pro Simplis/WAKAM et garanties principales documentées, sans assimilation à un plafond contractuel ;
- affiliation CM2C vérifiée jusqu'au 21 juillet 2028 et échéance de renouvellement ajoutée ;
- Google Meet et Microsoft Teams confirmés comme seuls outils de classe virtuelle ;
- flux RGPD, rôles, résidence/transferts, contrats et conservations documentés sous réserve des comptes/licences réels ;
- absence d'enregistrement présumé et traitement distinct imposé pour toute future captation ;
- choix commercial d'un accès LMS sans limitation de durée prédéfinie intégré aux modèles, sous réserve de validation juridique finale.

## Périmètre et décisions retenues

- Les ventes en ligne aux consommateurs sont préparées autour du délai de quatorze jours du Code de la consommation lorsqu'il est applicable.
- Le délai de dix jours et les règles de paiement des articles L6353-5 et L6353-6 du Code du travail restent intégralement applicables aux contrats individuels entrant dans leur champ. Ce parcours est distinct du Checkout B2C ordinaire.
- Lorsque les deux régimes 10/14 jours sont applicables, les deux droits sont conservés, sans préjudice du régime plus protecteur applicable à la situation concrète, et les dates de conclusion et de signature sont tracées séparément.
- Les formations FormaPrompt sont des parcours mixtes. Aucune formation n'est automatiquement qualifiée dans son ensemble de contenu numérique sans support matériel.
- Une composante n'est traitée comme divisible que si sa valeur, son utilisation séparée, son interruption cohérente et sa présentation contractuelle sont établies.
- Le commencement d'un service, l'exécution d'un contenu numérique et la perte éventuelle du droit de rétractation sont traités séparément.
- Le barème d'annulation communiqué par FormaPrompt est un choix commercial, avec J-10 fixé à 0 %. Il ne neutralise aucun droit de rétractation ni aucune disposition impérative.
- L'adhésion de Thierry FREZARD / FormaPrompt à CM2C est vérifiée documentairement et active jusqu'au 21 juillet 2028.
- La RC Pro est vérifiée documentairement : contrat Simplis n° 92183443, garanties portées par WAKAM, attestation valable du 18 avril 2026 au 17 avril 2027 sous réserve du maintien du contrat. Les plafonds d'assurance ne sont pas repris comme plafond contractuel de responsabilité.
- Les seuls outils de visioconférence actuellement utilisés sont Google Meet et Microsoft Teams. Aucun enregistrement de session n'est présumé ni annoncé.
- Sauf condition particulière, FormaPrompt retient un accès LMS sans limitation de durée prédéfinie, conditionné au maintien de l'exploitation du service et de la formation. La formulation contractuelle finale reste à valider juridiquement.
- Le projet Qualiopi référencé `NOR TRSD2609875D` est traité comme une veille non opposable tant qu'il n'est pas publié au Journal officiel.

## Contrôles techniques réalisés sans modification

- Aucun tag Google Analytics, Google Tag Manager ou Consent Mode n'a été trouvé dans le code local ni dans le bundle public contrôlé le 10 août 2026.
- Le paquet `workbox-google-analytics` existe comme dépendance transitive de `vite-plugin-pwa` via `workbox-build`, mais aucune activation ni aucun appel n'a été trouvé dans le code applicatif.
- La bannière actuelle propose « J'accepte » et « Je refuse », mais ne commande aucun traceur Analytics détecté et ne propose pas de centre permanent de préférences.
- Le cookie de choix `formaprompt_cookie_consent` est configuré pour 150 jours.
- Supabase Auth conserve la session dans le stockage du navigateur avec la configuration client actuelle.
- Le brouillon FormaPrompt Studio est conservé uniquement dans le stockage local du navigateur.
- Le projet Supabase FormaPrompt est actif en région `eu-west-3` (Paris) et utilise actuellement l'offre Free.
- Aucun prestataire externe spécifique d'envoi d'e-mails n'est configuré.

## Limites de l'audit

Les espaces contractuels IONOS, Stripe, Supabase, Google, Microsoft et Google Analytics n'ont pas tous fourni leurs réglages de compte, licences, DPA applicables, listes de sous-traitants retenues, durées configurées ou options de partage. Ces éléments restent listés dans les validations documentaires avant publication.

Les informations d'identité, le code APE, le numéro de déclaration d'activité et la situation de TVA sont repris des mentions légales actuelles. Ils devront être rapprochés de justificatifs récents avant publication des versions définitives.
