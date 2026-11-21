export const pricingCheckedOn = '1er novembre 2026';
export const pricingCurrencyNote = 'Prix de référence en USD. Le montant local, les taxes et les conditions applicables sont indiqués avant paiement.';

export const personalPlans = [
  { name: 'Free', price: '0 $', billing: 'Gratuit.', note: 'Découvrir les outils, avec des limites.' },
  { name: 'Go', price: '8 $/mois', billing: 'Facturation mensuelle.', note: 'Davantage de capacité sur les outils éligibles que Free.' },
  { name: 'Plus', price: '20 $/mois', billing: 'Facturation mensuelle.', note: 'GPT-6.2 Sol et Astra dans Work et Codex, sans Ultrafast.' },
  { name: 'Pro 100', price: '100 $/mois', billing: 'Facturation mensuelle.', note: 'GPT-6.2 Sol et Astra dans Work et Codex, sans Ultrafast.' },
  { name: 'Pro 200', price: '200 $/mois', billing: 'Facturation mensuelle.', note: 'GPT-6.2 Sol et Astra ; Ultrafast sur Sol uniquement dans Codex.' },
  { name: 'Pro 500', price: '500 $/mois', billing: 'Facturation mensuelle.', note: 'GPT-6.2 Sol et Astra ; Ultrafast sur les deux dans Work et Codex.' },
];

export const organizationPlans = [
  { name: 'Business Standard', price: '25 $/siège/mois', billing: 'Ou 20 $/siège/mois, facturés annuellement.', note: 'Espace administré ; accès ChatGPT, Work et Codex.' },
  { name: 'Business Premium', price: '125 $/siège/mois', billing: 'Ou 100 $/siège/mois, facturés annuellement.', note: 'Capacité supérieure à Standard ; mêmes espaces de travail.' },
  { name: 'Enterprise', price: 'Sur devis', billing: 'Conditions fixées par contrat.', note: 'Accès, limites et administration selon le contrat.' },
];

export const planAccess = [
  { name: 'Free et Go', chat: 'GPT‑5.6 Luna pour les échanges courants et Think, selon déploiement.', work: 'GPT‑6 Luna à vitesse Standard dans l’application desktop, selon déploiement.' },
  { name: 'Plus', chat: 'GPT‑6 en déploiement. GPT‑6 Pro/Astra n’est pas inclus dans Chat.', work: 'GPT-6.2 Sol et Astra en aperçu sur ordinateur ; limites du forfait.' },
  { name: 'Pro : trois paliers', chat: 'GPT‑6 et GPT‑6 Pro, propulsé par Astra, selon l’accès du compte.', work: 'GPT-6.2 Sol et Astra en aperçu sur ordinateur pour Pro 100, 200 et 500 ; capacité selon le palier.' },
  { name: 'Business', chat: 'GPT‑6 et GPT‑6 Pro selon l’accès et les réglages de l’espace.', work: 'Vérifiez le sélecteur, les droits administrateur et la capacité du siège.' },
  { name: 'Enterprise', chat: 'Modèles selon contrat, déploiement et autorisations.', work: 'GPT-6.2 annoncé pour Enterprise et Edu ; vérifiez les réglages administrateur.' },
];

export const pricingNotes = {
  personal: 'Go, Plus et Pro ne proposent pas de facturation annuelle.',
  business: 'Business exige au moins deux sièges payants. Les sièges Standard et Premium peuvent être combinés.',
  access: 'Accès GPT-6.2 actualisé le 21 novembre 2026. Sol et Astra 6.2 sont des choix Work et Codex ; cette annonce ne change pas le sélecteur du Chat classique.',
  limits: 'Work et Codex partagent une capacité d’usage. Elle varie avec le modèle, la tâche et les réglages ; consultez Usage dans votre compte. Un forfait Pro, le mode Pro dans Chat et le modèle Astra désignent des choses différentes.',
  speed: 'Selon l’annonce du 17 novembre, Plus et Pro 100 donnent accès aux deux modèles GPT-6.2, sans Ultrafast. Pro 200 propose Ultrafast uniquement sur Sol 6.2 dans Codex ; Pro 500 sur les deux modèles dans Work et Codex. En Enterprise/Edu, l’accès dépend de l’éligibilité et des réglages. Ce mode change la vitesse de traitement, pas le niveau d’effort de raisonnement.',
  api: 'L’API a sa propre facturation et ses limites. Des abonnements Pro ou Business éligibles peuvent activer des crédits API, sous conditions, via une organisation API liée. L’abonnement payant doit notamment être actif depuis au moins sept jours. Les crédits expirent selon le cycle applicable ; ils n’augmentent pas les quotas ChatGPT/Work/Codex et ne couvrent pas Codex authentifié par clé API.',
};

export const pricingSources = [
  { label: 'Annonce GPT-6.2', href: 'https://openai.com/index/introducing-gpt-6-2-astra-sol/' },
  { label: 'Tarifs et accès Work/Codex', href: 'https://learn.chatgpt.com/docs/pricing' },
  { label: 'Modes de vitesse Work/Codex', href: 'https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex' },
  { label: 'Paliers Pro', href: 'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers' },
  { label: 'Business', href: 'https://help.openai.com/en/articles/8542115-chatgpt-business-general-faq' },
  { label: 'Go et facturation', href: 'https://help.openai.com/en/articles/11989085-what-is-chatgpt-go' },
  { label: 'Modèles dans Chat', href: 'https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt' },
  { label: 'Usage Astra dans Work/Codex', href: 'https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex' },
  { label: 'Crédits API : conditions', href: 'https://developers.openai.com/api/docs/guides/chatgpt-api-credits' },
];
