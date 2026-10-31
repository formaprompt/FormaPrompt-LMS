import { useState } from 'react';

const OFFICIAL_VIDEO = 'https://www.youtube.com/watch?v=sFfPkUJd_Jk';

// Only this reviewed editorial link becomes a player. Other links stay ordinary links.
export default function BlogVideoLink({ node, href, children, ...props }) {
  void node;
  const [active, setActive] = useState(false);
  if (href !== OFFICIAL_VIDEO) return <a href={href} {...props}>{children}</a>;

  return (
    <span style={{ display: 'block', margin: '1.5rem 0' }}>
      <span style={{ display: 'block', aspectRatio: '16 / 9', width: '100%', background: 'var(--color-secondary)', borderRadius: '12px', overflow: 'hidden' }}>
        {active ? (
          <iframe
            ref={element => element?.focus()}
            src="https://www.youtube-nocookie.com/embed/sFfPkUJd_Jk?rel=0"
            title="Démonstration officielle de Genie 4 par Google DeepMind"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <button type="button" onClick={() => setActive(true)} style={{ width: '100%', height: '100%', padding: '1.5rem', color: '#fff', background: 'transparent', border: '2px solid currentColor', cursor: 'pointer', font: 'inherit', borderRadius: '12px' }}>
            Lire la démonstration de Genie 4 (YouTube)
          </button>
        )}
      </span>
      {!active && <span style={{ display: 'block', fontSize: '0.9rem' }}>Au clic, le lecteur YouTube est chargé et votre navigateur se connecte à Google.</span>}
      <a href={OFFICIAL_VIDEO} target="_blank" rel="noopener noreferrer">Voir la vidéo sur YouTube (nouvel onglet)</a>
    </span>
  );
}
