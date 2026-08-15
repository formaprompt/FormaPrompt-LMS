# Déploiement coordonné du Sprint 1.1

Ce plan ne constitue pas une autorisation de production.

## Répartition des contenus

- `paid-course-content` contient exactement 16 documents privés PDF/DOCX.
- Aucune vidéo et aucun type MIME `video/mp4` ne sont autorisés dans ce bucket.
- La capsule Prompt Engineering reste sur IONOS au chemin déjà actif :
  `assets/FP_-_Capsule_001_-_Rédiger_un_bon_prompt_finale_with_captions-Bpy1HKEs.mp4`.
- Référence actuelle : 81 766 551 octets, SHA-256
  `da16d1d40f463a1a4486dc2ac1b0a7a1265cb05f850edaf9bb9b238197c6459b`.

## Contrôle d'accès de la vidéo IONOS

1. `paid-course-content` authentifie l'utilisateur et contrôle exclusivement
   son `course_access` actif et non expiré.
2. Après validation, l'Edge Function émet une autorisation HMAC SHA-256 valable
   au maximum cinq minutes pour `paid-video.php`.
3. Le frontend échange cette autorisation par `POST`, sans signature dans l'URL,
   contre un cookie `HttpOnly`, `Secure` et `SameSite=Strict` de même durée.
4. La passerelle IONOS valide le cookie avec `hash_equals`, puis diffuse le
   fichier existant avec prise en charge des requêtes HTTP `Range`.
5. `.htaccess` refuse tout accès HTTP direct au MP4. La passerelle le lit sur
   le système de fichiers IONOS ; le fichier n'est ni déplacé ni dupliqué.
6. Le secret HMAC est commun aux deux serveurs, mais reste uniquement dans les
   secrets Edge et dans `/Formaprompt/.private/paid-video-config.php`. Ce fichier
   serveur n'est jamais ajouté à Git, au build, aux logs ou au rapport.

## Ordre de déploiement corrigé

1. Capturer les références de rollback Supabase et l'archive de `/Formaprompt`.
2. Vérifier l'absence logique, puis appliquer séparément les cinq migrations.
3. Vérifier les deux buckets privés. Pour `paid-course-content`, contrôler la
   limite de 10 Mio et les seuls MIME PDF/DOCX.
4. Uploader les 16 documents avec `upsert=false`, puis vérifier chemin, taille,
   MIME et SHA-256. Confirmer l'absence totale de MP4 et le compte exact de 16.
5. Configurer le secret HMAC côté Edge et dans le fichier privé IONOS hors Git.
6. Déployer et tester les quatre Edge Functions.
7. Déposer et tester `paid-video.php` : échange HMAC par `POST`, cookie court et
   requêtes `Range`, puis publier la règle `.htaccess` qui bloque le MP4 direct.
8. Construire le frontend et confirmer que `dist` ne contient aucun MP4, aucun
   secret et aucune URL permanente de la capsule.
9. Comparer le SHA-256 du média IONOS avec la référence. S'il est identique, ne
   jamais l'uploader. Un média volumineux n'est transféré que si son SHA-256 a
   changé et dans le cadre d'une opération média explicitement autorisée.
10. Déployer les autres fichiers de `/Formaprompt` : assets modifiés d'abord,
    HTML/prérendus/service worker en dernier. Ne supprimer aucun média inchangé.
11. Vérifier : URL directe du MP4 en 403, cookie absent ou expiré en 403, grant
    HMAC valide puis lecture en 200/206, déplacement dans la vidéo, refus des accès
    suspended/revoked/refunded/expired, parcours commerciaux inchangés.

## Rollback

- Restaurer `.htaccess`, `paid-video.php` et le frontend depuis l'archive IONOS.
- Restaurer ou retirer les quatre Edge Functions selon leurs références.
- Supprimer seulement les 16 objets ajoutés et les deux buckets Sprint vides.
- Annuler les cinq migrations uniquement si leurs tables sont encore sans donnée
  réelle et conformément aux scripts de rollback validés.
- Ne jamais supprimer ni réuploader le MP4 pendant ce rollback s'il est intact.
