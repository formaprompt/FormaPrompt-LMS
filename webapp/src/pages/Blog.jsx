import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, BookOpen, Filter } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';

export default function Blog() {
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Tous');

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setBlogPosts(data);
      } else if (error) {
        console.error("Erreur lors de la récupération des articles:", error);
      }
      setLoading(false);
    }

    fetchPosts();
  }, []);

  // Extraction des catégories uniques
  const categories = useMemo(() => {
    const cats = blogPosts.map(post => post.category).filter(Boolean);
    return ['Tous', ...new Set(cats)];
  }, [blogPosts]);

  // Filtrage des articles
  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'Tous') return blogPosts;
    return blogPosts.filter(post => post.category === selectedCategory);
  }, [blogPosts, selectedCategory]);

  return (
    <>
      <SEO
        title="Blog – FormaPrompt"
        description="Actualités, conseils et analyses sur l'IA générative et la bureautique."
        url="https://www.formaprompt.com/blog"
        image="https://www.formaprompt.com/assets/blog-cover.png"
      />
      <div className="container section">
      <div className="text-center mb-8">
        <h1 className="mb-2">Le Blog FormaPrompt</h1>
        <p className="text-large" style={{ color: 'var(--color-text-light)' }}>
          Actualités, conseils et analyses sur l'IA générative et la bureautique.
        </p>
      </div>

      {!loading && blogPosts.length > 0 && categories.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '3rem', alignItems: 'center' }}>
          <Filter size={18} color="var(--color-text-light)" style={{ marginRight: '0.5rem' }} />
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: `1px solid ${selectedCategory === category ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: selectedCategory === category ? 'var(--color-primary)' : 'transparent',
                color: selectedCategory === category ? 'white' : 'var(--color-text)',
                cursor: 'pointer',
                fontWeight: selectedCategory === category ? '600' : '400',
                transition: 'all 0.2s'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-light)' }}>
          Chargement des articles...
        </div>
      ) : blogPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-light)' }}>
          Aucun article publié pour le moment.
        </div>
      ) : filteredPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-light)' }}>
          Aucun article trouvé pour cette catégorie.
        </div>
      ) : (
        <div className="grid grid-cols-2" style={{ gap: '2rem' }}>
          {filteredPosts.map((post) => (
            <div key={post.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
              {post.image_url && (
                <div style={{ height: '200px', width: '100%', overflow: 'hidden' }}>
                  <img src={post.image_url} alt={post.image_alt || post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                </div>
              )}
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span style={{ padding: '4px 10px', background: 'var(--color-bg)', borderRadius: '20px' }}>{post.category}</span>
                </div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                  <Link to={`/blog/${post.slug}`} style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={16} />
                    {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <BookOpen size={16} />
                    {post.author}
                  </span>
                </div>
                <p style={{ color: 'var(--color-text-light)', marginBottom: '2rem', flexGrow: 1 }}>
                  {post.excerpt}
                </p>
                <div style={{ marginTop: 'auto' }}>
                  <Link to={`/blog/${post.slug}`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    Lire l'article <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
