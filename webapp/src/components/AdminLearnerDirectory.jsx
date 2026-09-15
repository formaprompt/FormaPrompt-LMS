import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdminLearnerDirectory, LEARNER_DIRECTORY_PAGE_SIZE } from '../lib/adminLearnerDirectoryApi';
import { learnerRecordPath } from '../lib/adminLearnerRecord';
import './AdminLearnerDirectory.css';

export default function AdminLearnerDirectory({ role, renderActions, loadDirectory = fetchAdminLearnerDirectory }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('recherche') || '').trim();
  const [draftSearch, setDraftSearch] = useState(search);
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0;
  const [state, setState] = useState({ status: 'idle', items: [], total: 0, message: '' });
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (role !== 'admin') return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, status: 'loading', message: '' }));
    try {
      const result = await loadDirectory({ search, page });
      if (requestIdRef.current !== requestId) return;
      setState({ status: 'ready', items: result.items, total: result.total, message: '' });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      console.error('Chargement de l’annuaire apprenants impossible :', error);
      setState({ status: 'error', items: [], total: 0, message: 'L’annuaire apprenants est indisponible pour le moment.' });
    }
  }, [loadDirectory, page, role, search]);

  useEffect(() => {
    const task = window.setTimeout(load, 0);
    return () => {
      window.clearTimeout(task);
      requestIdRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const task = window.setTimeout(() => setDraftSearch(search), 0);
    return () => window.clearTimeout(task);
  }, [search]);

  function applySearch(nextSearch) {
    const normalized = String(nextSearch || '').trim();
    setDraftSearch(normalized);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('onglet', 'users');
      if (normalized) next.set('recherche', normalized);
      else next.delete('recherche');
      next.delete('page');
      return next;
    }, { replace: true });
  }

  function goToPage(nextPage) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 0) next.set('page', String(nextPage + 1));
      else next.delete('page');
      return next;
    }, { replace: true });
  }

  if (role !== 'admin') {
    return <section aria-labelledby="learner-directory-title"><h2 id="learner-directory-title">Apprenants</h2><p role="alert">Cet annuaire est réservé aux administrateurs.</p></section>;
  }

  const from = state.total ? page * LEARNER_DIRECTORY_PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * LEARNER_DIRECTORY_PAGE_SIZE, state.total);

  return (
    <section className="learner-directory" aria-labelledby="learner-directory-title">
      <header>
        <div>
          <p className="learner-directory__eyebrow">Administration</p>
          <h2 id="learner-directory-title">Apprenants</h2>
          <p>Recherchez un nom, une adresse e-mail ou une entreprise pour consulter sa fiche.</p>
        </div>
      </header>

      <form className="learner-directory__search" onSubmit={(event) => { event.preventDefault(); applySearch(draftSearch); }} role="search">
        <label htmlFor="learner-directory-search">Rechercher un apprenant</label>
        <div>
          <input id="learner-directory-search" type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Nom, e-mail ou entreprise" maxLength="200" autoFocus />
          <button type="submit" className="btn btn-primary">Rechercher</button>
          {(draftSearch || search) && <button type="button" className="btn" onClick={() => applySearch('')}>Effacer</button>}
        </div>
      </form>

      {state.status === 'loading' && <p role="status">Chargement des apprenants…</p>}
      {state.status === 'error' && <div className="learner-directory__message" role="alert"><p>{state.message}</p><button type="button" className="btn" onClick={load}>Réessayer</button></div>}
      {state.status === 'ready' && (
        <>
          <p className="learner-directory__count" role="status">
            {state.total === 0 ? 'Aucun résultat' : `${from} à ${to} sur ${state.total} compte${state.total > 1 ? 's' : ''}`}{search ? ` pour « ${search} »` : ''}
          </p>
          {state.items.length === 0 ? (
            <div className="learner-directory__message"><p>{search ? 'Aucun apprenant ne correspond à cette recherche.' : 'Aucun apprenant enregistré.'}</p>{search && <button type="button" className="btn" onClick={() => applySearch('')}>Afficher tous les apprenants</button>}</div>
          ) : (
            <ul className="learner-directory__list">
              {state.items.map((learner) => {
                const displayName = learner.fullName || learner.email;
                return (
                  <li key={learner.userId} className="learner-directory__card">
                    <div className="learner-directory__identity">
                      <h3><Link to={learnerRecordPath(learner.userId, search, page)}>{displayName}</Link></h3>
                      {learner.fullName && <p>{learner.email}</p>}
                      <p>{learner.organizationName || 'Entreprise non renseignée'}</p>
                      <span className="learner-directory__role">{learner.role === 'user' ? 'Apprenant' : learner.role === 'admin' ? 'Administrateur' : 'Employé'}</span>
                    </div>
                    {renderActions?.(learner)}
                  </li>
                );
              })}
            </ul>
          )}
          {state.total > LEARNER_DIRECTORY_PAGE_SIZE && (
            <nav className="learner-directory__pagination" aria-label="Pagination des apprenants">
              <button type="button" className="btn" disabled={page === 0} onClick={() => goToPage(Math.max(0, page - 1))}>Page précédente</button>
              <span>Page {page + 1} sur {Math.ceil(state.total / LEARNER_DIRECTORY_PAGE_SIZE)}</span>
              <button type="button" className="btn" disabled={to >= state.total} onClick={() => goToPage(page + 1)}>Page suivante</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
