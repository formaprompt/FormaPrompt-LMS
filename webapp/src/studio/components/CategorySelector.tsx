import type {
  StudioCategoryFamilySummary,
  StudioCategoryId,
  StudioCategorySummary,
} from '../types';

interface CategorySelectorProps {
  categories: StudioCategorySummary[];
  families: StudioCategoryFamilySummary[];
  value: StudioCategoryId;
  onChange: (categoryId: StudioCategoryId) => void;
}

export function CategorySelector({ categories, families, value, onChange }: CategorySelectorProps) {
  const availableCount = categories.filter((category) => category.available).length;
  const selectedCategory = categories.find((category) => category.id === value);

  return (
    <div className="studio-category-selector">
      <label htmlFor="studio-category">Cas d’usage</label>
      <p id="studio-category-help">
        {`${availableCount} catégories sont disponibles. Choisissez celle qui correspond au résultat que vous souhaitez préparer.`}
      </p>
      <select
        id="studio-category"
        value={value}
        aria-describedby="studio-category-help"
        onChange={(event) => onChange(event.target.value as StudioCategoryId)}
      >
        {families.map((family) => (
          <optgroup key={family.id} label={family.label}>
            {categories
              .filter((category) => category.family === family.id)
              .map((category) => (
                <option key={category.id} value={category.id} disabled={!category.available}>
                  {`${category.label}${category.available ? '' : ' — prochainement'}`}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {selectedCategory && (
        <p className="studio-category-description" aria-live="polite">
          {selectedCategory.description}
        </p>
      )}
    </div>
  );
}
