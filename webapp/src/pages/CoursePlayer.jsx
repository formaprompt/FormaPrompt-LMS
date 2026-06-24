import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FileText, Download, Play, Search, Copy, Check, BookOpen, Code, Sparkles } from 'lucide-react';
import './CoursePlayer.css';

export default function CoursePlayer() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [activeTab, setActiveTab] = useState('downloads');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Données des exercices IA
  const exercises = [
    {
      id: 1,
      title: "Formulation structurée (Méthode RTFC)",
      objective: "Rôle, Tâche, Format, Contraintes",
      instructions: "Cet exercice consiste à rédiger un e-mail de relance client. Le prompt ci-dessous configure l'IA pour jouer un rôle précis avec des contraintes strictes. Copiez-le et testez-le dans ChatGPT, Claude ou Gemini.",
      prompt: `Agis en tant que formateur et assistant administratif. Rédige un e-mail de relance poli et professionnel pour un client dont la facture de formation de 1500€ est en retard de 15 jours. Le ton doit être ferme mais courtois, orienté solution. Propose un appel téléphonique si besoin de facilités de paiement. Limite le texte à 150 mots maximum.`
    },
    {
      id: 2,
      title: "Simplification et adaptation de concepts",
      objective: "Vulgarisation pédagogique",
      instructions: "Un bon formateur sait adapter son discours. Utilisez ce prompt pour demander à l'IA d'expliquer un concept complexe à deux publics radicalement différents.",
      prompt: `Explique le concept de "RAG" (génération augmentée de récupération) en IA à deux publics différents :
1. Un enfant de 10 ans avec une analogie simple (ex: une bibliothèque ouverte).
2. Un responsable informatique avec des termes techniques précis.
Structure ta réponse de manière claire avec des titres.`
    },
    {
      id: 3,
      title: "Analyse de document et synthèse Markdown",
      objective: "Extraction & Structuration",
      instructions: "Cet exercice vous entraîne à faire synthétiser des données brutes par l'IA sous forme de livrable structuré et exploitable immédiatement.",
      prompt: `Voici le compte-rendu de notre réunion : [coller le texte ici].
Synthétise ce texte sous forme de tableau Markdown contenant 3 colonnes :
1. Tâche / Action identifiée
2. Personne responsable
3. Date d'échéance estimée
Ajoute ensuite une section avec 3 conseils clés pour améliorer notre efficacité sur ce projet.`
    }
  ];

  // Lexique de l'IA
  const glossary = [
    {
      term: "Prompt",
      definition: "Instruction textuelle ou consigne fournie à un modèle d'IA (comme ChatGPT, Claude, Gemini) pour guider et structurer sa réponse (texte, image, code)."
    },
    {
      term: "LLM (Large Language Model)",
      definition: "Grand modèle de langage entraîné sur d'immenses volumes de données textuelles pour être capable de comprendre, traduire, résumer et générer du langage naturel de façon fluide."
    },
    {
      term: "Token",
      definition: "Unité de base (morceau de mot, mot ou groupe de caractères) utilisée par les modèles d'IA pour découper et traiter le texte. 100 mots représentent généralement environ 130 à 140 tokens."
    },
    {
      term: "Hallucination",
      definition: "Phénomène par lequel une IA génère une réponse factuellement fausse, inventée ou inexacte, tout en conservant un ton extrêmement affirmatif et convaincant."
    },
    {
      term: "RAG (Retrieval-Augmented Generation)",
      definition: "Méthode qui connecte un LLM à une base de documents externes (propres à une entreprise ou récents) pour lui permettre de répondre en se basant sur des données réelles et vérifiables sans réentraînement."
    },
    {
      term: "Température",
      definition: "Paramètre de réglage des modèles d'IA contrôlant le niveau de créativité ou de hasard des réponses. Une température basse (ex: 0.1) génère des réponses factuelles et précises ; une température haute (ex: 0.8) favorise la diversité et la créativité."
    },
    {
      term: "Fine-Tuning (Ajustement fin)",
      definition: "Processus d'adaptation consistant à réentraîner un modèle d'IA généraliste sur un jeu de données spécialisé afin de le rendre performant sur une tâche ou un secteur d'activité précis."
    }
  ];

  useEffect(() => {
    async function verifyAccess() {
      if (!user) {
        navigate('/login');
        return;
      }

      // Vérifie si l'utilisateur possède cette formation précise
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', id);

      if (data && data.length > 0) {
        setAccessGranted(true);
      } else {
        // Redirige vers la page d'achat s'il n'a pas payé
        navigate(`/${id === 'formation-ia' ? 'formation-ia-generative' : ''}`);
      }
      setLoading(false);
    }

    verifyAccess();
  }, [id, user, navigate]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Filtrage du lexique par barre de recherche
  const filteredGlossary = glossary.filter(item =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="container section">Chargement sécurisé de la formation...</div>;
  if (!accessGranted) return null;

  return (
    <div className="container course-player-container">
      <div className="course-header">
        <h1 className="course-title">Lecteur de Formation</h1>
        <div className="access-badge">
          <Sparkles size={16} />
          Accès vérifié et sécurisé
        </div>
      </div>
      
      {/* Lecteur Vidéo */}
      <div className="video-container">
        <Play className="video-placeholder-icon" />
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
          Module 1 : Fondations de l'IA & Prompt Engineering
        </p>
        <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          [ Lecteur Vidéo (Vimeo / YouTube non répertorié) ]
        </p>
      </div>

      {/* Espace Ressources Interactif */}
      <div className="resources-section">
        <div className="resources-tabs">
          <button 
            className={`tab-btn ${activeTab === 'downloads' ? 'active' : ''}`}
            onClick={() => setActiveTab('downloads')}
          >
            <FileText size={20} />
            Supports & PDF
          </button>
          <button 
            className={`tab-btn ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            <Code size={20} />
            Exercices Pratiques IA
          </button>
          <button 
            className={`tab-btn ${activeTab === 'glossary' ? 'active' : ''}`}
            onClick={() => setActiveTab('glossary')}
          >
            <BookOpen size={20} />
            Lexique de l'IA
          </button>
        </div>

        <div className="tab-content">
          {/* Onglet Téléchargements */}
          {activeTab === 'downloads' && (
            <div className="download-grid">
              <div className="download-card">
                <div className="file-icon-wrapper">
                  <FileText size={24} />
                </div>
                <div className="file-info">
                  <div className="file-title">Guide du Prompt Engineering</div>
                  <div className="file-desc">Découvrez comment structurer vos consignes de manière optimale pour ChatGPT, Claude, Gemini et Mistral. (Format PDF)</div>
                  <a 
                    href="/assets/creation-prompt-efficace-chatgpt.pdf" 
                    download="creation-prompt-efficace-chatgpt.pdf"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                  >
                    <Download size={16} />
                    Télécharger le PDF
                  </a>
                </div>
              </div>
              
              <div className="download-card">
                <div className="file-icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                  <Sparkles size={24} />
                </div>
                <div className="file-info">
                  <div className="file-title">Fiche Synthétique - Aide-mémoire IA</div>
                  <div className="file-desc">Un résumé pratique des meilleures pratiques de prompt engineering, des structures prêtes à l'emploi et des astuces d'évaluation.</div>
                  <a 
                    href="/assets/Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf" 
                    download="Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf"
                    className="btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem', border: '1px solid #cbd5e1' }}
                  >
                    <Download size={16} />
                    Télécharger l'Aide-mémoire
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Onglet Exercices */}
          {activeTab === 'exercises' && (
            <div className="exercise-list">
              {exercises.map((ex) => (
                <div key={ex.id} className="exercise-card">
                  <div className="exercise-header">
                    <div className="exercise-title-area">
                      <span className="exercise-number">{ex.id}</span>
                      <h3 className="exercise-title">{ex.title}</h3>
                    </div>
                    <span className="exercise-objective">{ex.objective}</span>
                  </div>
                  <div className="exercise-body">
                    <div className="exercise-instructions">{ex.instructions}</div>
                    <div className="prompt-box">
                      <pre className="prompt-text">{ex.prompt}</pre>
                      <button 
                        className={`copy-btn ${copiedId === ex.id ? 'copied' : ''}`}
                        onClick={() => handleCopy(ex.prompt, ex.id)}
                        title="Copier le prompt dans le presse-papier"
                      >
                        {copiedId === ex.id ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Onglet Lexique */}
          {activeTab === 'glossary' && (
            <div>
              <div className="glossary-search-wrapper">
                <Search className="glossary-search-icon" size={20} />
                <input 
                  type="text" 
                  placeholder="Rechercher un terme (ex: Prompt, RAG, Token...)" 
                  className="glossary-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredGlossary.length > 0 ? (
                <div className="glossary-grid">
                  {filteredGlossary.map((item, index) => (
                    <div key={index} className="glossary-item">
                      <h3 className="glossary-term">{item.term}</h3>
                      <p className="glossary-def">{item.definition}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  Aucun terme ne correspond à votre recherche "<strong>{searchTerm}</strong>".
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

