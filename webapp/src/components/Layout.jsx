import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

import SEO from './SEO';

export default function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">Passer au contenu principal</a>
      <Header />
      <SEO
        title="FormaPrompt – Formations IA, Prompt Engineering, Bureautique"
        description="Plateforme professionnelle de formations en IA générative, prompt engineering et outils bureautiques.">
      </SEO>
      <main id="main-content" style={{ flexGrow: 1 }} tabIndex="-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
