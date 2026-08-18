import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BlogPost from './BlogPost';

const { singlePostMock } = vi.hoisted(() => ({
  singlePostMock: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: singlePostMock,
        })),
      })),
    })),
  },
}));

function renderBlogPost() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/blog/meilleur-generateur-prompts-comparatif-2026']}>
        <Routes>
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/blog" element={<p>Liste du blog</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('article de blog et métadonnées SEO', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    singlePostMock.mockResolvedValue({
      data: {
        title: 'Quel est le meilleur générateur de prompts en 2026 ?',
        slug: 'meilleur-generateur-prompts-comparatif-2026',
        category: 'Prompt Engineering',
        excerpt: 'Extrait visible dans la liste du blog.',
        seo_title: 'Meilleur générateur de prompts en 2026 : comparatif',
        meta_description: 'Comparez les principaux générateurs de prompts en 2026.',
        content: '| Solution | Usage |\n| --- | --- |\n| FormaPrompt Studio | Construction guidée |',
        image_url: 'https://example.test/article.png',
        image_alt: 'Comparaison visuelle des principales méthodes de création de prompts.',
        author: 'Thierry FREZARD',
        created_at: '2026-07-20T10:00:00.000Z',
      },
      error: null,
    });
  });

  it('utilise les champs SEO, le texte alternatif et un balisage Article', async () => {
    renderBlogPost();

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Quel est le meilleur générateur de prompts en 2026 ?',
    })).toBeInTheDocument();

    expect(screen.getByRole('img', {
      name: 'Comparaison visuelle des principales méthodes de création de prompts.',
    })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: "Tableau de l'article" })).toHaveAttribute('tabindex', '0');

    await waitFor(() => {
      expect(document.title).toBe('Meilleur générateur de prompts en 2026 : comparatif');
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        'Comparez les principaux générateurs de prompts en 2026.',
      );
      expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article');
      expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
      expect(document.querySelectorAll('meta[property="og:type"]')).toHaveLength(1);
      expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://formaprompt.com/blog/meilleur-generateur-prompts-comparatif-2026',
      );
    });

    const structuredData = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    expect(structuredData).toMatchObject({
      '@type': 'Article',
      headline: 'Quel est le meilleur générateur de prompts en 2026 ?',
      author: { '@type': 'Person', name: 'Thierry FREZARD' },
      mainEntityOfPage: 'https://formaprompt.com/blog/meilleur-generateur-prompts-comparatif-2026',
    });
  });
});
