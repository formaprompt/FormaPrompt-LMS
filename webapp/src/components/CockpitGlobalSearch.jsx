import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { learnerDirectoryPath } from '../lib/adminLearnerRecord';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

export default function CockpitGlobalSearch({ entries = [] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const normalizedQuery = normalize(query);
  const tokens = useMemo(() => normalizedQuery.split(/\s+/).filter(Boolean), [normalizedQuery]);
  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return entries
      .filter((entry) => tokens.every((token) => normalize(entry.searchText).includes(token)))
      .slice(0, 6);
  }, [entries, normalizedQuery, tokens]);

  function submit(event) {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(learnerDirectoryPath(query));
  }

  return (
    <section className="cockpit-global-search" aria-labelledby="cockpit-global-search-title">
      <div>
        <p>Accès direct</p>
        <h2 id="cockpit-global-search-title">Recherche globale</h2>
        <span>Nom, entreprise ou formation</span>
      </div>
      <form role="search" onSubmit={submit}>
        <label htmlFor="cockpit-global-search-input">Que recherchez-vous ?</label>
        <div>
          <input
            id="cockpit-global-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex. Marie Dupont, Entreprise Alpha ou IA générative"
            maxLength="200"
          />
          <button type="submit">Rechercher dans tous les apprenants</button>
        </div>
      </form>
      {normalizedQuery.length >= 2 && (
        <div className="cockpit-global-search__results" aria-live="polite">
          {results.length ? (
            <ul>
              {results.map((entry) => (
                <li key={entry.id}>
                  <div><strong>{entry.title}</strong><span>{entry.detail}</span></div>
                  <Link to={entry.href}>Ouvrir</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun dossier de formation ne correspond. Lancez la recherche complète pour vérifier l’annuaire.</p>
          )}
        </div>
      )}
    </section>
  );
}
