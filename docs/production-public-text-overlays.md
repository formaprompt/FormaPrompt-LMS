# Texte public des groupes Créativité en production

Vérifié le 1er novembre 2026. Le frontend actuellement publié utilise « Quatre participants minimum, six maximum. » ; le fichier partagé du dépôt conserve aussi une possibilité de confirmation à deux participants. Cette différence opérateur était déjà signalée dans la PR n°32.

Le patch `webapp/scripts/production-overlays/creativity-group-opening.patch` conserve explicitement la transformation de texte nécessaire pour reconstruire ce frontend. Il ne modifie ni tarif, ni seuil enregistré, ni droit, ni paiement. Il n’est pas appliqué automatiquement au dépôt, au backend ou à une migration.

Pour une release du frontend : travailler sur une copie isolée et sauvegardée des sources, vérifier le contexte exact du patch, appliquer uniquement cette transformation à la copie avant compilation, puis contrôler le texte du bundle et des pré-rendus. Conserver également les corrections Qualiopi, du lien vidéo Genie 4 et du SEO Diagnostic/H1 déjà publiées. Ne jamais publier un ancien build d’aperçu ou copier tout un ancien arbre sur la production.

La copie opérateur, ses empreintes et son plan de transfert restent des preuves locales. Aucun secret, contenu pédagogique privé, donnée client ou rapport Search Console n’est nécessaire dans ce document. Toute application aux fonctions serveur ou modification du comportement commercial demande une décision distincte.
