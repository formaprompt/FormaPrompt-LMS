const OFFICIAL_VIDEO = 'https://www.youtube.com/watch?v=sFfPkUJd_Jk';

// Only this reviewed editorial URL receives a card. Other links stay ordinary links.
export default function BlogVideoLink({ node, href, children, ...props }) {
  void node;
  if (href !== OFFICIAL_VIDEO) return <a href={href} {...props}>{children}</a>;

  return (
    <span style={{ display: 'block', margin: '1.5rem 0' }}>
      <a href={OFFICIAL_VIDEO} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-bg)', color: 'var(--color-primary)', textDecoration: 'none' }}>
        <img src="/assets/blog/genie-4-explorer-scene-illustration.webp" alt="" width="112" height="84" loading="lazy" style={{ width: '112px', height: '84px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
        <span style={{ flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
              <path d="m9 5 11 7-11 7Z" />
            </svg>
            <span>Voir la démonstration officielle sur YouTube</span>
          </span>
          <span style={{ display: 'block', marginTop: '0.35rem', color: 'var(--color-text-light)', fontSize: '0.9rem' }}>La vidéo s’ouvre sur YouTube dans un nouvel onglet.</span>
        </span>
      </a>
    </span>
  );
}
