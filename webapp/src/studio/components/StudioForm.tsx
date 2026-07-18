import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef } from 'react';
import {
  useForm,
  useWatch,
  type DefaultValues,
  type FieldError,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { CROP_SECTION_LABELS, type CropSection, type StudioCategoryConfig } from '../types';

const SECTION_ORDER: CropSection[] = ['context', 'role', 'objective', 'precisions'];

interface StudioFormProps<TValues extends FieldValues> {
  category: StudioCategoryConfig<TValues>;
  hasResult: boolean;
  onSubmit: (values: TValues) => void;
  onValuesChange: () => void;
}

export function StudioForm<TValues extends FieldValues>({
  category,
  hasResult,
  onSubmit,
  onValuesChange,
}: StudioFormProps<TValues>) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TValues>({
    resolver: zodResolver(category.schema) as Resolver<TValues>,
    defaultValues: category.defaultValues as DefaultValues<TValues>,
    mode: 'onBlur',
    shouldFocusError: true,
  });
  const watchedValues = useWatch({ control });
  const serializedValues = useMemo(() => JSON.stringify(watchedValues), [watchedValues]);
  const previousValuesRef = useRef(serializedValues);

  useEffect(() => {
    if (previousValuesRef.current === serializedValues) return;
    previousValuesRef.current = serializedValues;
    if (hasResult) onValuesChange();
  }, [hasResult, onValuesChange, serializedValues]);

  const submitValues = (values: TValues) => {
    onSubmit(values);
  };

  return (
    <form id="studio-form" className="studio-form" noValidate onSubmit={handleSubmit(submitValues)}>
      <p className="studio-form-introduction">{category.messages.introduction}</p>

      <details className="studio-category-guidance">
        <summary>Voir les informations indispensables</summary>
        <ul>
          {category.requiredInformation.map((information) => (
            <li key={information}>{information}</li>
          ))}
        </ul>
      </details>

      {SECTION_ORDER.map((section) => {
        const sectionFields = category.fields.filter((field) => field.cropSection === section);
        if (sectionFields.length === 0) return null;

        return (
          <fieldset key={section} className={`studio-form-section studio-form-section--${section}`}>
            <legend>{CROP_SECTION_LABELS[section]}</legend>
            <div className="studio-form-fields">
              {sectionFields.map((field) => {
                const fieldId = `studio-${field.name}`;
                const helpId = `${fieldId}-help`;
                const errorId = `${fieldId}-error`;
                const fieldError = (errors as Record<string, FieldError | undefined>)[field.name];
                const describedBy = `${helpId}${fieldError ? ` ${errorId}` : ''}`;
                const registration = register(field.name);

                return (
                  <div key={field.name} className="studio-field">
                    <label htmlFor={fieldId}>
                      {field.label}
                      <span className={field.required ? 'studio-field-status is-required' : 'studio-field-status'}>
                        {field.required ? 'Obligatoire' : 'Facultatif'}
                      </span>
                    </label>
                    <p id={helpId} className="studio-field-help">{field.help}</p>

                    {field.type === 'textarea' && (
                      <textarea
                        id={fieldId}
                        rows={field.rows ?? 3}
                        maxLength={field.maxLength}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={describedBy}
                        {...registration}
                      />
                    )}

                    {field.type === 'text' && (
                      <input
                        id={fieldId}
                        type="text"
                        maxLength={field.maxLength}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={describedBy}
                        {...registration}
                      />
                    )}

                    {field.type === 'select' && (
                      <select
                        id={fieldId}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={describedBy}
                        {...registration}
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}

                    {fieldError?.message && (
                      <p id={errorId} className="studio-field-error" role="alert">
                        {fieldError.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="studio-form-actions">
        <button type="submit" className="btn btn-primary studio-primary-action" disabled={isSubmitting}>
          {hasResult ? 'Recalculer le score et le prompt' : 'Construire mon prompt'}
        </button>
        <p>Aucune saisie n’est enregistrée ou transmise par le Studio.</p>
      </div>
    </form>
  );
}
