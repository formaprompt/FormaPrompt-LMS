# Projet de procédure disciplinaire FormaPrompt

> **CADRE DOCUMENTAIRE — NON PUBLIÉ — AUCUN WORKFLOW TECHNIQUE IMPLÉMENTÉ**  
> Identifiant provisoire : `DISCIPLINE-DRAFT-2026-08-10-01`

## 1. Principes

Toute mesure disciplinaire respecte :

- l'information préalable sur les griefs ;
- le contradictoire ;
- l'impartialité de l'examen ;
- la proportionnalité ;
- la confidentialité limitée aux personnes ayant besoin d'en connaître ;
- la traçabilité des actes et délais ;
- la distinction entre mesure conservatoire, sanction et conséquence contractuelle.

Une simple observation verbale n'est pas une sanction. Aucune sanction pécuniaire ne peut être prononcée.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Articles R6352-3 et R6352-4 du Code du travail.

## 2. Étape 1 — Signalement et qualification initiale

Un signalement est consigné dans une fiche d'incident comprenant seulement :

- référence de l'incident ;
- date, heure et contexte ;
- personnes concernées ;
- faits rapportés et source de l'information ;
- éléments matériels disponibles ;
- risque immédiat éventuel ;
- première mesure prise ;
- auteur et date du compte rendu.

Les faits allégués sont distingués des constatations établies. Les données manifestement inutiles sont écartées. L'accès au dossier est limité.

## 3. Étape 2 — Mesure conservatoire éventuelle

Lorsqu'une protection immédiate est nécessaire, FormaPrompt peut prendre une mesure temporaire strictement proportionnée : interruption de la participation à la session, mise en attente d'un message, restriction temporaire d'un outil ou suspension conservatoire de l'accès concerné.

Cette mesure :

- n'est pas présentée comme une sanction définitive ;
- est motivée par le risque immédiat ;
- est limitée en périmètre et en durée ;
- est réexaminée rapidement ;
- ne dispense pas d'appliquer la procédure disciplinaire si une sanction est envisagée.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Article R6352-7 du Code du travail.

## 4. Étape 3 — Information sur les griefs

Avant toute sanction, le stagiaire est informé des griefs retenus contre lui, de façon suffisamment précise pour lui permettre de répondre.

Si la sanction envisagée est un avertissement écrit sans effet sur la présence ou la continuité de la formation, FormaPrompt recueille les observations de la personne avant décision et conserve la preuve de cette information.

Si la sanction est susceptible d'affecter immédiatement ou non sa présence ou la continuité de sa formation, les étapes 5 à 8 sont obligatoires.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Articles R6352-4 et R6352-5.

## 5. Étape 4 — Convocation à entretien

Le directeur de l'organisme ou son représentant convoque le stagiaire par lettre recommandée avec demande d'avis de réception ou par lettre remise en main propre contre décharge.

La convocation indique :

- son objet ;
- la date ;
- l'heure ;
- le lieu ou les modalités fiables de l'entretien à distance ;
- la possibilité pour le stagiaire de se faire assister par la personne de son choix, stagiaire ou salarié de l'organisme de formation.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Article R6352-5 du Code du travail.

**À VALIDER JURIDIQUEMENT** — Modalités probatoires exactes d'un entretien entièrement à distance et adaptation de la formulation réglementaire aux formations sans salarié ni autre stagiaire disponible.

## 6. Étape 5 — Entretien

Pendant l'entretien, FormaPrompt :

1. expose le motif de la sanction envisagée ;
2. présente les faits et éléments utiles ;
3. reçoit les explications du stagiaire et de la personne qui l'assiste ;
4. recherche les circonstances, adaptations ou mesures moins sévères pertinentes ;
5. établit un compte rendu factuel.

Le compte rendu mentionne les participants, la date, les principaux éléments examinés et les observations formulées. Il ne conclut pas automatiquement à une sanction.

## 7. Étape 6 — Décision et délais

La sanction ne peut intervenir moins d'un jour franc ni plus de quinze jours après l'entretien.

Elle fait l'objet d'une décision écrite et motivée, notifiée au stagiaire par lettre recommandée avec demande d'avis de réception ou remise contre récépissé. La décision précise les faits retenus, la sanction, sa date d'effet, sa durée éventuelle et ses conséquences limitées.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Article R6352-6 du Code du travail.

## 8. Étape 7 — Information des tiers concernés

FormaPrompt informe l'employeur et le financeur de la sanction dans les conditions prévues par l'article R6352-8. La communication est limitée aux informations nécessaires et son envoi est tracé.

**VÉRIFIÉ SUR SOURCE OFFICIELLE** — Article R6352-8 du Code du travail.

## 9. Étape 8 — Exécution technique

Une modification définitive de `course_access` ne peut être effectuée qu'après la décision disciplinaire lorsque cette décision le justifie.

Le futur workflow devra séparer les états suivants :

`incident signalé → analyse → suspension conservatoire éventuelle → convocation → entretien → décision → notification → révocation éventuelle → clôture`

Chaque transition devra enregistrer l'auteur, le motif, l'horodatage serveur, la référence documentaire et l'état antérieur. Une restauration d'accès doit rester possible lorsque la procédure conclut à l'absence de sanction ou à une sanction ne justifiant plus la suspension.

**SPRINT ULTÉRIEUR** — Aucun de ces changements techniques n'est autorisé dans le Sprint 0.

## 10. Modèles documentaires à produire

### Fiche de signalement

- référence ;
- identité et rôle du déclarant ;
- faits, date et contexte ;
- personnes concernées ;
- éléments joints ;
- risque immédiat ;
- traitement initial ;
- information sur la confidentialité et les destinataires.

### Décision de mesure conservatoire

- risque identifié ;
- mesure limitée ;
- date de début ;
- date de réexamen ;
- mention expresse qu'il ne s'agit pas d'une sanction définitive.

### Convocation

- griefs ou objet suffisamment précis ;
- date, heure et lieu/modalité ;
- droit à assistance ;
- preuve d'envoi ou de remise.

### Compte rendu d'entretien

- participants ;
- faits exposés ;
- observations et pièces ;
- éléments restant contestés ;
- signatures ou mention du refus de signer.

### Décision

- faits retenus ;
- motivation ;
- sanction proportionnée ;
- date d'effet et durée ;
- conséquences sur la formation et l'accès ;
- notifications réalisées.

## 11. Trames opérationnelles

Ces trames restent des brouillons. Les mentions entre crochets sont complétées au cas par cas.

### A — Signalement d'incident

**Référence :** `[INCIDENT-ID]`  
**Date et heure du signalement :** `[horodatage]`  
**Déclarant et rôle :** `[identité/rôle]`  
**Formation/session concernée :** `[référence]`  
**Faits rapportés :** `[description factuelle]`  
**Faits directement constatés :** `[description ou néant]`  
**Personnes concernées :** `[liste limitée]`  
**Pièces jointes :** `[liste]`  
**Risque immédiat identifié :** `[oui/non et motif]`  
**Mesure immédiate prise :** `[mesure ou néant]`  
**Accès au dossier :** `[personnes habilitées]`

### B — Notification d'une mesure conservatoire

**Objet : mesure conservatoire temporaire — aucune décision disciplinaire définitive**

> Des faits survenus le `[date]` nécessitent une mesure immédiate afin de `[risque précis]`. À compter du `[date/heure]`, l'accès ou la participation suivant est temporairement suspendu : `[périmètre]`. Cette mesure est conservatoire, limitée et ne préjuge pas de la décision qui pourra être prise après examen contradictoire. Elle sera réexaminée au plus tard le `[date]`. Vous pouvez transmettre vos premières observations à `[contact]`.

### C — Convocation à entretien

**Envoi :** lettre recommandée avec avis de réception ou remise contre décharge.

> Objet : convocation à un entretien préalable à une éventuelle sanction.  
> Nous envisageons une sanction à la suite des faits suivants : `[griefs suffisamment précis]`. Nous vous convoquons le `[date]` à `[heure]`, à `[lieu ou modalité]`. Vous pouvez vous faire assister par la personne de votre choix, stagiaire ou salariée de l'organisme de formation. Au cours de l'entretien, les motifs de la mesure envisagée vous seront exposés et vos explications seront recueillies.

### D — Compte rendu d'entretien

**Date, heure, lieu/modalité :** `[informations]`  
**Participants :** `[liste]`  
**Assistance du stagiaire :** `[identité ou renonciation]`  
**Griefs présentés :** `[faits]`  
**Éléments examinés :** `[liste]`  
**Explications et observations :** `[synthèse fidèle]`  
**Mesures alternatives évoquées :** `[liste]`  
**Points contestés ou restant à vérifier :** `[liste]`  
**Observations sur le compte rendu :** `[texte]`

### E — Avertissement ou blâme écrit

> Objet : notification d'une sanction disciplinaire.  
> Après vous avoir informé des griefs et avoir recueilli vos observations le `[date]`, FormaPrompt retient les faits suivants : `[faits établis]`. Ces faits contreviennent à l'article `[référence]` du règlement intérieur. Compte tenu de `[circonstances et proportionnalité]`, la sanction prononcée est `[avertissement/blâme]`. Cette sanction prend effet le `[date]` et n'entraîne pas `[préciser les effets]`.

### F — Exclusion temporaire ou définitive

**Envoi :** lettre recommandée avec avis de réception ou remise contre récépissé, au moins un jour franc et au plus quinze jours après l'entretien.

> Objet : notification d'une décision disciplinaire.  
> Vous avez été convoqué à un entretien tenu le `[date]`. Après examen de vos explications et des éléments du dossier, FormaPrompt retient les faits suivants : `[faits établis]`. Ces faits contreviennent à `[référence]`. Compte tenu de leur gravité, de `[circonstances]` et des mesures moins sévères examinées, la sanction prononcée est `[exclusion temporaire du … au … / exclusion définitive]`. Elle prend effet le `[date]`. Ses conséquences sur la formation et l'espace apprenant sont strictement les suivantes : `[effets]`. Les conséquences contractuelles ou financières éventuelles sont examinées séparément selon le contrat et la loi.

### G — Information de l'employeur ou du financeur

> Objet : information relative à une sanction prise à l'égard d'un stagiaire.  
> En application de l'article R6352-8 du Code du travail, nous vous informons qu'une sanction de nature `[nature]` a été notifiée le `[date]` à `[bénéficiaire]`, dans le cadre de la formation `[référence]`. Ses conséquences nécessaires sur la réalisation ou le financement sont : `[conséquences]`. Les informations communiquées sont limitées à celles nécessaires à votre qualité d'employeur ou de financeur.

**À VALIDER JURIDIQUEMENT** — Niveau de détail transmissible à l'employeur ou au financeur, voies de contestation à mentionner et adaptation des notifications à distance.

## 12. Conservation et accès au dossier

La durée de conservation du dossier disciplinaire doit être fixée dans le registre des traitements à partir de sa finalité, des délais de contestation applicables et des obligations du financeur. Elle ne doit pas être déterminée arbitrairement.

**À VALIDER JURIDIQUEMENT** — Durée active, archivage intermédiaire, droit d'accès aux pièces, traitement des témoignages et base juridique détaillée.
