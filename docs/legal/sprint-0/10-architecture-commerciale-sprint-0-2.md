# Sprint 0.2 — Architecture commerciale B2C préparatoire

> Statut : **préparatoire — non publié — aucune règle marquée « À VALIDER JURIDIQUEMENT » n'est automatisée**
> Date de l'audit technique : 12 août 2026

## Tunnel constaté avant correction

Les pages `formation-ia-generative`, `formation-prompt-engineering` et
`formation-ia-act-conformite` appelaient directement `create-checkout` avec le
seul `course_id`. Stripe recueillait une acceptation générique de conditions,
mais FormaPrompt ne conservait ni version de CGV ni consentements distincts.
Après `checkout.session.completed`, le webhook signé enregistrait `purchases`
et créait immédiatement un `course_access` actif. Aucun envoi contractuel par
courriel n'était présent.

## Qualification commerciale corrigée localement

| Offre | Composantes observées | Paiement direct |
|---|---|---|
| `formation-ia` | accès LMS et 10 h accompagnées | maintenu après qualification du parcours |
| `formation-prompt-level-1` | accès LMS et 7 h accompagnées | maintenu après qualification du parcours |
| `formation-ia-act` | accès LMS, e-learning et 4 h accompagnées | maintenu après qualification du parcours |

Le tunnel demande désormais au payeur de choisir entre achat personnel, achat
professionnel pour soi, achat pour un bénéficiaire et financement OPCO. Cette
déclaration est contrôlée côté serveur et enregistrée avec l'intention Stripe.
Chaque offre déclare explicitement la présence d'une prestation de service et
d'une composante numérique. Une incertitude juridique sur une composante reste
isolée dans la configuration offre/parcours et ne ferme plus la vente entière.

## Modèle de preuve

- `legal_document_versions` conserve une copie unique et figée par version ;
- `commercial_checkout_intents` relie utilisateur, offre, contexte commercial,
  politique d'activation, version de CGV et session Stripe ;
- `commercial_consents` conserve chaque consentement séparé avec un horodatage
  PostgreSQL et une référence vers son texte versionné ;
- Stripe ne reçoit que `checkout_intent_id` et les références techniques déjà
  nécessaires ;
- le webhook refuse une session sans intention et preuves concordantes.

Aucune version préparatoire des CGV n'est insérée comme `published`.

## Activation de l'accès

`course_access` reste l'unique source de droits pédagogiques. Un particulier
peut demander l'accès immédiat avec les consentements séparés requis ou payer
en choisissant un accès différé. Le webhook enregistre toujours l'achat valide,
mais ne crée un `course_access` que si l'intention porte la politique
`immediate_after_payment`. L'achat pour un bénéficiaire est également payable,
avec attribution administrative ultérieure au compte vérifié du bénéficiaire.
Aucun statut ni second système d'accès n'est créé.

Pour un contrat individuel relevant des articles L6353-3 et suivants, le
Checkout intégral immédiat reste interdit par configuration. Un parcours
distinct doit gérer la signature, le délai de dix jours, le maximum de 30 %
après ce délai et l'échelonnement du solde.

## Rétractation

`withdrawal_requests` enregistre une déclaration, la commande, l'identité
déclarée, le canal d'accusé et l'heure serveur. `submit-withdrawal-request`
vérifie l'identité Auth et l'appartenance de la commande. Cette opération ne
rembourse pas Stripe, ne supprime aucune donnée et ne modifie jamais
`course_access`.

L'interface permet de télécharger un accusé texte contenant la référence et
l'horodatage serveur. Un envoi automatique de l'accusé sur support durable par
un service de courriel transactionnel reste nécessaire avant de présenter le
workflow comme juridiquement complet. Aucun prestataire payant n'est ajouté ici.

## Décisions encore nécessaires avant publication

1. validation juridique offre par offre de la divisibilité des composantes ;
2. critères précis d'application du contrat individuel de formation, sans
   l'étendre automatiquement à toute vente B2C ;
3. version définitive et date d'effet des CGV B2C et B2B ;
4. formulations versionnées de commencement anticipé et, le cas échéant, de
   contenu numérique ;
5. procédure administrative d'activation différée et d'attribution au bénéficiaire ;
6. plan de bascule des sessions Stripe éventuellement ouvertes avant le
   déploiement du contrôle de preuve.
