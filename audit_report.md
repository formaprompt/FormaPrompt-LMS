# FormaPrompt – Audit & Recommandations

---

## 1. Vue d'ensemble
Le site est une plateforme de formation professionnelle construite avec **React (Vite)**, stylisée avec un **système de design CSS** sur mesure, et propulsée par **Supabase** pour les données et le stockage. Il comprend déjà :
- Une section hero moderne avec une image percutante.
- Plusieurs pages de formation (Prompt Engineering, Bureautique, etc.).
- Un **Dashboard Admin** avec gestion des utilisateurs, contacts, achats et du blog.
- Une fonctionnalité **Calendrier / Disponibilités** avec contrôle admin et prise en compte des jours fériés.
- Un **Blog** avec prise en charge du Markdown + GFM, stocké dans Supabase.
- Un contexte d'authentification et un routage basé sur les rôles.

L’implémentation fonctionne, mais un site professionnel orienté conversion peut encore être amélioré sur plusieurs points.

---

## 2. SEO (Optimisation pour les moteurs de recherche)
| Domaine | État actuel | Recommandation |
|---------|--------------|----------------|
| **Balises title** | Génériques (ex. `FormaPrompt – Home`). | Assurez‑vous que chaque page possède un **titre unique, riche en mots‑clés** (max 60 caractères). Utilisez la bibliothèque `react-helmet`/`react-helmet-async` pour les injecter dynamiquement. |
| **Meta description** | Manquantes ou génériques. | Ajoutez une **meta description** (120‑155 caractères) pour chaque page, décrivant le contenu et l’appel à l’action. |
| **Open Graph / Twitter Cards** | Absentes. | Ajoutez les balises `<meta property="og:*" …>` et `<meta name="twitter:*" …>` afin d’optimiser l’apparence des liens partagés sur les réseaux sociaux. |
| **URL canonique** | Non définie. | Ajoutez `<link rel="canonical" href="…" />` pour éviter les pénalités de contenu dupliqué. |
| **Sitemap** | Aucun sitemap généré. | Générez un sitemap XML (`/sitemap.xml`) listant toutes les pages statiques et les articles du blog. Déployez‑le via le dossier `public/` de Vite. |
| **Robots.txt** | Manquant. | Créez un `robots.txt` autorisant les moteurs à explorer le site tout en bloquant les zones privées (`/admin`, `/dashboard`). |
| **Données structurées** | Absentes. | Ajoutez du JSON‑LD schema.org pour **Organization**, **Article**, **Course**, etc. – améliore le rendu des résultats enrichis. |
| **Slug d’URL** | Le blog utilise déjà le slug ; c’est bien. | Veillez à ce que le **slug** soit en minuscules, séparé par des tirets et concis, avec des mots‑clés pertinents. |
| **Liens internes** | Le header ne contient que les liens principaux. | Ajoutez des **liens internes contextuels** dans les pages de formation et les articles de blog (ex. « En savoir plus sur l’IA Act »). |

---

## 3. Accessibilité (a11y)
| Domaine | Problème | Correction |
|--------|----------|-----------|
| **Attributs alt** | Certaines images (hero, formation) n’ont pas de texte alternatif descriptif. | Ajoutez un texte `alt` significatif ou `aria‑label` pour les images décoratives (`alt=""`). |
| **Contraste** | La couleur principale `#059669` sur fonds sombres peut être limite. | Vérifiez le contraste ≥ 4.5:1 avec un outil WCAG ; ajustez la nuance si nécessaire. |
| **HTML sémantique** | De nombreuses sections utilisent des `<div>` génériques au lieu de `<section>`, `<article>`, `<header>`. | Remplacez par les balises sémantiques appropriées – améliore la navigation des lecteurs d’écran. |
| **Navigation clavier** | Les boutons et liens ont des styles personnalisés mais aucune indication de focus. | Ajoutez un style de focus visible (ex. `outline: 2px solid var(--color-primary);`). |
| **Rôles ARIA** | Les modaux (réservation, formulaire blog) n’ont pas `role="dialog"` ni `aria‑modal`. | Ajoutez les attributs ARIA aux conteneurs de modaux. |
| **Labels de formulaire** | Les champs utilisent des placeholders sans `label` explicite. | Assurez‑vous que chaque `<input>`/`<textarea>` possède un `<label>` lié via `htmlFor` et `id`. |
| **Lien de saut** | Aucun lien « passer au contenu principal ». | Ajoutez un lien caché en haut de la page qui devient visible au focus (ex. `Skip to main content`). |

---

## 4. Performances & Optimisation
| Domaine | Observation | Recommandation |
|--------|-------------|----------------|
| **Taille du bundle** | Le build montre un chunk principal assez lourd (~700 KB gzippé). | Implémentez le **code‑splitting** (`React.lazy` + `Suspense`) pour les pages lourdes (Blog, Dashboard Admin, Calendrier). |
| **Optimisation des images** | L’image hero et les images du blog sont servies en pleine résolution. | Utilisez le **responsive `srcset`**, convertissez les images en **WebP/AVIF**, et stockez les versions compressées dans le bucket Supabase. |
| **Lazy loading** | Les images sont chargées immédiatement. | Ajoutez `loading="lazy"` aux images non critiques et utilisez un `IntersectionObserver` pour le chargement au scroll. |
| **CSS** | Tout le CSS global est importé en un seul fichier. | Envisagez les **CSS modules** ou **CSS‑in‑JS** pour des styles scoped et éviter le CSS inutile. |
| **Mise en cache** | Aucun service‑worker ni headers de cache. | Ajoutez un **service worker** (ex. plugin Vite PWA) pour mettre en cache les assets statiques et offrir une expérience offline. |
| **Scripts tiers** | Aucun présent actuellement, mais analytics pourra être ajouté. | Chargez les scripts d’analytics de façon asynchrone et respectez le consentement RGPD. |
| **Requêtes Supabase** | Le tableau de bord charge tous les utilisateurs, achats, contacts, articles d’un coup. | Paginez les données, ne récupérez que les champs nécessaires (`select('id,email,role')`) et ajoutez des spinners de chargement pour les gros ensembles. |

---

## 5. Sécurité & Protection des données (RGPD)
| Domaine | Manque | Solution |
|--------|--------|----------|
| **Authentification** | Les contrôles de rôle existent, mais l’API autorise encore tout utilisateur authentifié à créer un article de blog (côté client). | Ajoutez des **politiques RLS** dans Supabase : seul le rôle `admin` peut `INSERT/UPDATE/DELETE` dans `blog_posts`. |
| **XSS dans le Markdown** | `ReactMarkdown` peut rendre du HTML brut s’il est présent. | Activez `remark-gfm` avec **`rehype-sanitize`** (ou `DOMPurify`) pour nettoyer le HTML. |
| **Bannière de consentement** | Aucun bandeau de cookies. | Intégrez une bannière de consentement RGPD (ex. `react-cookie-consent`). |
| **Politique de confidentialité** | Un lien existe mais pas de page dédiée détaillée. | Créez une page **Politique de confidentialité** expliquant la collecte de données (Supabase, analytics, etc.). |
| **CSRF** | Supabase utilise des tokens, généralement sécurisé. | Vérifiez que toutes les requêtes POST/PUT envoient bien le header `Authorization` et utilisent HTTPS. |

---

## 6. Contenu & Marketing
| Domaine | Observation | Recommandation |
|--------|-------------|----------------|
| **Témoignages / Proof‑social** | Aucun. | Ajoutez un **carrousel de témoignages** sur la page d’accueil (photos, citations, logos d’organismes). |
| **Call‑to‑Action (CTA)** | Les boutons existent mais le libellé peut être vague. | Utilisez des verbes d’action clairs (`« Réservez votre créneau gratuit »`, `« Télécharger le guide IA »`). |
| **Capture d’e‑mail** | Pas de newsletter. | Proposez un petit **lead magnet** (PDF gratuit) avec un formulaire d’inscription (intégration Mailchimp / Brevo). |
| **Catégories / Tags du blog** | Le champ `category` existe mais pas d’interface de filtrage. | Implémentez une barre de filtres pour parcourir par catégorie ou tag. |
| **FAQ** | Inexistante. | Créez une page **FAQ** répondant aux questions fréquentes sur la formation IA, les tarifs, les certifications. |
| **Multilingue** | Contenu uniquement en français. | Si vous ciblez des clients internationaux, envisagez l’**i18n** (ex. `react-i18next`). |

---

## 7. Dette technique & Qualité du code
| Problème | Détail | Action proposée |
|----------|--------|-----------------|
| **Styles inline répétés** | De nombreux composants utilisent de gros objets `style={}`. | Déplacez ces styles dans des **CSS modules** ou des **styled components** réutilisables. |
| **Chaînes de caractères en dur** | Titres, textes de bouton codés en dur en français. | Externalisez le texte UI dans un fichier de **constants** pour faciliter la localisation. |
| **Fichiers composants trop gros** (`AdminDashboard.jsx` > 350 lignes). | | Scindez en sous‑composants (`UserTable`, `ContactList`, `BlogManager`). |
| **Absence de TypeScript** | Projet en pure JavaScript. | Envisagez la migration vers **TypeScript** pour une meilleure maintenabilité et la détection précoce d’erreurs. |
| **Pas de tests** | Aucun test unitaire ou d’intégration. | Ajoutez des tests avec **Jest + React Testing Library** pour les composants critiques (Blog, Calendrier, Auth). |
| **Imports inutilisés** | Certains fichiers importent `useNavigate` sans l’utiliser. | Exécutez un linter (`eslint`) et supprimez le code mort. |

---

## 8. Recommandations – Feuille de route priorisée
1. **Bases SEO** – balises title/meta, sitemap, robots.txt (impact élevé, effort faible).
2. **Accessibilité** – texte alt, styles de focus, attributs ARIA (conformité légale, UX).
3. **Sécurité** – politiques RLS sur le blog, désinfection du Markdown, consentement cookies (critique).
4. **Performance** – découpage du code, lazy‑load des images, images responsives (améliore les Core Web Vitals).
5. **Cohérence du design** – migrer les styles inline vers des modules CSS, ajouter un toggle mode sombre (polish de la marque).
6. **Améliorations marketing** – témoignages, FAQ, capture d’e‑mail, filtres du blog (boost conversion).
7. **Tests & CI** – ajouter des tests unitaires, configurer une pipeline CI (maintenabilité).
8. **Analytics & monitoring** – intégrer Google Analytics 4 avec consentement, ajouter un suivi d’erreurs (Sentry). 

---

## 9. Gains rapides (≤ 2 jours)
- Ajouter les balises `<title>` et `<meta description>` via `react-helmet-async`.
- Créer `public/robots.txt` et `public/sitemap.xml` (liste statique des pages).
- Mettre en place la désinfection du Markdown (`rehype-sanitize`).
- Ajouter les attributs `alt` descriptifs à toutes les images.
- Ajouter un style de focus visible aux éléments interactifs.
- Transformer le CSS du hero en classe `.hero` dans `index.css`.
- Configurer les politiques RLS Supabase pour `blog_posts` (écriture admin uniquement). 

---

**Conclusion**
Le site possède déjà une bonne base : UI claire, fonctionnalité de calendrier, blog fonctionnel. En appliquant les points de cet audit, vous améliorerez la visibilité naturelle, l’accessibilité, la sécurité et le taux de conversion, positionnant FormaPrompt comme une plateforme de formation B2B hautement professionnelle.

---

*Préparé par Antigravity – votre partenaire IA de codage et de produit*
