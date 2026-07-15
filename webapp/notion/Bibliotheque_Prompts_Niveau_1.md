# Bibliothèque de prompts — Prompt Engineering Niveau 1

Support pédagogique FormaPrompt à remettre aux apprenants après la formation.

## Mode d’emploi

1. Remplacez les éléments entre crochets par votre contexte réel.
2. Ne transmettez aucune donnée personnelle, confidentielle ou sensible sans autorisation.
3. Demandez une réponse structurée, puis contrôlez les faits, les calculs et les sources.
4. Conservez les versions utiles et notez les améliorations apportées.

## Trame de conception

```text
Rôle : Tu agis comme [rôle utile, sans prétendre remplacer un professionnel réglementé].
Objectif : [résultat concret attendu].
Contexte : [informations nécessaires à la tâche].
Public : [destinataire, niveau, besoins].
Entrées : [documents ou données autorisés].
Contraintes : [longueur, ton, limites, éléments obligatoires ou interdits].
Format de sortie : [tableau, plan, email, liste, code…].
Critères de qualité : [exactitude, clarté, exhaustivité, vérifiabilité].
Contrôle : signale les informations manquantes et distingue les faits des hypothèses.
```

## 1. Rédiger un email professionnel

```text
Rédige un email destiné à [destinataire].
Objectif : [informer, demander, relancer, confirmer].
Contexte utile : [contexte].
Ton : professionnel, courtois et direct.
Contraintes : [longueur], une seule idée principale par paragraphe, aucun jargon inutile.
Inclure : un objet précis, l’action attendue et l’échéance [date].
Avant de rédiger, indique les informations indispensables qui manquent.
```

Contrôle : identité du destinataire, dates, pièces jointes annoncées, niveau de confidentialité.

## 2. Produire une synthèse fidèle

```text
À partir du texte fourni, produis une synthèse pour [public].
Conserve uniquement les informations présentes dans la source.
Sépare : faits établis, décisions, actions à réaliser et points non résolus.
Format : [nombre] sections, puis un tableau Action / Responsable / Échéance.
Si une information n’est pas dans le texte, écris « non précisé » au lieu de la déduire.
Texte source :
[COLLER UN CONTENU AUTORISÉ]
```

## 3. Adapter un contenu à un public

```text
Réécris le contenu ci-dessous pour [public et niveau].
Objectif de lecture : [ce que le lecteur doit comprendre ou savoir faire].
Conserve le sens, les réserves et les informations importantes.
Ton : [sobre, pédagogique, accessible].
Ajoute un exemple concret, puis un résumé en trois points.
N’invente aucune donnée absente du contenu initial.
Contenu : [CONTENU]
```

## 4. Créer une ressource pédagogique

```text
Conçois une activité de formation sur [thème] pour [public].
Durée : [durée]. Prérequis : [prérequis].
Objectif observable : à la fin, le participant sera capable de [verbe d’action].
Prévois : consigne, matériel, étapes, production attendue, critères de réussite et correction commentée.
L’activité doit permettre au formateur d’observer la compétence, pas seulement la mémorisation.
Signale les adaptations d’accessibilité possibles.
```

## 5. Préparer le cahier des charges d’une page HTML

```text
Prépare le cahier des charges d’une page HTML responsive sur [sujet].
Public : [public]. Action principale : [action].
Sections nécessaires : [sections].
Contraintes : HTML sémantique, navigation au clavier, contraste lisible, libellés explicites,
mise en page mobile, aucune dépendance externe sans justification.
Avant de proposer le code, présente l’arborescence de la page et les points à valider.
Après le code, fournis une courte liste de tests manuels d’accessibilité et de responsive design.
```

## 6. Construire un processus de travail contrôlé

```text
Nous allons traiter [tâche] en étapes contrôlables.
1. Reformule l’objectif et liste les informations manquantes.
2. Propose un plan court sans produire le livrable final.
3. Attends ma validation du plan.
4. Produis une première version en distinguant faits, hypothèses et éléments à vérifier.
5. Contrôle le résultat selon ces critères : [critères].
6. Propose uniquement les corrections nécessaires.
Ne poursuis pas lorsqu’une décision métier ou une donnée sensible exige ma validation.
```

## Grille de vérification finale

- L’objectif et le destinataire sont-ils explicites ?
- Les données utilisées sont-elles autorisées et minimisées ?
- Les faits importants peuvent-ils être vérifiés ?
- Les hypothèses sont-elles signalées ?
- Le format est-il directement exploitable ?
- Le ton et le niveau conviennent-ils au public ?
- Une validation humaine est-elle prévue avant diffusion ou décision ?
- Le prompt peut-il être réutilisé sans conserver de données personnelles ?

## Limite du Niveau 1

Cette bibliothèque couvre la conception et l’amélioration de prompts. Les agents, automatisations et API seront traités dans le Niveau 2.
