import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import BlogVideoLink from './BlogVideoLink';

afterEach(cleanup);
const url = 'https://www.youtube.com/watch?v=sFfPkUJd_Jk';
function markdown(content) {
  return render(<ReactMarkdown rehypePlugins={[rehypeSanitize]} components={{ a: BlogVideoLink }}>{content}</ReactMarkdown>);
}

it('ne crée aucun contenu externe avant le clic et garde un lien de secours', () => {
  const { container } = markdown(`[Démonstration officielle](${url})`);
  expect(container.querySelector('iframe,img,video,source,link')).toBeNull();
  expect(screen.getByRole('button').textContent).toContain('Genie 4');
  expect(screen.getByRole('link').getAttribute('href')).toBe(url);
  expect(screen.getByRole('link').getAttribute('rel')).toBe('noopener noreferrer');
});
it('crée un unique lecteur nocookie accessible en 16:9 après activation', () => {
  const { container } = markdown(`[Démonstration officielle](${url})`);
  fireEvent.click(screen.getByRole('button'));
  const iframe = container.querySelector('iframe');
  expect(iframe.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/sFfPkUJd_Jk?rel=0');
  expect(iframe.getAttribute('allow')).not.toContain('autoplay');
  expect(document.activeElement).toBe(iframe);
  expect(iframe.getAttribute('title')).toContain('Genie 4');
  expect(iframe.parentElement.style.aspectRatio).toBe('16 / 9');
  expect(container.querySelectorAll('iframe')).toHaveLength(1);
  expect(screen.getByRole('link')).toBeTruthy();
});
it.each([
  'https://www.youtube.com/watch?v=abcdefghijk',
  'https://www.youtube.com.evil.invalid/watch?v=sFfPkUJd_Jk',
  'https://www.youtube.com/watch?v=sFfPkUJd_Jk&other=1',
  'https://example.com/',
])('garde un lien normal pour %s', href => {
  const { container } = markdown(`[Lien](${href})`);
  expect(container.querySelector('button,iframe')).toBeNull();
  expect(screen.getByRole('link').getAttribute('href')).toBe(href);
});
it('conserve le filtrage du HTML et des URL dangereuses', () => {
  const { container } = markdown('<iframe src="https://evil.invalid"></iframe>\n\n[attaque](javascript:alert%281%29)');
  expect(container.querySelector('iframe,script')).toBeNull();
  expect(container.innerHTML).not.toContain('href="javascript:');
});
