import { useParams, Link, Navigate } from 'react-router-dom';
import { Calendar, User, ArrowLeft, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import SEO from '../components/SEO';

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .single();

      if (data) {
        setPost(data);
      } else if (error) {
        console.error("Erreur lors de la récupération de l'article:", error);
      }
      setLoading(false);
    }

    fetchPost();
  }, [slug]);

  if (loading) {
    return <div className="container section text-center" style={{ padding: '4rem 0' }}>Chargement de l'article...</div>;
  }

  if (!post && !loading) {
    return <Navigate to="/blog" replace />;
  }

  const canonicalUrl = `https://www.formaprompt.com/blog/${post.slug}`;
  const seoTitle = post.seo_title || `${post.title} – FormaPrompt`;
  const seoDescription = post.meta_description
    || post.excerpt
    || `Lisez l'article ${post.title} sur le blog de FormaPrompt.`;
  const socialImage = post.image_url || 'https://www.formaprompt.com/assets/blog-cover.png';
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: seoDescription,
    image: [socialImage],
    datePublished: post.created_at,
    dateModified: post.created_at,
    inLanguage: 'fr-FR',
    mainEntityOfPage: canonicalUrl,
    author: {
      '@type': 'Person',
      name: post.author || 'Thierry FREZARD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'FormaPrompt',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.formaprompt.com/assets/logo-new.png',
      },
    },
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        url={canonicalUrl}
        image={socialImage}
        type="article"
        jsonLd={articleJsonLd}
      />
      <article className="container section" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: '2rem', fontWeight: '500' }}>
        <ArrowLeft size={18} /> Retour au blog
      </Link>

      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-primary)', background: 'var(--color-bg)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '600' }}>
          <Tag size={16} /> {post.category}
        </div>
        <h1 className="blog-post-title" style={{ lineHeight: '1.2', marginBottom: '1.5rem', color: 'var(--color-secondary)' }}>
          {post.title}
        </h1>
        <div className="blog-post-meta" style={{ color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} />
            {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} />
            {post.author}
          </span>
        </div>
      </div>

      {post.image_url && (
        <div className="blog-post-hero" style={{ marginBottom: '3rem', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <img src={post.image_url} alt={post.image_alt || post.title} />
        </div>
      )}

      <div className="blog-content" style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--color-text)' }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            table: ({ node, ...props }) => {
              void node;
              return (
                <div className="blog-table-scroll" role="region" aria-label="Tableau de l'article" tabIndex="0">
                  <table {...props} />
                </div>
              );
            },
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>

      <div style={{ marginTop: '4rem', padding: '2rem', background: 'var(--color-secondary)', borderRadius: '16px', color: 'white', textAlign: 'center' }}>
        <h3 style={{ color: 'white', marginBottom: '1rem' }}>Besoin d'accompagner vos équipes ?</h3>
        <p style={{ marginBottom: '2rem', opacity: '0.9' }}>
          FormaPrompt propose des parcours d'acculturation et de maîtrise de l'IA pour garantir votre conformité et booster votre productivité.
        </p>
        <Link to="/contact" className="btn btn-primary" style={{ background: 'white', color: 'var(--color-secondary)' }}>
          Demander une formation IA
        </Link>
      </div>
    </article>
    </>
  );
}
