# Maintenance de la publication AI Act Challenge

AI Act Challenge a été publié le **9 octobre 2026**. Une demande de fusion Git ne déclenche aucune nouvelle publication.

## Historique des migrations

Les trois sources ci-dessous ont déjà été appliquées en production dans une seule transaction, via le bundle MCP de version `20261009162922`, nommé `ai_act_challenge_publication_atomic_20261008180934_20261009113150_20261009125159`.

| Source | SHA-256 publié |
|---|---|
| `20261008180934_ai_act_challenge.sql` | `2EFC4320E77999B7D2D0F37FD32A553A4D616323D415D36AF42DF6949CE9F3E8` |
| `20261009113150_ai_act_challenge_privacy_manual.sql` | `D901F0E2D6A9A97E9A39054F13C18C9C72EF528DB6B8A7DC7C3F6C24DDCE7B78` |
| `20261009125159_ai_act_challenge_pedagogical_end.sql` | `A9599A28DCAB5D9F40170F265C26277B7D9890C95686CC00D77BF3368226B700` |

Les trois versions sources ont ensuite été enregistrées comme appliquées dans l'historique, **sans rejouer leur DDL**. Le contrôle de publication `history-bookkeeping-summary.json` indique : `status=PASS`, quatre entrées vérifiées, empreintes sources conformes, `ddlReplayed=false` et tables métier inchangées après cette régularisation.

**Avant tout futur pipeline de migration**, réconcilier l'historique avec la version supplémentaire du bundle MCP `20261009162922`. Conserver la trace des quatre entrées et ne jamais rejouer les trois sources sur cette production. Les fichiers sources restent nécessaires pour reconstruire une base vierge dans leur ordre chronologique.

## Construction et publication du site

La route privée du Challenge est désormais générée par la construction du site. Les scripts de release contrôlent sa présence dans l'artefact. Une construction, un commit, une demande de fusion ou une fusion ne transfèrent pas cet artefact : toute nouvelle publication reste une opération distincte nécessitant son autorisation.
