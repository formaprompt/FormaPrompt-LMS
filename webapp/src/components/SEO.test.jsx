import { cleanup, render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, expect, it } from 'vitest';
import SEO from './SEO';

afterEach(cleanup);

it.each(['https://www.formaprompt.com/blog', 'http://formaprompt.com/blog', 'https://formaprompt.com/blog'])('aligne canonical, Open Graph et données par défaut pour %s', async (url) => {
  render(<HelmetProvider><SEO title="Blog" description="Actualités" url={url} /></HelmetProvider>);
  await waitFor(() => {
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/blog');
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute('content', 'https://formaprompt.com/blog');
    expect(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).url).toBe('https://formaprompt.com/blog');
  });
});
