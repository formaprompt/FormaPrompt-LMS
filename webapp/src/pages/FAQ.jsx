import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const faqs = [
  {
    category: "Formations & Pédagogie",
    questions: [
      {
        q: "Faut-il des compétences techniques pour suivre vos formations IA ?",
        a: "Absolument pas ! Nos formations, particulièrement l'Acculturation IA, sont conçues pour être accessibles à tous. Nous utilisons un langage clair, sans jargon, et nous avançons pas à pas."
      },
      {
        q: "Proposez-vous des formations sur mesure pour les entreprises ?",
        a: "Oui, c'est même notre spécialité. Nous concevons des parcours adaptés à vos outils métier, vos process et le niveau actuel de vos collaborateurs."
      },
      {
        q: "Comment se déroulent les formations (présentiel ou distanciel) ?",
        a: "Nous intervenons principalement en distanciel via Teams ou Zoom, mais des sessions en présentiel sont possibles dans la région Hauts-de-France (ou ailleurs sur devis)."
      }
    ]
  },
  {
    category: "Financement & Certifications",
    questions: [
      {
        q: "Vos formations sont-elles éligibles au CPF ou certifiées Qualiopi ?",
        a: "Nous intervenons en tant que sous-traitant pour des organismes certifiés Qualiopi. Pour une prise en charge (OPCO, CPF), nous travaillons avec nos partenaires agréés pour vous proposer une solution adaptée."
      },
      {
        q: "Quels sont vos tarifs ?",
        a: "Nos tarifs varient en fonction de la durée, du nombre de participants et du niveau de personnalisation demandé. Demandez-nous un devis gratuit via la page Contact, nous vous répondrons sous 24h."
      }
    ]
  },
  {
    category: "Outils & Logiciels",
    questions: [
      {
        q: "Quels outils d'IA abordez-vous pendant le Prompt Engineering ?",
        a: "Nous nous concentrons sur les leaders du marché : ChatGPT (OpenAI), Copilot (Microsoft) et Claude (Anthropic). La méthode enseignée est cependant universelle et applicable à n'importe quel modèle textuel."
      },
      {
        q: "Couvrez-vous d'autres outils que l'Intelligence Artificielle ?",
        a: "Oui ! La bureautique classique reste indispensable. Nous proposons des formations complètes sur Excel, Word, PowerPoint, ainsi que sur l'écosystème collaboratif Microsoft 365 (Teams, OneDrive, SharePoint)."
      }
    ]
  }
];

function FAQItem({ question, answer, isOpen, onClick }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', padding: '1rem 0' }}>
      <button 
        onClick={onClick}
        style={{ 
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-secondary)'
        }}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        {isOpen ? <ChevronUp size={20} color="var(--color-primary)" /> : <ChevronDown size={20} color="var(--color-text-light)" />}
      </button>
      {isOpen && (
        <div style={{ marginTop: '1rem', color: 'var(--color-text)', lineHeight: '1.6' }}>
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState("0-0"); // First item open by default

  const toggleFAQ = (categoryIndex, questionIndex) => {
    const index = `${categoryIndex}-${questionIndex}`;
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <SEO
        title="FAQ (Foire Aux Questions) – FormaPrompt"
        description="Retrouvez toutes les réponses à vos questions concernant nos formations en IA, Prompt Engineering et Bureautique."
        url="https://www.formaprompt.com/faq"
      />
      <div className="container section" style={{ maxWidth: '800px' }}>
        <div className="text-center mb-8">
          <h1 className="mb-2">Foire Aux Questions</h1>
          <p className="text-large text-gray-600">Vous avez des questions ? Nous avons les réponses.</p>
        </div>

        <div className="card">
          {faqs.map((category, catIndex) => (
            <div key={catIndex} style={{ marginBottom: catIndex !== faqs.length - 1 ? '2rem' : '0' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary)', borderBottom: '2px solid var(--color-bg)', paddingBottom: '0.5rem' }}>
                {category.category}
              </h2>
              <div>
                {category.questions.map((item, qIndex) => (
                  <FAQItem 
                    key={qIndex} 
                    question={item.q} 
                    answer={item.a} 
                    isOpen={openIndex === `${catIndex}-${qIndex}`}
                    onClick={() => toggleFAQ(catIndex, qIndex)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '4rem', padding: '2rem', background: 'var(--color-bg-white)', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
          <h3 className="mb-2">Vous n'avez pas trouvé votre réponse ?</h3>
          <p className="mb-4">N'hésitez pas à nous contacter directement. Nous serons ravis d'échanger avec vous sur votre projet.</p>
          <Link to="/contact" className="btn btn-primary">
            Contactez-nous
          </Link>
        </div>
      </div>
    </>
  );
}
