# Matrices juridiques, consentements, preuves et backlog

> **DOCUMENT DE CONCEPTION — NON PUBLIÉ — AUCUNE LOGIQUE MÉTIER IMPLÉMENTÉE**  
> Version : `MATRICES-DRAFT-2026-08-10-02`

## 1. Matrice client et contrat

| Parcours | Client contractuel | Bénéficiaire/payeur | Document principal | Conditions | Paiement |
|---|---|---|---|---|---|
| 1 — Consommateur B2C ordinaire | personne physique agissant pour ses besoins personnels | bénéficiaire et payeur généralement identiques | contrat à distance + conditions particulières | CGV B2C | paiement B2C selon l'offre et le droit applicable |
| 2 — Formation professionnelle individuelle à ses frais | personne physique relevant de L6353-3 | même personne | contrat individuel distinct avec mentions L6353-4 | CGV B2C + contrat individuel | L6353-6 : rien avant 10 jours, puis 30 % maximum et solde échelonné |
| 3 — Entreprise / professionnel / OF | entreprise, professionnel ou organisme de formation | salarié, client, stagiaire ou collaborateur ; payeur identifié | devis, convention, bon de commande ou sous-traitance | CGV B2B + conditions particulières | selon contrat B2B |
| 4 — OPCO ou autre tiers financeur | client désigné par le montage contractuel | bénéficiaire et financeur distincts ; débiteur réel identifié | convention, devis et documents exigés par le dispositif | CGV B2B + règles du financeur | prix total, montant financé, reste à charge et débiteur tracés ; subrogation seulement si acceptée |

Le formulaire futur doit distinguer au minimum : statut déclaré, finalité de l'achat, bénéficiaire, payeur, organisation, financement et éventuelle prise en charge. Une simple case « particulier/professionnel » ne suffit pas à qualifier juridiquement une situation ambiguë.

## 2. Matrice 10 jours / 14 jours

| Situation | Délai | Point de départ | Modalité | Paiement | Statut |
|---|---|---|---|---|---|
| Consommateur concluant à distance un contrat de service | 14 jours | conclusion du contrat | formulaire, déclaration non ambiguë ou fonctionnalité en ligne | remboursement selon L221-24 ; service commencé traité selon L221-25 | VÉRIFIÉ |
| Contenu numérique sans support matériel | 14 jours en principe | conclusion du contrat | même principe ; exception seulement si toutes les conditions de L221-28, 13° sont réunies | selon régime applicable | VÉRIFIÉ |
| Contrat individuel L6353-3 | 10 jours | signature du contrat | lettre recommandée avec avis de réception selon L6353-5 | rien avant 10 jours ; ensuite 30 % maximum et solde échelonné | VÉRIFIÉ |
| Même contrat B2C à distance et L6353-3 | conserver les deux droits, sans préjudice du régime plus protecteur applicable à la situation concrète | date de conclusion à distance et date de signature tracées séparément | fonctionnalité en ligne + courriel + courrier ; rappel de la LRAR L6353-5 dans le contrat individuel | appliquer intégralement L6353-6 | APPROCHE VALIDÉE ; cas atypiques à valider |
| Professionnel répondant aux trois conditions de L221-3 | protections des sections visées, dont rétractation | selon le contrat hors établissement | à examiner au cas par cas | selon texte applicable | VÉRIFIÉ quant au principe, qualification à valider |
| Entreprise/OF/OPCO ordinaire | pas de droit consommateur automatique | sans objet | annulation contractuelle | selon B2B/financeur | VÉRIFIÉ |

### Position opérationnelle proposée

Pour les achats directs en ligne d'un particulier :

1. appliquer le parcours d'information et la fonctionnalité correspondant aux quatorze jours lorsqu'il s'agit d'un consommateur ;
2. détecter séparément l'éventuel contrat individuel L6353-3 ;
3. dans ce cas, quitter le Checkout B2C classique, produire le contrat écrit et bloquer tout prélèvement incompatible avec L6353-6 ;
4. tracer séparément la conclusion à distance et la signature du contrat individuel ;
5. conserver les deux droits, sans présenter l'un comme supprimant l'autre ;
6. soumettre uniquement les configurations atypiques à une validation au cas par cas.

## 3. Matrice des formations mixtes

| Composante à documenter | Qualification de travail | Démarrage anticipé | Effet possible sur la rétractation |
|---|---|---|---|
| accès LMS et contenus préexistants | contenu numérique possible ou moyen d'accès au service | analyse de la fonction réelle et consentements numériques si L221-28, 13° est invoqué | aucun effet automatique du seul accès au LMS |
| fichiers ou vidéos fournis | contenu numérique possible | consentement exprès + reconnaissance expresse + confirmation durable avant exécution | perte uniquement pour la composante désignée lorsque son exécution commence après réunion des conditions |
| accompagnement ou tutorat | prestation de services | demande expresse préalable si le service commence pendant les 14 jours | droit maintenu au commencement ; montant proportionnel possible ; perte après exécution complète sous conditions |
| corrections personnalisées | prestation de services | même régime que le service | même régime, selon le service effectivement fourni |
| classe virtuelle avec formateur | prestation de services | demande expresse préalable | pas de perte au simple commencement |
| présentiel | prestation de services / formation professionnelle | demande expresse si concerné par un commencement pendant le délai | pas de perte automatique ; règles du contrat de formation également applicables |
| exercices et évaluations | service pédagogique ou fonctionnalité du LMS selon conception | analyse de la fonction réelle | aucun effet automatique d'une ouverture, réponse ou progression |
| attestation ou document final | résultat documentaire du service | généralement sans commencement autonome | effet déterminé par la prestation dont il constitue l'aboutissement |
| parcours non divisible | prestation globale de formation | traiter globalement et prudemment | ne pas isoler artificiellement une exception propre au contenu numérique |

### Fiche de qualification à créer par produit

- identifiant et version de l'offre ;
- finalité principale ;
- composantes et prix ou valeur contractuelle ventilés ou non ;
- possibilité d'utilisation séparée de chaque composante ;
- possibilité d'interrompre son exécution sans rendre l'ensemble incohérent ;
- présentation contractuelle claire de la décomposition ;
- date de début de chaque composante ;
- présence et rôle du formateur ;
- durée d'accès aux contenus ;
- régime de rétractation retenu et motif ;
- consentements nécessaires ;
- règle d'ouverture de chaque droit d'accès ;
- validation juridique et date.

La divisibilité n'est retenue que si les quatre critères — valeur identifiable, utilisation séparée, interruption cohérente et présentation contractuelle claire — sont réunis. À défaut, l'offre est traitée comme une prestation globale de formation.

**À VALIDER JURIDIQUEMENT** — Qualification finale et divisibilité réelle des offres AI Act, IA générative et Prompt Engineering avant modification de leur parcours d'achat.

## 4. Informations précontractuelles à rendre accessibles

Avant inscription définitive, le dossier associé à chaque formation doit réunir ou relier clairement :

- identité et coordonnées de FormaPrompt ;
- public visé et statut d'achat concerné ;
- objectifs et contenu détaillé ;
- prérequis ;
- durée, dates, horaires et délai d'accès ;
- modalités présentiel/distanciel/LMS ;
- liste ou identité du formateur et références requises ;
- moyens pédagogiques et techniques ;
- modalités de suivi et d'évaluation ;
- sanction ou document de fin ;
- tarif total, paiement et financement ;
- accessibilité et contact handicap ;
- contact chargé des relations avec les stagiaires ;
- conditions d'annulation, d'abandon et de force majeure ;
- règlement intérieur ;
- CGV et conditions particulières applicables ;
- politique de confidentialité ;
- droit de rétractation selon le statut et formulaire ;
- médiateur CM2C, adhésion vérifiée jusqu'au 21 juillet 2028 ;
- fonctionnalité et interopérabilité pertinentes du LMS ou du contenu numérique ;
- durée d'accès et assistance technique.

**CHOIX COMMERCIAL FORMAPPROMPT** — Sauf condition particulière, la durée d'accès aux contenus LMS est sans limitation prédéfinie, tant que le service FormaPrompt et la formation demeurent exploités. La fiche ne doit pas promettre un accès « à vie » et doit distinguer les contenus des séances, corrections ou accompagnements limités dans le temps.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Articles L111-1, L221-5, L221-14 et L6353-8.

## 5. Modèles d'actions et consentements

Les textes suivants sont des modèles de conception, non des formulations publiables sans validation.

### Déclaration de situation du client

> J'achète : [pour mes besoins personnels / à titre individuel et à mes frais dans le cadre d'une formation professionnelle / pour une entreprise ou un organisme]. Le bénéficiaire est : [moi-même / une autre personne]. Le payeur prévu est : [moi-même / mon entreprise / un OPCO ou autre financeur].

Ce choix est une déclaration de contexte, pas un consentement RGPD.

### Acceptation des CGV

> J'ai pris connaissance des CGV B2C version `[identifiant]`, téléchargeables ici, et je les accepte.

Case non précochée. La preuve doit contenir la version et l'empreinte du document.

### Demande de commencement anticipé d'un service

> Je demande expressément que la prestation de services décrite dans le récapitulatif de ma commande commence avant la fin de mon délai de rétractation de quatorze jours.

Case non précochée et distincte de l'acceptation des CGV. Si le consommateur se rétracte après le commencement ainsi demandé, le montant éventuellement dû est calculé conformément à L221-25 sur le service effectivement fourni.

### Information sur le service pleinement exécuté

> Je reconnais que, si la prestation de services désignée est entièrement exécutée avant la fin du délai de rétractation, après ma demande expresse et avec mon accord préalable dans les conditions légales, je perdrai mon droit de rétractation pour cette prestation entièrement exécutée.

Action distincte lorsque ce scénario est réellement possible.

### Commencement anticipé d'un contenu numérique qualifié

> Je consens expressément à ce que l'exécution du contenu numérique `[désignation précise]` commence avant la fin de mon délai de rétractation.

### Reconnaissance de perte pour ce contenu numérique

> Je reconnais qu'après confirmation de mon accord dans les conditions prévues par le Code de la consommation, je perdrai mon droit de rétractation pour la composante numérique `[désignation précise]` dès que son exécution commencera avant la fin du délai.

Les deux actions numériques sont non précochées, reliées à une composante précise et confirmées sur support durable.

La perte du droit relative au contenu numérique n'est pas subordonnée à une exécution complète. Elle ne concerne que la composante qualifiée et précisément désignée.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Principes de séparation, consentement exprès, reconnaissance expresse, confirmation durable et commencement de l'exécution issus de L221-13, L221-25 et L221-28.

**À VALIDER JURIDIQUEMENT** — Application à la qualification et à la divisibilité de chaque offre ; un parcours indivisible ne doit pas être artificiellement ventilé.

### Information RGPD

La politique de confidentialité doit être fournie et sa version affichée peut être journalisée. Une case « J'accepte la politique de confidentialité » ne doit pas servir de consentement global aux traitements nécessaires au contrat.

### Marketing et témoignage

Les éventuels consentements de prospection ou de publication d'un témoignage sont facultatifs, séparés, non précochés et révocables sans effet sur la formation.

## 6. Preuves contractuelles à conserver

Une preuve ne doit jamais se limiter à `accepted = true`.

### Registre des textes

- type de document ;
- identifiant stable de version ;
- date d'entrée en vigueur ;
- contenu figé ou fichier durable ;
- empreinte cryptographique ;
- statut brouillon/publié/retiré ;
- auteur et validation ;
- source juridique et date de vérification.

### Registre des actions de l'utilisateur

- identifiant de l'action ;
- utilisateur ;
- type et statut juridique déclaré ;
- bénéficiaire, payeur et financeur éventuel ;
- achat, inscription, session Checkout et formation concernés ;
- type de consentement ou déclaration ;
- texte exact affiché ou identifiant + empreinte ;
- version des CGV, conditions particulières et fiche produit ;
- qualification et version de la fiche des composantes ;
- valeur choisie ;
- horodatage serveur ;
- date de conclusion à distance et date de signature du contrat individuel ;
- moment exact de commencement de chaque composante concernée ;
- interface et langue ;
- contexte technique strictement nécessaire et proportionné ;
- preuve de la confirmation sur support durable.

### Confirmation durable

Le récapitulatif figé doit comprendre :

- parties et coordonnées ;
- produit et composantes ;
- prix et paiement ;
- statut déclaré, bénéficiaire, payeur et financeur ;
- documents et versions applicables ;
- choix relatifs au commencement anticipé ;
- date et heure de commencement des composantes déjà exécutées ;
- information sur la rétractation et formulaire ;
- date et heure ;
- moyen de contacter FormaPrompt.

Il doit être envoyé par e-mail ou mis à disposition dans un fichier durable téléchargeable, tout en conservant la preuve de sa délivrance. Une page web modifiable n'est pas utilisée seule.

## 7. Workflow de rétractation en ligne à prévoir

Pour les contrats concernés conclus depuis le 19 juin 2026 au moyen d'une interface en ligne :

1. lien visible, direct, facile et permanent intitulé « Renoncer au contrat ici » ou formulation analogue non ambiguë ;
2. accès pendant toute la durée du délai applicable ;
3. formulaire demandant le nom, les éléments permettant d'identifier le contrat et le moyen électronique souhaité pour l'accusé ;
4. écran récapitulatif ;
5. bouton « Confirmer la rétractation » ou formulation analogue ;
6. horodatage serveur ;
7. accusé de réception sur support durable reprenant le contenu, la date et l'heure ;
8. création d'un dossier sans supprimer automatiquement la preuve d'achat ;
9. examen du régime, du commencement anticipé et du montant éventuellement dû ;
10. remboursement et adaptation des accès après décision traçable.

Le consommateur dispose également d'une adresse électronique et d'une adresse postale. Pour le contrat individuel L6353-3, le contrat rappelle la lettre recommandée avec avis de réception prévue par L6353-5, sans présenter la fonctionnalité en ligne comme supprimant cette formalité. Une rétractation clairement exprimée par l'interface est enregistrée, accusée et instruite ; elle n'est pas ignorée au seul motif qu'un autre canal était prévu parallèlement.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Articles L221-21 et D221-5, en vigueur depuis le 19 juin 2026.

## 8. Matrice RGPD synthétique

| Traitement | Données principales | Finalité | Base envisagée | Destinataires | Conservation |
|---|---|---|---|---|---|
| Authentification | email, identifiant, rôle, session, logs | compte et sécurité | contrat + intérêt légitime | FormaPrompt, Supabase | à définir ; logs selon service/plan |
| Contact | nom, email, objet, message | réponse et devis | précontrat/intérêt légitime | FormaPrompt, Supabase | jusqu'à 3 ans selon finalité, à configurer |
| Achat Stripe | identifiants, montant, statut, téléphone | paiement, accès, preuve | contrat + obligations légales | FormaPrompt, Stripe, Supabase | contrat ; pièces comptables 10 ans |
| Inscription/financement | identité, coordonnées, employeur, financeur | administration | contrat + obligations | FormaPrompt, client, financeur, Supabase | à fixer par dossier et financeur |
| Positionnement | réponses, score, niveau | adaptation | précontrat/contrat | FormaPrompt, formateur, Supabase | à fixer |
| Progression et travaux | modules, réponses, projets, corrections | suivi et évaluation | contrat + preuve | FormaPrompt, formateur, Supabase | à fixer |
| Émargement | horaires, confirmations, signatures, audit | preuve de présence | contrat/obligation/intérêt légitime | FormaPrompt, employeur/financeur si nécessaire, Supabase | à fixer |
| Attestations | identité, formation, résultat, contenu figé | délivrance et vérification | contrat/obligation | FormaPrompt, bénéficiaire, tiers autorisé | à fixer |
| Satisfaction | notes, commentaires, témoignage | qualité/publication | intérêt légitime + consentement publication | FormaPrompt, public si autorisé | à fixer ; retrait de publication géré |
| Discipline | faits, pièces, décisions | sécurité et procédure | obligation/contrat/intérêt légitime | FormaPrompt, personne, employeur/financeur selon texte | à fixer |
| Hébergement | IP anonymisée ou technique, requêtes, appareil | service et sécurité | intérêt légitime | IONOS | 8 semaines annoncées pour Hébergement, à confirmer |
| Analytics | événements, identifiant, appareil, géolocalisation approximative | audience | consentement si activation non exemptée | Google | propriété non détectée/configuration à confirmer |
| Google Meet | identité/pseudonyme, email selon invitation, réunion, horaires, IP, appareil, qualité/sécurité, flux audio/vidéo et contenus partagés | fournir et sécuriser la classe virtuelle | contrat + intérêt légitime sécurité | FormaPrompt, Google, participants autorisés | aucun enregistrement audio/vidéo présumé ; métadonnées/logs selon compte ; captation éventuelle selon Drive/Vault |
| Microsoft Teams | identité/pseudonyme, email selon invitation, réunion, horaires, IP, appareil, qualité/sécurité, flux audio/vidéo et contenus partagés | fournir et sécuriser la classe virtuelle | contrat + intérêt légitime sécurité | FormaPrompt, Microsoft, participants autorisés | aucun enregistrement présumé ; métadonnées/logs selon tenant ; captation éventuelle selon OneDrive/SharePoint et politique |

Les rôles, lieux, transferts et conservations exacts des deux outils dépendent des comptes, licences, tenants, DPA et réglages réellement applicables. Une captation, transcription ou prise de notes automatisée est un traitement distinct, non activé par défaut dans la documentation FormaPrompt.

## 9. Backlog fonctionnel des prochains sprints

### Priorité bloquante avant nouvel achat B2C

- registre versionné et immuable des textes ;
- pré-Checkout de qualification statut/client/payeur/bénéficiaire/financeur ;
- quatre routages distincts : B2C ordinaire, contrat individuel, B2B, OPCO ou tiers financeur ;
- tunnel individuel hors Checkout B2C classique ;
- cases distinctes et non précochées ;
- confirmation durable avec preuve de délivrance ;
- fonction de rétractation en ligne ;
- réception et journalisation des rétractations par interface, courriel et courrier ;
- traitement du délai de dix jours et échéancier L6353-6 ;
- traçage distinct des dates de conclusion et de signature ;
- fiche versionnée de qualification et de divisibilité par offre ;
- règle d'accès et événement de commencement horodaté par composante ;
- retrait de l'automatisme « paiement = perte de droit » ;
- historique contractuel append-only.

### Discipline — Sprint 1

- dossier incident ;
- mesure conservatoire séparée ;
- convocations, décisions et notifications ;
- journal d'audit append-only ;
- révocation de `course_access` uniquement après décision lorsqu'elle est justifiée ;
- restauration d'accès et traçabilité.

### RGPD et cookies

- registre des traitements et politique de purge ;
- archivage des DPA et listes de sous-traitants ;
- centre de préférences permanent ;
- audit du compte Google Analytics avant tout tag ;
- blocage préalable des traceurs non nécessaires ;
- Consent Mode seulement s'il correspond au choix juridique et technique retenu ;
- archivage des comptes, licences, DPA, régions et politiques de Google Meet et Microsoft Teams ;
- traitement séparé de toute future fonction d'enregistrement/transcription ;
- inventaire des e-mails transactionnels.

### Suivi documentaire et échéances

- renouvellement RC Pro à contrôler avant le 17 avril 2027 ;
- adhésion CM2C à contrôler avant le 21 juillet 2028 ;
- ne jamais déduire un plafond contractuel des seuls plafonds d'assurance ;
- revoir périodiquement les DPA, sous-traitants et réglages Meet/Teams.

### Préparation Qualiopi 2026

- conserver le projet `NOR TRSD2609875D` dans une veille datée ;
- ne pas coder les 33 indicateurs ou exigences annoncées comme s'ils étaient définitifs ;
- rendre les preuves, catégories et référentiels paramétrables ;
- relancer une vérification Légifrance et ministère au moment de la publication officielle ;
- produire alors une analyse d'écart entre texte définitif, guide de lecture et fonctionnement FormaPrompt.
