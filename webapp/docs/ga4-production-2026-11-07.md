# GA4 public : configuration de production validée

Le 7 novembre 2026, Thierry a autorisé le correctif, son activation et sa publication, puis son intégration au dépôt. La propriété Google Analytics a effectivement reçu les visites de test : 2 utilisateurs actifs et 4 événements `page_view` sur les pages publiques À propos et FAQ.

## Configuration durable

`webapp/.env.production` contient uniquement les trois valeurs publiques GA4 validées. Vite les charge pour une compilation de production. Aucun identifiant Supabase, secret serveur ou réglage personnel n'y est conservé. `.env.example` reste désactivé pour le développement. Les fichiers `.env.local` et `.env.production.local` restent ignorés.

Une variable fournie explicitement par l'environnement de compilation ou un fichier local peut remplacer ces valeurs. Avant chaque publication, vérifier dans l'artefact les trois valeurs attendues et les protections ci-dessous. Les outils de release qui recopient les sources en excluant `.env*` doivent reprendre explicitement cette configuration publique, sans recopier de secrets.

## Protections à conserver

- Consentement d'audience distinct et préalable ; fonctionnement normal du site en cas de refus.
- Domaine de production exact, liste fermée de pages publiques, titres et URL fixes sans référent.
- Aucune mesure des comptes connectés, du LMS, des routes inconnues ni des URL avec paramètres ou fragments.
- Cookies Analytics de session ; signaux Google et personnalisation publicitaire désactivés.
- Arrêt des émissions de l'ancien document avant remplacement lors du retrait du consentement ou de l'entrée dans un espace exclu.
- Un téléchargement du SDK en échec ne bloque pas le réseau ordinaire de la page.

Dans Google : mesures améliorées, Google Signals, collecte et détection automatique de données fournies par les utilisateurs désactivés et contrôlés avant activation. Revoir ces réglages avant tout élargissement de la mesure.

## Validation et publication

Le correctif a passé les tests Node et React ciblés, TypeScript, la compilation et le contrôle de release. La publication initiale a conservé les 47 pages, leur SEO, le sitemap, les quatre PDF et les fichiers protégés ; aucun backend ni changement de droits n'a été publié. Le chargement de la balise a été vérifié absent sans accord, puis présent après accord ; la réception a été confirmée dans le temps réel Google avec un second navigateur indépendant.

L'intégration Git ne constitue pas une nouvelle autorisation de publication. Une fusion nécessite l'accord distinct prévu par `AGENTS.md`.

Pour suspendre la collecte, compiler explicitement avec `VITE_GOOGLE_ANALYTICS_ENABLED=false`, puis suivre la procédure de publication autorisée. Modifier les valeurs validées exige également d'adapter le test de configuration de production.
