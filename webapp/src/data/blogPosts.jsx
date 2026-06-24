export const blogPosts = [
  {
    id: 1,
    slug: 'ia-act-obligation-formation-salaries',
    title: "IA Act : l'obligation de former les salariés à l'IA est déjà entrée en application",
    date: '2026-05-11',
    author: 'Thierry FREZARD',
    excerpt: "Depuis le 2 février 2025, l'article 4 du règlement européen sur l'intelligence artificielle impose une obligation de littératie en IA aux fournisseurs et aux déployeurs de systèmes d'IA.",
    category: 'Juridique & Conformité',
    content: (
      <>
        <p>
          Depuis le 2 février 2025, l'article 4 du règlement européen sur l'intelligence artificielle (IA Act) impose une obligation de <strong>littératie en IA</strong> aux fournisseurs et aux déployeurs de systèmes d'IA. Autrement dit, si votre entreprise utilise l'Intelligence Artificielle d'une quelconque manière, vous êtes désormais dans l'obligation légale de former vos collaborateurs.
        </p>

        <h3>Qu'est-ce que la littératie en IA selon l'IA Act ?</h3>
        <p>
          La "littératie en IA" (ou alphabétisation en matière d'IA) désigne les compétences, les connaissances et la compréhension permettant d'utiliser de manière éclairée les systèmes d'IA. Le législateur européen a compris qu'une technologie aussi puissante ne pouvait être déployée sans un accompagnement humain robuste.
        </p>
        <p>
          Il ne s'agit pas simplement de savoir comment se connecter à ChatGPT ou Copilot. L'obligation vise à s'assurer que les employés :
        </p>
        <ul className="feature-list" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <li>Comprennent le fonctionnement global des systèmes qu'ils utilisent.</li>
          <li>Sont conscients des limites et des risques (hallucinations, biais, fuite de données).</li>
          <li>Savent interpréter les résultats fournis par la machine avec esprit critique.</li>
        </ul>

        <h3>Qui est concerné ?</h3>
        <p>Cette obligation touche à la fois :</p>
        <ol style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          <li><strong>Les fournisseurs</strong> : Les entreprises qui développent ou commercialisent des systèmes d'IA.</li>
          <li><strong>Les déployeurs</strong> : Toute entreprise, administration ou organisation qui met un système d'IA à la disposition de ses salariés dans un cadre professionnel.</li>
        </ol>
        <p>
          Dès lors que vous fournissez un accès à des outils basés sur l'IA générative (comme Microsoft 365 Copilot) ou que vous intégrez l'IA dans vos processus métier, vous êtes considéré comme un "déployeur" au sens de l'IA Act.
        </p>

        <h3>Quels sont les risques en cas de non-conformité ?</h3>
        <p>
          L'IA Act prévoit un régime de sanctions très strict. Le non-respect des obligations, y compris celle de la formation du personnel, peut entraîner de lourdes amendes pour l'entreprise. Mais au-delà du risque juridique, le véritable risque est opérationnel :
        </p>
        <ul className="feature-list" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <li><strong>Fuite de données confidentielles</strong> (Shadow AI).</li>
          <li><strong>Erreurs stratégiques</strong> dues à une confiance aveugle envers les résultats générés par l'IA.</li>
          <li><strong>Perte de compétitivité</strong> si les outils sont mal exploités par les équipes.</li>
        </ul>

        <h3>Comment se mettre en conformité rapidement ?</h3>
        <p>
          Pour répondre à cette obligation légale, la mise en place d'un plan de formation s'impose. C'est ici que <strong>FormaPrompt</strong> intervient.
        </p>
        <p>
          En tant que formateur certifié (CertifIAG), j'accompagne les entreprises dans cette mise en conformité à travers des formations concrètes et adaptées :
        </p>
        <ul className="feature-list" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <li><strong>Acculturation IA</strong> : Pour comprendre les bases, les risques et les bonnes pratiques (répondant exactement à l'exigence de "littératie" de l'IA Act).</li>
          <li><strong>Prompt Engineering</strong> : Pour aller plus loin et transformer l'IA en un véritable assistant productif et sécurisé.</li>
        </ul>
        <p style={{ fontStyle: 'italic', background: 'var(--color-bg)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
          N'attendez pas un contrôle ou un incident lié à la sécurité des données. La formation de vos équipes n'est plus une simple option d'optimisation, c'est une nécessité légale.
        </p>
      </>
    )
  }
];
