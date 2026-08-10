# Audit documentaire et contractuel de l'existant

> **ÉTAT CONTRÔLÉ LE 10 AOÛT 2026 — RAPPORT NON PUBLIÉ**  
> Cet audit décrit l'existant observé. Les corrections proposées restent dans les autres brouillons du dossier et ne sont pas intégrées au site.

## 1. Périmètre contrôlé

- page CGV : `webapp/src/pages/CGV.jsx` ;
- mentions légales : `webapp/src/pages/Legal.jsx` ;
- politique de confidentialité : `webapp/src/pages/Privacy.jsx` ;
- pages de formations et boutons d'achat ;
- création des sessions Stripe Checkout et webhooks ;
- modèles administratifs de contrat, convention, convocation et attestation ;
- bannière de choix des cookies ;
- code local et bundle public pour Analytics et services Google ;
- tables Supabase utiles aux achats, accès, inscriptions, preuves pédagogiques et documents ;
- recherche d'un règlement intérieur, d'une procédure disciplinaire, d'un formulaire de rétractation et d'une fonctionnalité de rétractation en ligne.

## 2. Incohérences et lacunes contractuelles

| Priorité | Constat vérifié | Risque ou conséquence | Classement |
|---|---|---|---|
| Bloquante | Une seule page CGV s'applique indistinctement aux particuliers, entreprises et autres professionnels. | Régimes B2C, B2B, contrat individuel et financement tiers confondus. | **VÉRIFIÉ SUR SOURCE OFFICIELLE** pour la nécessité d'appliquer les règles selon leur champ ; correction rédigée séparément. |
| Bloquante | L'article 5 des CGV attribue quatorze jours à l'article L6353-5 du Code du travail. | Citation factuellement erronée : L6353-5 prévoit dix jours. | **VÉRIFIÉ SUR SOURCE OFFICIELLE**. |
| Bloquante | Les CGV exigent le paiement intégral à la commande pour toute formation en ligne autofinancée. | Incompatible avec L6353-5 et L6353-6 si la vente relève du contrat individuel de formation professionnelle : aucune somme avant dix jours, puis 30 % au maximum et solde échelonné. | **VÉRIFIÉ SUR SOURCE OFFICIELLE** ; un tunnel individuel distinct est requis. |
| Bloquante | La clause e-learning indique que le droit ne s'applique plus si l'accès aux modules a commencé, avec accord et renoncement, sans distinguer la composante numérique des services ou du parcours mixte. | Qualification trop générale ; absence de traitement de L221-25, des conditions complètes de L221-28 et de la confirmation prévue par L221-13. | **VÉRIFIÉ SUR SOURCE OFFICIELLE** ; qualification offre par offre **À VALIDER JURIDIQUEMENT**. |
| Haute | Les CGV affichent leur « dernière mise à jour » avec la date du jour calculée à chaque affichage. | Impossible d'identifier une version stable ou de prouver le texte présenté au moment d'un achat. | **VÉRIFIÉ SUR SOURCE OFFICIELLE** pour la charge de la preuve de l'information ; architecture de versionnement requise. |
| Haute | L'acceptation est formulée comme résultant de toute commande ou validation d'inscription. | Aucune preuve d'une action dédiée reliée au texte exact présenté. | **VÉRIFIÉ SUR SOURCE OFFICIELLE** pour l'information et la confirmation ; mécanisme futur requis. |
| Haute | La clause de compétence vise les tribunaux du siège de FormaPrompt pour l'ensemble des clients, avec une réserve générale. | Une clause unique ne convient pas au consommateur ; la clause B2B doit respecter l'article 48 du Code de procédure civile. | **VÉRIFIÉ SUR SOURCE OFFICIELLE**. |
| Moyenne | PayPal est cité comme moyen de paiement, mais aucun parcours PayPal n'a été trouvé dans le code contrôlé. | Texte possiblement non conforme au service réellement proposé. | **À CONFIRMER DOCUMENTAIREMENT**. |
| Moyenne | Le financement OPCO/Pôle emploi est traité en une phrase et rend systématiquement le « Client » redevable en cas de non-paiement. | Le payeur, le bénéficiaire et le débiteur ne sont pas distingués ; le contrat du financeur peut modifier la répartition. | **À VALIDER JURIDIQUEMENT** et contractuellement. |

## 3. Parcours d'achat et preuve de l'accord

### Stripe Checkout

La création de session demande à Stripe de recueillir l'acceptation de conditions d'utilisation génériques (`consent_collection.terms_of_service = required`). Les métadonnées conservées identifient l'utilisateur, la formation et le prix, mais pas :

- le type juridique du client ;
- la version des CGV B2C ou B2B ;
- le texte exact accepté ;
- la version des conditions particulières ;
- la qualification du produit ;
- la demande de commencement anticipé d'un service ;
- le consentement et la reconnaissance propres au contenu numérique ;
- la confirmation sur support durable.

Le webhook peut accorder automatiquement l'accès après confirmation du paiement. Le paiement ou cet accès technique ne prouvent pas à eux seuls la réunion des conditions d'une perte du droit de rétractation.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour les conditions légales ; **changement fonctionnel reporté** au prochain sprint.

### Versionnement et traces Supabase

Les achats conservent notamment les identifiants Stripe, le montant, la devise, le statut et l'utilisateur. Aucun registre dédié reliant une action d'acceptation à une version figée du texte contractuel n'a été trouvé. Les droits d'accès sont désormais séparés de la preuve d'achat, mais il n'existe pas encore de workflow contractuel de consentement ou de rétractation.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour le besoin de preuve ; aucun schéma ni aucune migration modifiés dans ce sprint.

### Confirmation et rétractation en ligne

Aucun récapitulatif contractuel figé propre à FormaPrompt, aucune confirmation des consentements d'exécution anticipée et aucune fonctionnalité permanente de rétractation en ligne n'ont été trouvés. Un reçu Stripe ne suffit pas à établir, par lui-même, le contenu de toutes les informations et acceptations FormaPrompt.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour L221-13, L221-21 et D221-5 ; implémentation reportée.

## 4. Contrat, convention et financement

Le générateur administratif choisit actuellement le titre « Convention de formation professionnelle » si `organization_name` est renseigné et « Contrat de formation professionnelle » dans le cas contraire. Ce seul critère ne qualifie pas complètement la relation : statut de l'acheteur, identité du payeur, financement et objet du contrat doivent être pris en compte.

Le document généré contient une photographie utile de la formation et trois clauses génériques, mais il ne reprend pas encore de manière démontrée l'ensemble des mentions de L6353-4 pour le contrat individuel, son régime de rétractation et de paiement, les conditions de cessation anticipée et la répartition financeur/client.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour le contenu obligatoire ; un projet de contrat individuel distinct est désormais ajouté au dossier, à compléter et qualifier offre par offre.

## 5. Information précontractuelle et pages de formation

Les pages contrôlées présentent déjà plusieurs informations pédagogiques utiles : public, objectifs, durée ou programme selon l'offre, modalités et prix sur les offres achetables. Leur niveau de détail est toutefois hétérogène et aucune photographie versionnée des informations présentées avant la commande n'est conservée.

L'accès systématique et traçable aux éléments suivants n'est pas établi pour chaque offre :

- qualification du client, du payeur et du contrat ;
- programme et horaires définitifs ;
- formateur ;
- moyens et modalités d'évaluation ;
- conditions d'accès et d'abandon adaptées ;
- règlement intérieur ;
- régime de rétractation propre au client et au produit ;
- médiation B2C ;
- version des documents contractuels présentés.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour L6353-8 et les obligations précontractuelles B2C ; modèle produit séparément.

## 6. Règlement intérieur et discipline

Aucun règlement intérieur formalisé ni aucune procédure disciplinaire complète n'ont été trouvés dans le dépôt. Aucun modèle distinct de signalement, mesure conservatoire, convocation, entretien, décision ou notification employeur/financeur n'était disponible.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour les articles L6352-3 à L6352-5 et R6352-1 à R6352-8 ; projets ajoutés au dossier de relecture.

## 7. Confidentialité et traceurs

Deux textes publics partiellement redondants décrivent la confidentialité : la page Mentions légales et la page Politique de confidentialité. Les écarts constatés sont :

- traitements LMS incomplets au regard des fonctions réelles : progression, exercices, corrections, évaluations, signatures, émargement, satisfaction, attestations, incidents et dossiers OPCO ;
- bases juridiques regroupées sans rattachement traitement par traitement ;
- prestataires, rôles, localisations, transferts et mécanismes contractuels non détaillés ;
- durées majoritairement formulées sans critères précis ;
- page Confidentialité évoquant une newsletter alors qu'aucun prestataire externe d'envoi n'est configuré ;
- formulation « en continuant à utiliser le site, vous acceptez » inadaptée comme fondement général d'une politique de confidentialité ;
- absence d'information complète sur Stripe, Supabase, IONOS et les services Google déclarés.

### Google Analytics et bannière

Aucun tag Google Analytics, Google Tag Manager, identifiant de mesure ou Consent Mode actif n'a été trouvé dans le code applicatif ni le bundle public contrôlé. `workbox-google-analytics` est uniquement une dépendance transitive de `vite-plugin-pwa` via `workbox-build` ; aucune activation n'a été trouvée.

La bannière actuelle offre bien deux actions « J'accepte » et « Je refuse » et conserve le choix 150 jours. Elle ne pilote aucun traceur Analytics détecté et ne propose pas de centre permanent de préférences. La page publique renvoie au paramétrage du navigateur pour retirer le consentement, ce qui ne démontre pas un retrait aussi simple que l'acceptation.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour les principes CNIL ; propriété et configuration Google **À CONFIRMER DOCUMENTAIREMENT**.

## 8. Médiation

CM2C est déclaré dans les pages publiques avec l'adresse 49 rue de Ponthieu, 75008 Paris, le téléphone 01 89 47 00 14, le site de déclaration de litige et l'adresse `litiges@cm2c.net`. L'attestation fournie confirme l'adhésion de Thierry Frezard, SIRET 51115161500016, au **Centre de la Médiation de la Consommation de Conciliateurs de justice — CM2C**, l'adresse, le téléphone, le domaine `www.cm2c.net`, une convention de trois ans et une expiration au 21 juillet 2028.

Les nom, adresse, téléphone et domaine actuellement affichés sont cohérents avec l'attestation. L'adresse `litiges@cm2c.net` et le chemin précis `/declarer-un-litige.php` ne figurent pas sur l'attestation communiquée : ils doivent rester contrôlés sur les modalités de saisine CM2C en vigueur au moment de la publication.

La réclamation écrite préalable doit être expliquée conformément aux conditions de recevabilité applicables à la médiation.

**Classement : VÉRIFIÉ SUR SOURCE OFFICIELLE** pour l'obligation d'information et la réclamation préalable ; **VÉRIFIÉ DOCUMENTAIREMENT — ADHÉSION ACTIVE JUSQU'AU 21/07/2028** pour l'affiliation. Une échéance de contrôle doit être planifiée avant cette date.

## 8 bis. Assurance, visioconférence et durée d'accès LMS

### Assurance RC Pro

L'attestation communiquée confirme le contrat Simplis n° 92183443 souscrit par Thierry FREZARD, avec des garanties portées par WAKAM pour l'activité « Formateur / Professeur d'enseignement académique ». L'attestation actuelle couvre la période du 18 avril 2026 au 17 avril 2027, sous réserve du maintien du contrat.

Les montants principaux documentés sont 9 000 000 € tous dommages confondus en responsabilité civile exploitation et 2 500 000 € par période d'assurance en RC après livraison / RC professionnelle, avec les sous-limites et franchises détaillées dans l'attestation. Ces montants décrivent l'assurance souscrite ; ils ne déterminent pas un plafond contractuel de responsabilité.

**Classement : VÉRIFIÉ DOCUMENTAIREMENT** pour l'existence, l'assuré, le gestionnaire/assureur, le contrat, l'activité, la période et les plafonds principaux. Le plafond contractuel éventuel reste **À VALIDER JURIDIQUEMENT**.

### Visioconférence

FormaPrompt confirme utiliser exclusivement **Google Meet** et **Microsoft Teams**. Zoom n'est pas un outil actuellement utilisé. L'audio et la vidéo sont traités en temps réel pour fournir la classe virtuelle ; les services traitent également l'identité ou le pseudonyme, les coordonnées de compte, les métadonnées de réunion, les horaires de connexion, l'adresse IP, l'appareil et des données de qualité/sécurité. Le détail contractuel dépend du compte et de la licence effectivement employés.

Aucun enregistrement n'est présumé. Toute activation future d'un enregistrement, d'une transcription ou d'une prise de notes automatisée constitue un traitement distinct nécessitant une information préalable, une finalité, une base juridique, une durée, des droits d'accès et un contrôle des partages.

**Classement : CHOIX OPÉRATIONNEL FORMAPPROMPT** pour l'inventaire Meet/Teams ; documentation publique des fournisseurs contrôlée ; comptes, licences, DPA et réglages réels **À CONFIRMER DOCUMENTAIREMENT**.

### Durée d'accès LMS

FormaPrompt décide qu'en l'absence de condition particulière, l'accès acquis est accordé sans limitation de durée prédéfinie et comprend les mises à jour que FormaPrompt met à disposition pour la formation concernée, tant que le service et cette formation demeurent exploités. Cette décision ne doit pas être présentée comme un « accès garanti à vie » et ne fait pas obstacle aux suspensions, révocations, remboursements ou exclusions prévues par la loi ou le contrat.

**Classement : CHOIX COMMERCIAL FORMAPPROMPT** ; formulation finale, conditions objectives de cessation, préavis et articulation avec les garanties des services numériques **À VALIDER JURIDIQUEMENT**.

## 9. Qualiopi 2026

Les mentions actuelles indiquent que FormaPrompt n'est pas certifié Qualiopi et intervient « via sous-traitance ». Cette situation doit être confirmée par les contrats et justificatifs en vigueur.

Le lien Certiforma relatif au projet `NOR TRSD2609875D` est conservé comme source de veille. Aucun décret définitif correspondant n'a été retrouvé au Journal officiel lors de la vérification. Ses éléments ne sont donc pas intégrés comme obligations actuelles.

**Classement : VEILLE — NON OPPOSABLE** pour le projet ; situation FormaPrompt **À CONFIRMER DOCUMENTAIREMENT**.

## 10. Priorités avant publication ou nouvel achat B2C

1. qualifier chaque offre mixte et soumettre uniquement les cas atypiques 10/14 jours à une validation au cas par cas ;
2. figer les versions B2C/B2B et les documents particuliers ;
3. classer le client, le payeur et le bénéficiaire avant le Checkout ;
4. intégrer les consentements distincts et leur preuve versionnée ;
5. envoyer ou rendre disponible la confirmation durable ;
6. créer la fonctionnalité de rétractation en ligne pour les contrats concernés ;
7. appliquer J-10 à 0 % et valider l'assiette/proportionnalité propre à chaque offre ou convention ;
8. archiver l'attestation CM2C, programmer son contrôle avant le 21 juillet 2028 et finaliser les dossiers contractuels des prestataires ;
9. terminer l'inventaire RGPD et les durées ;
10. publier uniquement après relecture juridique et validation expresse de FormaPrompt.
