import { HelmetProvider } from 'react-helmet-async';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudioPage from './StudioPage';

const clipboardWrite = vi.fn<(text: string) => Promise<void>>();

function renderStudio() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <StudioPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('parcours principal du Studio', () => {
  beforeEach(() => {
    clipboardWrite.mockReset();
    clipboardWrite.mockResolvedValue(undefined);
  });

  it('construit, diagnostique, améliore puis copie un prompt de courriel', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    renderStudio();

    expect(screen.getByRole('heading', { level: 1, name: /Construisez un prompt clair/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cas d’usage' })).toHaveValue('professional-email');
    expect(
      screen.getByRole('note', {
        name: 'Avertissement sur les informations sensibles',
      }),
    ).toHaveTextContent('Ne saisissez aucune donnée personnelle');

    await user.type(
      screen.getByLabelText(/^Décrivez votre besoin/),
      'Préparer un rappel avant une classe virtuelle organisée la semaine prochaine.',
    );
    await user.type(
      screen.getByLabelText(/^À qui s’adresse le courriel \?/),
      'participants adultes inscrits à distance',
    );
    await user.type(
      screen.getByLabelText(/^Objectif du courriel/),
      'Rappeler les modalités pratiques et demander une confirmation de présence.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    const resultTitle = await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' });
    expect(resultTitle).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Contexte');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Rôle');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Précisions');

    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(initialScore).toBeGreaterThan(0);
    expect(screen.getAllByText('Éléments manquants')).toHaveLength(4);

    await user.type(
      screen.getByLabelText(/^Informations utiles et autorisées/),
      'La séance fictive débute à 9 h et le lien est disponible dans la convocation générique.',
    );
    expect(screen.getByText(/Vous avez modifié un champ/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/^Critères de réussite/),
      'Le courriel reste inférieur à 180 mots et la demande de confirmation est explicite.',
    );
    await user.type(
      screen.getByLabelText(/^Éléments obligatoires/),
      'Objet, date fictive, heure, matériel conseillé et confirmation attendue.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Phrases courtes, aucun jargon, aucune donnée personnelle et aucune information inventée.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
    expect(screen.queryByText(/Vous avez modifié un champ/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copier le prompt' }));
    expect(clipboardWrite).toHaveBeenCalledOnce();
    expect(await screen.findByText('Le prompt a été copié dans le presse-papiers.')).toBeInTheDocument();
  });
});
