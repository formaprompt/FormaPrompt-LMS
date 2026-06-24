import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  // Blog Form State
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', category: '', excerpt: '', content: '' });
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'employee')) {
      navigate('/dashboard');
      return;
    }

    async function fetchData() {
      // Fetch users
      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setUsers(profilesData);

      // Fetch purchases
      const { data: purchasesData } = await supabase.from('purchases').select('*');
      if (purchasesData) setPurchases(purchasesData);

      // Fetch contacts
      const { data: contactsData } = await supabase.from('contact_requests').select('*').order('created_at', { ascending: false });
      if (contactsData) setContacts(contactsData);

      // Fetch blog posts
      const { data: postsData } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
      if (postsData) setBlogPosts(postsData);

      // Fetch satisfaction surveys
      const { data: surveysData } = await supabase.from('satisfaction_surveys').select('*').order('created_at', { ascending: false });
      if (surveysData) setSurveys(surveysData);

      setLoading(false);
    }

    fetchData();
  }, [user, role, navigate]);

  if (!user || (role !== 'admin' && role !== 'employee')) return null;

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase
      .from('contact_requests')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (!error) {
      setContacts(contacts.map(c => c.id === id ? { ...c, status: newStatus } : c));
    }
  };

  const handleTogglePublishSurvey = async (id, currentStatus) => {
    const { error } = await supabase
      .from('satisfaction_surveys')
      .update({ is_published: !currentStatus })
      .eq('id', id);
      
    if (!error) {
      setSurveys(surveys.map(s => s.id === id ? { ...s, is_published: !currentStatus } : s));
    }
  };

  const generateSlug = (text) => {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  };

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) {
      alert("Le titre et le contenu sont obligatoires.");
      return;
    }

    setIsUploading(true);
    let imageUrl = newPost.image_url || null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Erreur d'upload :", uploadError);
        alert("Erreur lors de l'importation de l'image.");
        setIsUploading(false);
        return;
      }

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    const postData = {
      title: newPost.title,
      slug: generateSlug(newPost.title),
      category: newPost.category || 'Général',
      excerpt: newPost.excerpt,
      content: newPost.content,
      image_url: imageUrl,
      author: 'Thierry FREZARD'
    };

    if (editingPostId) {
      const { data: updatedPost, error } = await supabase
        .from('blog_posts')
        .update(postData)
        .eq('id', editingPostId)
        .select();

      if (error) {
        console.error("Erreur de mise à jour :", error);
        alert("Erreur lors de la modification de l'article.");
      } else if (updatedPost) {
        setBlogPosts(blogPosts.map(p => p.id === editingPostId ? updatedPost[0] : p));
        resetForm();
      }
    } else {
      const { data: insertedPost, error } = await supabase
        .from('blog_posts')
        .insert([postData])
        .select();

      if (error) {
        console.error("Erreur de création :", error);
        alert("Erreur lors de la création de l'article.");
      } else if (insertedPost) {
        setBlogPosts([insertedPost[0], ...blogPosts]);
        resetForm();
      }
    }
    
    setIsUploading(false);
  };

  const resetForm = () => {
    setIsAddingPost(false);
    setEditingPostId(null);
    setNewPost({ title: '', category: '', excerpt: '', content: '' });
    setImageFile(null);
  };

  const handleEditPost = (post) => {
    setNewPost(post);
    setEditingPostId(post.id);
    setIsAddingPost(true);
  };

  const handleDeletePost = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cet article ?")) {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (!error) {
        setBlogPosts(blogPosts.filter(p => p.id !== id));
      }
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1rem', minHeight: '80vh' }}>
      <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '2rem' }}>⚙️</span> Panneau d'Administration
      </h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : ''}`}
          style={activeTab !== 'overview' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Vue d'ensemble
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : ''}`}
          style={activeTab !== 'users' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Clients & Inscriptions
        </button>
        <button 
          onClick={() => setActiveTab('contacts')} 
          className={`btn ${activeTab === 'contacts' ? 'btn-primary' : ''}`}
          style={activeTab !== 'contacts' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Demandes de Devis
        </button>
        <button 
          onClick={() => setActiveTab('blog')} 
          className={`btn ${activeTab === 'blog' ? 'btn-primary' : ''}`}
          style={activeTab !== 'blog' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Blog & Actualités
        </button>
        <button 
          onClick={() => setActiveTab('feedback')} 
          className={`btn ${activeTab === 'feedback' ? 'btn-primary' : ''}`}
          style={activeTab !== 'feedback' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Avis & Qualiopi
        </button>
      </div>

      <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '12px', border: '1px solid #333' }}>
        {loading ? (
          <p>Chargement des données...</p>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Total Utilisateurs</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{users.length}</p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Demandes en attente</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#f59e0b' }}>
                    {contacts.filter(c => c.status === 'pending').length}
                  </p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Articles de blog</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--color-primary)' }}>
                    {blogPosts.length}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Liste des Clients</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444', color: '#aaa' }}>
                        <th style={{ padding: '1rem' }}>Email</th>
                        <th style={{ padding: '1rem' }}>Rôle</th>
                        <th style={{ padding: '1rem' }}>Date d'inscription</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '1rem' }}>{u.email}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: u.role === 'admin' ? '#ef4444' : '#3b82f6', color: '#fff' }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#aaa' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Demandes de Devis et Contacts</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {contacts.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucune demande pour le moment.</p>
                  ) : (
                    contacts.map(c => (
                      <div key={c.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: `1px solid ${c.status === 'pending' ? '#f59e0b' : '#444'}`, position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ margin: '0 0 0.25rem 0' }}>{c.name} <span style={{ color: '#aaa', fontSize: '1rem', fontWeight: 'normal' }}>({c.email})</span></h3>
                            <p style={{ color: '#3b82f6', fontWeight: 'bold', margin: 0 }}>Sujet: {c.subject}</p>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>{new Date(c.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            {c.status === 'pending' ? (
                              <button onClick={() => handleStatusChange(c.id, 'processed')} style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Marquer Traité
                              </button>
                            ) : (
                              <button onClick={() => handleStatusChange(c.id, 'pending')} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#aaa', border: '1px solid #aaa', borderRadius: '4px', cursor: 'pointer' }}>
                                Traité ✓
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ background: '#1e1e1e', padding: '1rem', borderRadius: '6px', color: '#ddd', whiteSpace: 'pre-wrap' }}>
                          {c.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'blog' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Gestion du Blog</h2>
                  <button 
                    onClick={() => {
                      if (isAddingPost) resetForm();
                      else setIsAddingPost(true);
                    }} 
                    className="btn btn-primary"
                  >
                    {isAddingPost ? "Annuler" : "+ Nouvel Article"}
                  </button>
                </div>

                {isAddingPost ? (
                  <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', border: '1px solid #444', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>{editingPostId ? "Modifier l'article" : "Rédiger un nouvel article"}</h3>
                    <form onSubmit={handleSavePost}>
                      <div className="form-group">
                        <label>Image d'en-tête (Optionnel)</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => setImageFile(e.target.files[0])}
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.5rem', width: '100%', borderRadius: '4px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Titre de l'article *</label>
                        <input 
                          type="text" 
                          value={newPost.title} 
                          onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                          required 
                          placeholder="Ex: Les 5 avantages de l'IA..."
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Catégorie</label>
                        <input 
                          type="text" 
                          value={newPost.category} 
                          onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                          placeholder="Ex: IA Générative"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Résumé (S'affiche sur la liste des articles)</label>
                        <textarea 
                          value={newPost.excerpt} 
                          onChange={(e) => setNewPost({...newPost, excerpt: e.target.value})}
                          rows="3"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Contenu complet (Format Markdown autorisé)</label>
                        <small style={{ display: 'block', color: '#aaa', marginBottom: '0.5rem' }}>
                          Astuce : Utilisez **texte** pour le gras, # Titre pour un grand titre, et - pour des puces.
                        </small>
                        <textarea 
                          value={newPost.content} 
                          onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                          required
                          rows="15"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444', fontFamily: 'monospace' }}
                        ></textarea>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={isUploading} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                        {isUploading ? "Publication en cours..." : "Publier l'article"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {blogPosts.length === 0 ? (
                      <p style={{ color: '#888' }}>Aucun article publié. Créez votre premier article !</p>
                    ) : (
                      blogPosts.map(post => (
                        <div key={post.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {post.image_url ? (
                              <img src={post.image_url} alt="miniature" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : (
                              <div style={{ width: '80px', height: '80px', background: '#1e1e1e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                                Sans image
                              </div>
                            )}
                            <div>
                              <h3 style={{ margin: '0 0 0.5rem 0' }}>{post.title}</h3>
                              <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>Publié le {new Date(post.created_at).toLocaleDateString()} • {post.category}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleEditPost(post)} 
                              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Modifier
                            </button>
                            <button 
                              onClick={() => handleDeletePost(post.id)} 
                              style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'feedback' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Questionnaires de satisfaction (Qualiopi)</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {surveys.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucun avis reçu pour le moment.</p>
                  ) : (
                    surveys.map(s => (
                      <div key={s.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ margin: '0 0 0.25rem 0' }}>{s.student_name} <span style={{ color: '#aaa', fontSize: '1rem', fontWeight: 'normal' }}>({s.student_email})</span></h3>
                            <p style={{ color: 'var(--color-primary)', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>{s.course_name} (Fin le {new Date(s.training_date).toLocaleDateString()})</p>
                            <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>Soumis le {new Date(s.created_at).toLocaleString()}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                              {s.rating_overall}/5
                            </div>
                            <small style={{ color: '#aaa' }}>Global</small>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Pédagogie: <strong style={{ color: '#fbbf24' }}>{s.rating_pedagogy}/5</strong></span>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Objectifs: <strong style={{ color: '#fbbf24' }}>{s.rating_objectives}/5</strong></span>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Logistique: <strong style={{ color: '#fbbf24' }}>{s.rating_logistics}/5</strong></span>
                        </div>

                        {s.public_testimonial && (
                          <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ color: '#fff' }}>Témoignage public :</strong>
                            <p style={{ fontStyle: 'italic', background: '#1e1e1e', padding: '1rem', borderRadius: '6px', margin: '0.5rem 0' }}>"{s.public_testimonial}"</p>
                            
                            {s.consent_marketing ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#10b98120', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #10b981' }}>
                                <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ Accord marketing donné</span>
                                <button 
                                  onClick={() => handleTogglePublishSurvey(s.id, s.is_published)}
                                  className="btn"
                                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', background: s.is_published ? '#ef4444' : '#10b981', color: 'white', border: 'none' }}
                                >
                                  {s.is_published ? 'Dépublier du site' : 'Publier sur le site'}
                                </button>
                              </div>
                            ) : (
                              <div style={{ background: '#ef444420', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #ef4444' }}>
                                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>✗ Pas d'accord marketing (Ne pas publier)</span>
                              </div>
                            )}
                          </div>
                        )}

                        {s.private_feedback && (
                          <div>
                            <strong style={{ color: '#fff' }}>Remarques (Confidentiel) :</strong>
                            <p style={{ background: '#1e1e1e', padding: '1rem', borderRadius: '6px', margin: '0.5rem 0', color: '#fca5a5' }}>{s.private_feedback}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
