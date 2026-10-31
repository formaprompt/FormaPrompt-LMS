import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

import SEO from './SEO';

export default function Layout() {
  const { pathname } = useLocation();
  const dedicatedSeoRoutes = [
    '/',
    '/a-propos',
    '/blog',
    '/guides',
    '/cgv',
    '/informations-precontractuelles',
    '/contact',
    '/disponibilites',
    '/diagnostic-ia',
    '/faq',
    '/aide/bien-demarrer',
    '/feedback',
    '/formation-',
    '/guide-gpt-',
    '/mentions-legales',
    '/politique-confidentialite',
    '/privacy',
    '/reglement-interieur',
    '/paiement-reussi',
    '/reservation-formation',
    '/studio',
  ];
  const pageProvidesDedicatedSeo = dedicatedSeoRoutes.some((route) => (
    route === '/' || route === '/diagnostic-ia' ? pathname === route : pathname.startsWith(route)
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">Passer au contenu principal</a>
      <Header />
      {!pageProvidesDedicatedSeo && (
        <SEO
          title="FormaPrompt – Formations IA, Prompt Engineering, Bureautique"
          description="Plateforme professionnelle de formations en IA générative, prompt engineering et outils bureautiques."
        />
      )}
      <main id="main-content" style={{ flexGrow: 1 }} tabIndex="-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
