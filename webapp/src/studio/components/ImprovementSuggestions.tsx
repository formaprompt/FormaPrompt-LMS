import { ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import type { StudioImprovementSuggestion } from '../types';

interface ImprovementSuggestionsProps {
  suggestions: StudioImprovementSuggestion[];
  onFocusField: (fieldName: string) => void;
}

export function ImprovementSuggestions({ suggestions, onFocusField }: ImprovementSuggestionsProps) {
  return (
    <section className="studio-live-suggestions" aria-labelledby="studio-live-suggestions-title">
      <h3 id="studio-live-suggestions-title">Améliorations prioritaires</h3>
      {suggestions.length === 0 ? (
        <p className="studio-positive-suggestion">
          <CheckCircle2 aria-hidden="true" /> Votre prompt est bien structuré. Relisez les informations avant de le copier.
        </p>
      ) : (
        <ol>
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <p>{suggestion.message}</p>
              <button type="button" onClick={() => onFocusField(suggestion.fieldName)}>
                <ArrowDownToLine aria-hidden="true" /> Compléter ce point
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
