Quand je prépare un exercice Excel, j’ai besoin de données simples, d’une consigne que l’apprenant comprend et d’un corrigé que je peux vérifier rapidement. Si je dois construire une formation à partir d’un référentiel, d’un programme et de plusieurs supports, mon premier travail consiste à repérer ce qui se contredit ou ce qui manque. Je ne choisirais pas forcément le même modèle dans les deux cas.

## Sol ou Astra : par lequel commencer ?

OpenAI a annoncé **GPT‑6.2 Sol** et **GPT‑6.2 Astra** le 17 novembre 2026. Sol est présenté comme le modèle polyvalent pour les tâches courantes, y compris en plusieurs étapes. Astra vise les travaux qui demandent un raisonnement plus poussé. Les deux sont disponibles dans le sélecteur de modèles de ChatGPT Work ou de Codex, selon votre abonnement et les réglages de votre espace de travail. Ils sont aussi disponibles via l’API. Dans le Chat classique, cette annonce ne change pas le choix des modèles. [Annonce d’OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/) · [Aide ChatGPT Work et Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex).

| Votre tâche | Mon point de départ | Ce que je contrôle |
| --- | --- | --- |
| Préparer un exercice Excel et son corrigé | Sol 6.2 | Les formules, le corrigé et le niveau demandé. |
| Croiser un référentiel, un programme et un support | Astra 6.2 si le dossier est dense ou contradictoire | Les sources, les écarts et les inconnues. |
| Reprendre un premier livrable incomplet | Préciser la consigne, puis essayer Astra si les mêmes écarts persistent | Les erreurs corrigées et le temps de relecture gagné. |

Ce sont des conseils fondés sur le positionnement annoncé des modèles et sur les besoins de ces tâches. Les deux essais ci-dessous montrent ce que chaque réponse m’a apporté sur une tâche précise.

## Test Excel : deux corrigés justes, deux façons de vérifier les acquis

Prenons trois ventes fictives de 120 €, 180 € et 300 €. L’apprenant a déjà vu SOMME, MIN, MAX et MOYENNE. Je demanderais une fiche d’exercice et un corrigé séparé. Pour la relecture, j’attends un total de **600 €**, un minimum de **120 €**, un maximum de **300 €** et une moyenne de **200 €**. Ensuite, je change une cellule pour vérifier que le corrigé repose sur des formules et pas sur des résultats recopiés.

> **À copier dans les deux modèles :** « Préparez une activité de 30 minutes pour des adultes débutants qui connaissent SOMME, MIN, MAX et MOYENNE. Placez les ventes 120, 180 et 300 dans les cellules B2 à B4. Donnez les consignes apprenant, un corrigé séparé avec les formules en français et deux critères de réussite observables. »

J’ai essayé Sol 6.2, puis Astra 6.2, sur le même exercice de calcul. Les deux ont proposé un déroulé de 30 minutes, un corrigé séparé et les quatre bonnes formules. La différence se joue dans la dernière consigne :

- **Sol 6.2** fait passer la deuxième vente de 180 à 240 €. L’apprenant vérifie que le total et la moyenne changent, puis contrôle les formules dans la barre de formule. C’est un bon exercice de prise en main d’Excel.
- **Astra 6.2** demande de prévoir ce qui changera avant de passer la première vente de 120 à 150 €, puis de rédiger un court bilan pour le responsable du magasin. Je préfère cette dernière étape si je veux vérifier que l’apprenant sait expliquer les chiffres.

Les deux réponses ont été produites dans le même fil, avec une demande explicite à Astra de ne pas utiliser le contexte précédent. Ce n’est pas un test en deux conversations indépendantes. Je n’ai pas mesuré le temps de réponse ni le temps de retouche. Sur cet exercice, Sol suffit pour travailler les formules ; je reprendrais la consigne de bilan d’Astra pour évaluer leur interprétation.

## Test sur trois PDF : relire un dossier de formation

J’ai donné aux deux modèles les trois mêmes PDF fictifs : un référentiel, un programme et un support formateur. J’ai utilisé deux discussions distinctes avec la même consigne de fond et le réglage de raisonnement « Élevée ».

Les deux ont repéré les corrections indispensables : **le programme prévoit 45 minutes au lieu des 60 imposées**, et **la restitution orale en binômes ne remplace pas la réponse individuelle exigée en fin de séance**. Ils ont aussi compris que les 90 minutes citées dans le support concernent l’atelier fictif décrit dans l’exercice, pas la séance à préparer. Tous deux laissent au formateur le choix du minutage de l’évaluation.

- **Astra 6.2** chiffre les 15 minutes manquantes et propose une consigne d’évaluation prête à reprendre : chaque participant relève une affirmation, puis indique l’information de la fiche qui permet de la vérifier ou la source à consulter si elle ne suffit pas.
- **Sol 6.2** explique comment exploiter le cas en formation. Il distingue notamment ce que la fiche confirme, comme la durée de 90 minutes, de ce qu’elle ne permet pas d’affirmer, comme la gratuité et le créneau annoncé.

Pour ce dossier d’une page par document, **Sol suffit à repérer les écarts importants**. Je reprendrais la consigne d’Astra pour la fiche d’évaluation et les exemples de Sol pour la correction orale. Cet essai ne permet pas de conclure sur des dossiers plus longs, ni de comparer la vitesse ou le coût des réponses.

## Essayez les deux sur le même dossier

Prenez les mêmes fichiers fictifs, le même prompt et le même environnement. Si les deux modèles le permettent, fixez le même niveau de raisonnement. Ouvrez une nouvelle conversation pour chaque essai. Si vous partez de l’exemple ci-dessus, constituez trois mini-sources d’une page chacune : **A, référentiel** : une évaluation individuelle et une durée de 60 minutes ; **B, programme** : exercices en binômes, durée annoncée de 45 minutes ; **C, support** : une restitution finale collective. Le corrigé doit signaler les durées contradictoires sans choisir à votre place, conserver les binômes si possible, et proposer une vérification individuelle distincte de la restitution collective.

Voici une consigne CROP à copier :

> **Contexte :** je prépare une formation à partir de trois documents fictifs. **Rôle :** vous m’aidez à relire le dossier. **Objectif :** relevez les écarts entre le référentiel, le programme et le support qui changent le déroulé ou l’évaluation. **Précisions :** pour chaque écart, indiquez la source et la page, puis séparez le constat de votre proposition. Écrivez « non précisé » si une information manque. N’inventez aucune exigence.

Comptez les écarts correctement repérés, les références vérifiées et les erreurs ajoutées. Chronométrez aussi les retouches : c’est souvent ce temps qui départage deux réponses utilisables. Un essai renseigne sur votre tâche, pas sur l’ensemble des usages. Si les deux résultats conviennent, gardez le modèle qui vous laisse le moins de travail.

Pour retrouver les modèles selon votre tâche et savoir où les sélectionner, consultez le [guide FormaPrompt GPT‑6, 6.1 et 6.2](/guide-gpt-6-codex).
