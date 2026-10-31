import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import BlogVideoLink from './BlogVideoLink';

afterEach(cleanup);
const url = 'https://www.youtube.com/watch?v=sFfPkUJd_Jk';
function markdown(content) {
  return render(<ReactMarkdown rehypePlugins={[rehypeSanitize]} components={{ a: BlogVideoLink }}>{content}</ReactMarkdown>);
}

it('propose un vrai lien accessible vers la vidéo officielle dans un nouvel onglet', () => {
  const { container } = markdown(`[Démonstration officielle](${url})`);
  const link = screen.getByRole('link', { name: /Voir la démonstration officielle sur YouTube.*nouvel onglet/ });
  expect(link.getAttribute('href')).toBe(url);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(container.querySelector('button,iframe,video,source,link')).toBeNull();
});
it('utilise uniquement une illustration locale décorative et une icône SVG locale', () => {
  const { container } = markdown(`[Démonstration officielle](${url})`);
  expect(container.querySelector('img').getAttribute('src')).toBe('/assets/blog/genie-4-explorer-scene-illustration.webp');
  expect(container.querySelector('img').getAttribute('alt')).toBe('');
  expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('[src^="http"],iframe,script,video,source,link')).toBeNull();
});
it.each([
  'https://www.youtube.com/watch?v=abcdefghijk',
  'https://www.youtube.com.evil.invalid/watch?v=sFfPkUJd_Jk',
  'https://www.youtube.com/watch?v=sFfPkUJd_Jk&other=1',
  'https://example.com/',
])('garde un lien normal pour %s', href => {
  const { container } = markdown(`[Lien](${href})`);
  expect(container.querySelector('button,iframe,img,svg')).toBeNull();
  expect(screen.getByRole('link').getAttribute('href')).toBe(href);
});
it('conserve le filtrage du HTML et des URL dangereuses', () => {
  const { container } = markdown('<iframe src="https://evil.invalid"></iframe>\n\n[attaque](javascript:alert%281%29)');
  expect(container.querySelector('iframe,script')).toBeNull();
  expect(container.innerHTML).not.toContain('href="javascript:');
});
