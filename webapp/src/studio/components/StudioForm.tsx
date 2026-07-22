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
import type { StudioPromptExample } from '../types';
import { ContextualHelp } from './ContextualHelp';
import { PromptExamples } from './PromptExamples';
import { STUDIO_PRIVACY_COPY } from '../../config/studioPrivacy';

const SECTION_ORDER: CropSection[] = ['context', 'role', 'objective', 'precisions'];

interface StudioFormProps<TValues extends FieldValues> {
  category: StudioCategoryConfig<TValues>;
  examples: StudioPromptExample[];
  initialValues?: Partial<TValues>;
  hasResult: boolean;
  focusOnMount?: boolean;
  onFocusComplete?: () => void;
  onSubmit: (values: TValues) => void;
  onValuesChange: (values: TValues) => void;
  onValuesCommit: (values: TValues) => void;
}

const SECTION_CONTENT: Record<CropSection, { title: string; help: string }> = {
  context: {
    title: 'Dans quelle situation cette demande s’inscrit-elle ?',
    help: 'Indiquez la situation, le public concerné et les informations nécessaires pour éviter une réponse trop générale.',
  },
  role: {
    title: 'Quel rôle l’IA doit-elle adopter ?',
    help: 'Précisez l’expertise, la fonction ou le point de vue que l’IA doit utiliser pour vous répondre.',
  },
  objective: {
    title: 'Quel résultat précis souhaitez-vous obtenir ?',
    help: 'Décrivez le livrable attendu et ce que la réponse doit vous permettre de faire.',
  },
  precisions: {
    title: 'Quelles consignes et contraintes faut-il respecter ?',
    help: 'Ajoutez le ton, le format, la longueur, les informations obligatoires et les éléments à éviter.',
  },
};

function getHelpfulErrorMessage(message: string, section: CropSection) {
  if (!/invalid|required|validation|incorrect/i.test(message)) return message;
  if (section === 'context') return 'Ajoutez quelques informations sur la situation et le public concerné.';
  if (section === 'objective') return 'Décrivez plus précisément le résultat que vous souhaitez obtenir.';
  if (section === 'precisions') return 'Indiquez au moins une contrainte ou un format attendu.';
  return 'Ce champ est nécessaire pour construire un prompt suffisamment précis.';
}

export function StudioForm<TValues extends FieldValues>({
  category,
  examples,
  initialValues,
  hasResult,
  focusOnMount = false,
  onFocusComplete,
  onSubmit,
  onValuesChange,
  onValuesCommit,
}: StudioFormProps<TValues>) {
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TValues>({
    resolver: zodResolver(category.schema) as Resolver<TValues>,
    defaultValues: { ...category.defaultValues, ...initialValues } as DefaultValues<TValues>,
    mode: 'onBlur',
    shouldFocusError: true,
  });

  useEffect(() => {
    if (!focusOnMount) return;
    document.getElementById('studio-form-start')?.focus({ preventScroll: true });
    window.requestAnimationFrame(() => {
      document.getElementById('studio-form')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    onFocusComplete?.();
  }, [focusOnMount, onFocusComplete]);
  const watchedValues = useWatch({ control });
  const serializedValues = useMemo(() => JSON.stringify(watchedValues), [watchedValues]);
  const previousValuesRef = useRef(serializedValues);

  useEffect(() => {
    if (previousValuesRef.current === serializedValues) return;
    previousValuesRef.current = serializedValues;
    onValuesChange(watchedValues as TValues);
  }, [onValuesChange, serializedValues, watchedValues]);

  const hasExampleConflict = (example: StudioPromptExample) => {
    const currentValues = getValues() as Record<string, unknown>;
    const defaultValues = category.defaultValues as Record<string, unknown>;
    return Object.keys(example.values).some((fieldName) => {
      const currentValue = currentValues[fieldName];
      return typeof currentValue === 'string'
        && currentValue.trim().length > 0
        && currentValue !== defaultValues[fieldName];
    });
  };

  const applyExample = (example: StudioPromptExample, mode: 'replace' | 'fill-empty') => {
    const fieldNames = new Set(category.fields.map((field) => field.name as string));
    const entries = Object.entries(example.values).filter(([fieldName]) => fieldNames.has(fieldName));
    const nextValues = { ...(getValues() as Record<string, unknown>) };
    entries.forEach(([fieldName, value]) => {
      const currentValue = nextValues[fieldName];
      if (mode === 'fill-empty' && typeof currentValue === 'string' && currentValue.trim().length > 0) return;
      setValue(fieldName as never, value as never, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      nextValues[fieldName] = value;
    });
    const firstFieldName = entries[0]?.[0];
    if (firstFieldName) setFocus(firstFieldName as never);
    onValuesCommit(nextValues as TValues);
  };

  const submitValues = (values: TValues) => {
    onSubmit(values);
  };

  return (
    <form id="studio-form" className="studio-form" noValidate onSubmit={handleSubmit(submitValues)}>
      <div id="studio-form-start" className="studio-form-start" tabIndex={-1}>
        <p className="studio-eyebrow">Votre demande</p>
        <h3>{category.label}</h3>
      </div>
      <p className="studio-form-introduction">{category.messages.introduction}</p>

      <PromptExamples examples={examples} hasConflict={hasExampleConflict} onApply={applyExample} />

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
            <legend>
              <span>{CROP_SECTION_LABELS[section]}</span>
              <strong>{SECTION_CONTENT[section].title}</strong>
              <small>{SECTION_CONTENT[section].help}</small>
            </legend>
            <ContextualHelp section={section} />
            <div className="studio-form-fields">
              {sectionFields.map((field) => {
                const fieldId = `studio-${field.name}`;
                const helpId = `${fieldId}-help`;
                const errorId = `${fieldId}-error`;
                const fieldError = (errors as Record<string, FieldError | undefined>)[field.name];
                const describedBy = `${helpId}${fieldError ? ` ${errorId}` : ''}`;
                const registration = register(field.name);
                const fieldValue = (watchedValues as Record<string, unknown> | undefined)?.[field.name];
                const fieldIsComplete = !fieldError && typeof fieldValue === 'string' && fieldValue.trim().length > 0;

                return (
                  <div key={field.name} className={`studio-field${fieldIsComplete ? ' is-complete' : ''}`}>
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
                        aria-errormessage={fieldError ? errorId : undefined}
                        {...registration}
                        onBlur={(event) => {
                          void registration.onBlur(event);
                          onValuesCommit(getValues());
                        }}
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
                        aria-errormessage={fieldError ? errorId : undefined}
                        {...registration}
                        onBlur={(event) => {
                          void registration.onBlur(event);
                          onValuesCommit(getValues());
                        }}
                      />
                    )}

                    {field.type === 'select' && (
                      <select
                        id={fieldId}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={describedBy}
                        aria-errormessage={fieldError ? errorId : undefined}
                        {...registration}
                        onBlur={(event) => {
                          void registration.onBlur(event);
                          onValuesCommit(getValues());
                        }}
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}

                    {fieldError?.message && (
                      <p id={errorId} className="studio-field-error" role="alert">
                        {getHelpfulErrorMessage(fieldError.message, section)}
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
        <p>{STUDIO_PRIVACY_COPY.form} Le brouillon reste uniquement dans ce navigateur.</p>
      </div>
    </form>
  );
}
