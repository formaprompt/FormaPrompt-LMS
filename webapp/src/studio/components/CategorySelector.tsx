import type { StudioCategoryId, StudioCategorySummary } from '../types';

interface CategorySelectorProps {
  categories: StudioCategorySummary[];
  value: StudioCategoryId;
  onChange: (categoryId: StudioCategoryId) => void;
}

export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  return (
    <div className="studio-category-selector">
      <label htmlFor="studio-category">Cas d’usage</label>
      <p id="studio-category-help">
        Une première catégorie est disponible. Les suivantes utiliseront le même moteur modulaire.
      </p>
      <select
        id="studio-category"
        value={value}
        aria-describedby="studio-category-help"
        onChange={(event) => onChange(event.target.value as StudioCategoryId)}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id} disabled={!category.available}>
            {`${category.label}${category.available ? '' : ' — prochainement'}`}
          </option>
        ))}
      </select>
    </div>
  );
}
