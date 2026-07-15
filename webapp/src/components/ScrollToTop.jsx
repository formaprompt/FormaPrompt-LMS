import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return undefined;
    }

    const targetId = decodeURIComponent(hash.slice(1));
    const mainContent = document.getElementById('main-content');

    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return false;

      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      return true;
    };

    if (scrollToTarget()) return undefined;

    // Les pages chargées à la demande peuvent afficher leur contenu après
    // le changement d'adresse. On attend alors que la section soit créée.
    const observer = new MutationObserver(() => {
      if (scrollToTarget()) observer.disconnect();
    });

    observer.observe(mainContent || document.body, {
      childList: true,
      subtree: true,
    });

    const timeout = window.setTimeout(() => observer.disconnect(), 3000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [pathname, search, hash]);

  return null;
}
