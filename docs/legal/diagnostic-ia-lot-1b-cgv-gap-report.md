# Diagnostic IA Express — analyse ciblée des CGV avant mise en production

Date de l'analyse : 26 août 2026
Documents examinés : `CGV-B2C-2026-08-12` et `CGV-B2B-2026-08-12`, tels que publiés par la migration `20260812132848_publish_commercial_legal_versions.sql`.

## Conclusion opérationnelle

La mise en production du checkout Diagnostic IA Express doit rester bloquée. Les CGV existantes ont été conçues principalement pour les formations et renvoient plusieurs règles essentielles à des conditions particulières qui n'existent pas encore pour cette prestation ponctuelle.

Les écarts critiques sont :

- l'absence de règles propres au Diagnostic pour l'annulation, le report et la non-présentation ;
- l'absence, dans le parcours B2C, de demande expresse d'exécution anticipée et de reconnaissance de la perte du droit de rétractation après exécution complète ;
- l'incompatibilité du parcours B2B actuel, fondé sur un devis ou bon de commande et un paiement à trente jours, avec un achat direct immédiat par Stripe.

Ce rapport décrit les écarts ; il ne modifie aucune règle contractuelle et ne constitue pas un avis juridique.

## Règles commerciales validées pour le Diagnostic

- annulation ou report sans frais jusqu'à vingt-quatre heures avant le rendez-vous ;
- à moins de vingt-quatre heures, un report exceptionnel unique peut être accordé pendant la période de lancement ;
- cette tolérance ne crée aucun droit à des reports multiples ;
- aucune automatisation de ces règles n'appartient au LOT 1B.

Le sort du prix en cas d'annulation tardive ou de non-présentation n'a pas été arrêté. Il ne doit donc pas être inventé dans les CGV ni dans le code.

## Matrice B2C

| Point contrôlé | État | Référence et constat |
|---|---|---|
| Prestation ponctuelle de diagnostic/conseil | **PARTIEL** | § 3, lignes 29 à 35 : la nature décrite est celle des formations, ressources LMS, exercices et séances. Une prestation autonome de diagnostic/conseil et son livrable ne sont pas explicitement couverts. |
| Prix et paiement | **COUVERT** | § 4 et § 5, lignes 37 à 45 : prix total avant commande, obligation de paiement, euros, TVA non applicable et traitement Stripe sont prévus. Le prix propre au Diagnostic doit rester présenté dans l'offre. |
| Réservation à une date donnée | **PARTIEL** | § 4, ligne 39 : la date ou le délai d'exécution doit être communiqué, mais aucune règle ne décrit le choix d'un créneau après paiement. |
| Report | **PARTIEL** | § 7, lignes 67 à 71 : le report par FormaPrompt est évoqué ; les conditions à l'initiative du client sont renvoyées à des conditions particulières absentes. |
| Annulation | **PARTIEL** | § 7, ligne 69 : l'annulation est distinguée de la rétractation, mais aucune échéance ni conséquence propre au Diagnostic n'est définie. |
| Absence / no-show | **PARTIEL** | § 7, ligne 69 : la non-présentation est nommée, mais son traitement est renvoyé à des conditions particulières absentes. |
| Remboursement | **PARTIEL** | § 7, ligne 71 : le remboursement des prestations non exécutées est prévu si FormaPrompt ne peut exécuter. Les autres cas ne sont pas définis pour le Diagnostic. |
| Droit de rétractation B2C | **COUVERT** | § 6, lignes 51 à 57 : délai de quatorze jours et modalités de déclaration. Cela correspond au principe de l'article L221-18 du Code de la consommation. |
| Demande d'exécution avant la fin du délai | **PARTIEL** | § 6, lignes 63 à 65 : le principe d'une demande expresse est indiqué, mais le checkout Diagnostic ne la recueille pas encore et la règle de paiement proportionnel en cas de rétractation après commencement n'est pas explicitée. |
| Conséquence d'une prestation entièrement exécutée | **MANQUANT** | Les CGV ne recueillent ni l'accord préalable exprès propre au Diagnostic ni la reconnaissance de la perte du droit après exécution complète, exigés pour cette exception. |

## Matrice B2B

| Point contrôlé | État | Référence et constat |
|---|---|---|
| Prestation ponctuelle de diagnostic/conseil | **PARTIEL** | § 1 couvre les clients professionnels, mais les § 2, 5 et 7 décrivent surtout des formations, bénéficiaires et accès LMS. Le Diagnostic autonome n'est pas défini. |
| Prix et paiement | **PARTIEL** | § 4, lignes 120 à 124 : prix dans le devis ou la convention et paiement à trente jours par défaut. Le paiement direct immédiat Stripe à 149 € n'est pas couvert. |
| Réservation à une date donnée | **PARTIEL** | § 5, lignes 126 à 130 : les séances ont une durée contractuelle, sans règle sur le choix d'un créneau après paiement. |
| Report | **PARTIEL** | § 6, lignes 132 à 136 : report en cas d'impossibilité de FormaPrompt ; conditions côté client non définies. |
| Annulation | **PARTIEL** | § 6, ligne 134 : demande écrite, mais traitement renvoyé aux conditions particulières et prestations exécutées. |
| Absence / no-show | **MANQUANT** | Aucune règle n'organise la non-présentation du client au rendez-vous Diagnostic. |
| Remboursement | **PARTIEL** | § 6, ligne 136 : remboursement si FormaPrompt ne peut exécuter et qu'aucun report n'est accepté. Les autres cas ne sont pas définis. |
| Droit de rétractation applicable à certains professionnels | **MANQUANT** | Les CGV B2B n'identifient pas l'hypothèse limitée de l'article L221-3 : contrat hors établissement, objet hors activité principale et professionnel employant au plus cinq salariés. Cette extension ne vise pas, en tant que telle, tout achat B2B à distance. |
| Demande d'exécution avant la fin du délai | **MANQUANT** | Aucun mécanisme B2B n'est prévu pour le cas particulier où les règles de rétractation de l'article L221-3 s'appliqueraient. |
| Conséquence d'une prestation entièrement exécutée | **MANQUANT** | Aucune reconnaissance spécifique n'est prévue dans ce même cas particulier. |

## Sources légales vérifiées

- Code de la consommation, [article L221-18](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226842) : délai de rétractation de quatorze jours pour les prestations de services conclues à distance ou hors établissement.
- Code de la consommation, [article L221-25](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226826) : demande expresse de commencement anticipé, reconnaissance de la perte du droit après exécution complète et paiement proportionnel si le consommateur se rétracte après le commencement demandé.
- Code de la consommation, [article L221-28](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170) : exception pour le service pleinement exécuté après accord préalable exprès et reconnaissance de la perte du droit.
- Code de la consommation, [article L221-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226882) : extension limitée de certaines règles aux contrats conclus hors établissement entre professionnels.

## Proposition ciblée — texte à valider, non publié

Les formulations ci-dessous constituent une base de travail limitée au Diagnostic IA Express. Elles ne modifient pas les CGV publiées.

### Dispositions communes B2C et B2B

#### Nature de la prestation — **OBLIGATOIRE AVANT PRODUCTION**

> Le Diagnostic IA Express est une prestation ponctuelle de conseil réalisée principalement en visioconférence pendant quatre-vingt-dix minutes. Elle analyse l'activité, les tâches, les outils, les contraintes et les objectifs du client afin d'identifier trois opportunités IA prioritaires, les risques et les tâches qu'il convient de ne pas automatiser. Un Plan d'action IA FormaPrompt personnalisé est remis après le rendez-vous. La prestation n'inclut pas le développement ou l'installation complète d'un agent, d'une automatisation, de n8n ou d'un logiciel sur mesure, ni une formation d'équipe, un audit informatique complet ou un audit juridique/RGPD complet.

#### Prix, paiement et réservation — **OBLIGATOIRE AVANT PRODUCTION**

> Le prix du Diagnostic IA Express est celui affiché sur la page de l'offre au moment de la commande. Il est payé intégralement à la commande par Stripe. Situation fiscale actuelle : TVA non applicable - article 293 B du CGI. Après confirmation du paiement, le client choisit son rendez-vous parmi les disponibilités proposées par FormaPrompt. Le retour du navigateur depuis Stripe ne constitue pas à lui seul une confirmation du paiement.

#### Annulation et report jusqu'à vingt-quatre heures — **OBLIGATOIRE AVANT PRODUCTION**

> Le client peut annuler ou demander le report du rendez-vous sans frais jusqu'à vingt-quatre heures avant l'heure prévue. En cas d'annulation dans ce délai, les sommes versées au titre du Diagnostic sont remboursées. En cas de report, un nouveau créneau est choisi parmi les disponibilités proposées.

Cette restitution découle de la règle commerciale « annulation sans frais ». Sa procédure et son délai matériel de remboursement doivent être précisés avant publication.

#### Demande à moins de vingt-quatre heures — **OBLIGATOIRE AVANT PRODUCTION**

> À moins de vingt-quatre heures du rendez-vous, FormaPrompt peut accorder, pendant la période de lancement, un report exceptionnel unique. Cette tolérance est appréciée par FormaPrompt et ne constitue pas un droit à plusieurs reports.

#### Non-présentation et annulation tardive — **OBLIGATOIRE AVANT PRODUCTION**

Le texte définitif ne peut pas encore être rédigé : Thierry doit décider explicitement du sort du prix en cas de non-présentation ou d'annulation à moins de vingt-quatre heures lorsqu'aucun report exceptionnel n'est accordé. Les choix possibles doivent être validés juridiquement et commercialement avant publication ; aucune absence de remboursement ou retenue du prix n'est présumée par le présent rapport.

#### Impossibilité imputable à FormaPrompt — **RECOMMANDÉE**

> Si FormaPrompt ne peut assurer le rendez-vous, il propose un nouveau créneau. Si aucun report n'est accepté, le prix du Diagnostic non exécuté est remboursé, sans préjudice des droits légaux du client.

#### Modalités pratiques — **OPTIONNELLE**

> Les demandes d'annulation ou de report sont adressées par écrit aux coordonnées communiquées par FormaPrompt, en rappelant la référence de la commande et la date du rendez-vous, sans transmettre de donnée confidentielle inutile.

### Complément propre aux CGV B2C

#### Droit de rétractation — **OBLIGATOIRE AVANT PRODUCTION**

> Pour un contrat conclu à distance, le consommateur dispose en principe de quatorze jours à compter de la conclusion du contrat pour exercer son droit de rétractation, conformément aux dispositions légales applicables. L'annulation commerciale du rendez-vous et l'exercice du droit légal de rétractation sont deux démarches distinctes.

#### Exécution avant la fin du délai — **OBLIGATOIRE AVANT PRODUCTION**

> Si le consommateur choisit un rendez-vous ou demande qu'une prestation commence avant la fin du délai de rétractation, FormaPrompt recueille séparément sa demande expresse de commencement anticipé. Si le consommateur se rétracte après le commencement demandé mais avant l'exécution complète, il peut être tenu au paiement du service fourni jusqu'à sa décision, dans les conditions et limites prévues par l'article L221-25 du Code de la consommation.

Le checkout ou la réservation devra conserver une preuve horodatée distincte de l'acceptation générale des CGV. La case ne devra pas être précochée.

#### Prestation entièrement exécutée — **OBLIGATOIRE AVANT PRODUCTION**

> Lorsque le cadre légal le permet, le consommateur reconnaît, dans une action distincte, qu'après exécution complète de la prestation commencée avec son accord préalable et exprès, il ne disposera plus du droit de rétractation pour cette prestation entièrement exécutée.

Cette clause ne suffit pas seule : l'accord exprès et la reconnaissance doivent être effectivement recueillis et prouvés conformément aux articles L221-25 et L221-28.

### Complément propre aux CGV B2B

#### Dérogation au devis et au paiement différé — **OBLIGATOIRE AVANT PRODUCTION**

> Par dérogation aux dispositions générales prévoyant un devis, une convention et un paiement à trente jours, les offres expressément présentées comme achetables directement en ligne, dont le Diagnostic IA Express, sont commandées par l'acceptation des conditions applicables et le paiement intégral immédiat par Stripe. Cette dérogation ne modifie pas les modalités des formations, conventions ou commandes professionnelles qui restent soumises à un devis ou à des conditions particulières.

#### Professionnels susceptibles de bénéficier de règles protectrices — **RECOMMANDÉE**

> Lorsqu'une disposition impérative étend au client professionnel certaines règles protectrices, notamment dans les conditions limitées prévues à l'article L221-3 du Code de la consommation pour certains contrats hors établissement, cette disposition prévaut sur toute clause contraire.

Cette réserve ne doit pas être présentée comme un droit général de rétractation pour tous les achats B2B à distance.

## Arbitrages restant indispensables

Avant toute modification des CGV et toute production, Thierry doit encore valider :

1. le sort du prix après une annulation à moins de vingt-quatre heures sans report accordé ;
2. le sort du prix en cas de non-présentation ;
3. le délai annoncé pour effectuer un remboursement ;
4. le mécanisme exact de recueil et de preuve des consentements B2C lorsque le rendez-vous intervient avant la fin du délai légal ;
5. la validation juridique finale des formulations proposées.
