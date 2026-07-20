import { ClipboardCheck } from 'lucide-react';
import type { StudioPublicExample } from '../landingContent';

export function EducationalContent({ examples }: { examples: StudioPublicExample[] }) {
  return (
    <div className="studio-educational-examples">
      {examples.map((example, index) => (
        <details key={example.family} open={index === 0}>
          <summary>{example.familyLabel}</summary>
          <article>
            <ClipboardCheck aria-hidden="true" />
            <div>
              <h3>{example.title}</h3>
              <p>{example.description}</p>
              <pre><code>{example.prompt}</code></pre>
            </div>
          </article>
        </details>
      ))}
    </div>
  );
}
