import type { StudioPromptPreview } from '../engine/promptPreview';

export function LivePromptPreview({ preview }: { preview: StudioPromptPreview }) {
  return (
    <section className="studio-live-preview" aria-labelledby="studio-live-preview-title">
      <h3 id="studio-live-preview-title">Votre prompt en cours</h3>
      <p>La prévisualisation évolue à mesure que vous complétez le formulaire.</p>
      <pre tabIndex={0} aria-label="Prévisualisation du prompt en cours"><code>{preview.prompt}</code></pre>
      {preview.missingSections.length > 0 && (
        <p className="studio-live-preview-note">
          Les mentions entre crochets signalent uniquement les éléments à compléter. Elles ne seront pas ajoutées au prompt final.
        </p>
      )}
    </section>
  );
}
