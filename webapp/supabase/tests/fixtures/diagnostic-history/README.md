# Socle historique Diagnostic de la CI

Ces fichiers SQL reproduisent les migrations historiques du Diagnostic absentes
du répertoire de migrations courant. Le workflow les copie uniquement sur son
runner éphémère, avant `supabase migration up --local --include-all`.

Les neuf fichiers de réservation, questionnaire et restitution ajoutés pour la
PR calendrier sont des copies exactes des blobs de
`0b34f73e4a62f03ce516b337a8d525d8f852f48a`, dans
`webapp/supabase/migrations/`. Ils complètent les deux fixtures paiement et
consentements déjà présentes. Ils rétablissent notamment la table
`diagnostic_ia_bookings` et la fonction `claim_diagnostic_ia_booking`, nécessaires
à la compilation de la migration calendrier.

Ces fixtures ne sont pas de nouvelles migrations de production. Elles ne doivent
être appliquées à aucun projet Supabase distant. Aucun secret ni donnée métier
de production n'est inclus. Les tests créent leurs propres données fictives.
