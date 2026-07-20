import { Check, Search, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  StudioCategoryFamilyId,
  StudioCategoryFamilySummary,
  StudioCategoryId,
  StudioCategorySummary,
} from '../types';

interface CategorySelectorProps {
  categories: StudioCategorySummary[];
  families: StudioCategoryFamilySummary[];
  value: StudioCategoryId | null;
  initialFamily: StudioCategoryFamilyId | null;
  onChange: (categoryId: StudioCategoryId, family: StudioCategoryFamilyId | null) => void;
  onFamilyChange: (family: StudioCategoryFamilyId | null) => void;
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim();
}

export function CategorySelector({
  categories,
  families,
  value,
  initialFamily,
  onChange,
  onFamilyChange,
}: CategorySelectorProps) {
  const [isExpanded, setIsExpanded] = useState(!value);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedCategory = categories.find((category) => category.id === value);
  const normalizedQuery = normalizeSearch(searchQuery);

  const filteredCategories = useMemo(() => categories.filter((category) => {
    if (!normalizedQuery && initialFamily && category.family !== initialFamily) return false;
    if (!normalizedQuery) return true;

    const family = families.find((item) => item.id === category.family)?.label ?? '';
    const searchableContent = [
      category.label,
      category.description,
      family,
      ...category.keywords,
      ...category.examples.map((example) => example.title),
    ].join(' ');
    return normalizeSearch(searchableContent).includes(normalizedQuery);
  }), [categories, families, initialFamily, normalizedQuery]);

  const selectFamily = (family: StudioCategoryFamilyId | null) => {
    onFamilyChange(family);
  };

  const selectCategory = (category: StudioCategorySummary) => {
    onChange(category.id, initialFamily);
    setIsExpanded(false);
  };

  if (!isExpanded && selectedCategory) {
    const SelectedIcon = selectedCategory.icon;
    return (
      <section className="studio-selected-category" aria-label="Cas d’usage sélectionné">
        <div>
          <span className="studio-selected-category-icon"><SelectedIcon aria-hidden="true" /></span>
          <div>
            <p>Cas d’usage sélectionné</p>
            <h3><Check aria-hidden="true" /> {selectedCategory.label}</h3>
            <span>{selectedCategory.description}</span>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setIsExpanded(true)}>
          Changer de cas d’usage
        </button>
      </section>
    );
  }

  return (
    <section className="studio-category-selector" aria-labelledby="studio-category-title">
      <div className="studio-category-heading">
        <div>
          <p className="studio-eyebrow">Première étape</p>
          <h3 id="studio-category-title">Que souhaitez-vous préparer ?</h3>
          <p>Choisissez un cas d’usage. Le Studio adaptera les questions pour vous aider à construire un prompt précis et exploitable.</p>
        </div>
        {value && (
          <button type="button" className="studio-close-selector" onClick={() => setIsExpanded(false)}>
            <X aria-hidden="true" /> Fermer le sélecteur
          </button>
        )}
      </div>

      <div className="studio-use-case-search">
        <label htmlFor="studio-use-case-search">Rechercher un cas d’usage</label>
        <div>
          <Search aria-hidden="true" />
          <input
            id="studio-use-case-search"
            type="search"
            value={searchQuery}
            placeholder="Ex. rapport, LinkedIn, Excel, PowerPoint, image..."
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Effacer la recherche">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {!normalizedQuery && (
        <section className="studio-popular-categories" aria-labelledby="studio-popular-title">
          <h4 id="studio-popular-title"><Star aria-hidden="true" /> Les plus utilisés</h4>
          <div>
            {categories.filter((category) => category.popular).map((category) => (
              <button key={category.id} type="button" onClick={() => selectCategory(category)}>
                {category.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!normalizedQuery && (
        <div className="studio-family-filter" role="group" aria-label="Filtrer les cas d’usage par famille">
          <button type="button" aria-pressed={initialFamily === null} onClick={() => selectFamily(null)}>
            Toutes les catégories
          </button>
          {families.map((family) => (
            <button
              key={family.id}
              type="button"
              aria-pressed={initialFamily === family.id}
              onClick={() => selectFamily(family.id)}
            >
              {family.label}
            </button>
          ))}
        </div>
      )}

      <p className="studio-search-count" aria-live="polite">
        {`${filteredCategories.length} cas d’usage ${filteredCategories.length > 1 ? 'affichés' : 'affiché'}`}
      </p>

      {filteredCategories.length > 0 ? (
        <div className="studio-category-grid">
          {filteredCategories.map((category) => {
            const Icon = category.icon;
            const isSelected = category.id === value;
            return (
              <button
                key={category.id}
                type="button"
                className={`studio-category-card${isSelected ? ' is-selected' : ''}`}
                aria-label={category.label}
                aria-pressed={isSelected}
                onClick={() => selectCategory(category)}
              >
                <span className="studio-category-card-icon"><Icon aria-hidden="true" /></span>
                <span className="studio-category-card-content">
                  <strong>{category.label}</strong>
                  <span>{category.description}</span>
                </span>
                {isSelected && <span className="studio-category-card-selected"><Check aria-hidden="true" /> Sélectionné</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="studio-no-results" role="status">
          <Search aria-hidden="true" />
          <p>Aucun cas d’usage ne correspond à votre recherche. Essayez un terme plus général.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setSearchQuery('')}>Effacer la recherche</button>
        </div>
      )}
    </section>
  );
}
