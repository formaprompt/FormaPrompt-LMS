import './TrainingVisual.css';

// Existing portrait, also used on /a-propos. This is not presented as a classroom photograph.
export function TrainerPortrait() {
  return (
    <figure className="trainer-portrait">
      <img src="/assets/Photo_thierry_frezard.jpg" alt="Thierry FREZARD, votre formateur" width="1080" height="1080" />
      <figcaption><strong>Thierry FREZARD</strong><span>Formateur professionnel d’adultes</span></figcaption>
    </figure>
  );
}

// Public example from studio/categories/professionalEmail.ts; no private lesson is exposed.
export function PracticeExample() {
  return (
    <aside className="practice-example" aria-labelledby="practice-example-title">
      <p className="practice-example__label">Exemple de pratique · Situation fictive</p>
      <h2 id="practice-example-title">Préparer un rappel de réunion</h2>
      <div className="practice-example__step">
        <h3>À essayer</h3>
        <p>Rappelle à des participants adultes leur réunion à distance, mardi à 10 h. Le lien figure dans leur convocation. Demande une confirmation avant lundi midi.</p>
        <p>Ton cordial, objet explicite, moins de 160 mots. N’invente aucune information.</p>
      </div>
      <div className="practice-example__step">
        <h3>À vérifier</h3>
        <ul><li>La date et l’heure sont respectées</li><li>La confirmation attendue est explicite</li><li>Aucun lien ni détail n’a été inventé</li></ul>
      </div>
      <p className="practice-example__source">D’après l’exemple public du Studio FormaPrompt</p>
    </aside>
  );
}
