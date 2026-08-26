# Diagnostic IA Express — correctif juridique ciblé du 26 août 2026

## Statut

Le texte contractuel a été validé par Thierry et implémenté localement. Il n'est ni déployé ni publié en production.

Versions préparées :

- `CGV-B2C-2026-08-26` ;
- `CGV-B2B-2026-08-26` ;
- `DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26` ;
- `DIAGNOSTIC-EARLY-START-2026-08-26` ;
- `DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26` ;
- `WITHDRAWAL-FORM-2026-08-26`.

La migration additive retire les versions CGV du 12 août sans en modifier le texte ou le hash.

## Diff juridique ciblé

### B2C

Ajouts aux sections existantes :

- définition du Diagnostic IA Express, durée de 90 minutes, analyse et Plan d'action ;
- exclusions explicites de la prestation ;
- prix total de 149 €, paiement intégral en ligne et réservation après confirmation serveur ;
- distinction entre réservation, exécution anticipée et droit de rétractation ;
- deux consentements conditionnels distincts et non précochés lorsque l'exécution intervient dans le délai ;
- paiement proportionnel lorsqu'une rétractation intervient après un commencement anticipé valablement demandé mais avant exécution complète ;
- exécution complète définie par `rendez-vous de 90 minutes réalisé + Plan d'action remis` ;
- questionnaire enregistrable sans déclencher d'analyse humaine ou automatisée avant autorisation juridique ;
- annulation ou report sans frais jusqu'à 24 heures ;
- à moins de 24 heures, prix acquis et éventuel report exceptionnel unique si le client prévient avant l'heure ;
- en cas de no-show sans prévenir, prix acquis et aucun report automatique ;
- réserve expresse des droits légaux impératifs et modalités de remboursement.

### B2B

Ajouts aux sections existantes :

- exception limitée au Diagnostic pour le parcours `commande en ligne → paiement immédiat → réservation` ;
- prix total de 149 € et TVA non applicable ;
- définition et limites de la prestation ;
- règles gelées d'annulation, report et no-show ;
- réserve des dispositions impératives éventuellement applicables à certains professionnels.

Les modalités devis, convention et paiement à trente jours restent inchangées pour les autres prestations.

## Consentements et preuve

Au paiement, seule l'acceptation versionnée des CGV est recueillie. Le paiement n'entraîne aucun consentement automatique à l'exécution anticipée.

La future réservation devra calculer côté serveur la fin du délai conformément aux articles L221-18 et L221-19. Pour un créneau impliquant un commencement avant cette échéance, elle devra enregistrer deux lignes distinctes dans `diagnostic_ia_consents` :

1. demande expresse de commencement anticipé ;
2. reconnaissance de la perte du droit après exécution complète.

Le modèle conserve le contexte, le créneau considéré, l'échéance calculée, les versions exactes et les horodatages PostgreSQL. Aucun frontend ne reçoit de droit d'écriture direct.

## Confirmation durable et rétractation

Après paiement confirmé par webhook, la confirmation contractuelle reprend la commande, le prix, la TVA, la prestation et le texte figé des CGV. Le formulaire type et le lien électronique de rétractation sont ajoutés pour le parcours B2C. L'état de livraison est tracé ; un échec SMTP ne transforme pas un paiement confirmé en échec.

Le formulaire `/retractation` accepte une commande Diagnostic uniquement si elle appartient au compte, relève du parcours personnel et possède un statut `paid` ou `disputed`. L'enregistrement ne rembourse pas Stripe et ne touche jamais `purchases` ou `course_access`.

## Références

- Code de la consommation : articles L221-5, L221-13, L221-14, L221-18, L221-19, L221-24, L221-25 et L221-28 ;
- Code de la consommation : articles L212-1 et L221-3 ;
- Code civil : article 1231-5 ;
- Code général des impôts : article 293 B.

## Risque résiduel

La conservation intégrale du prix en cas d'annulation à moins de 24 heures ou de no-show B2C reste susceptible d'être appréciée au regard du déséquilibre significatif et d'une éventuelle pénalité manifestement excessive. La réserve des dispositions impératives est intégrée, mais une validation juridique professionnelle demeure recommandée avant production.
