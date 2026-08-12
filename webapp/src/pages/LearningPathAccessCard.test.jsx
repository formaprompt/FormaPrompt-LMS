import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import LearningPathAccessCard from '../components/LearningPathAccessCard';
import { learningPathCatalog, DEMO_LEARNING_PATH_SLUG } from '../data/learningPathCatalog';

const course = learningPathCatalog[DEMO_LEARNING_PATH_SLUG];

function renderCard(access, loading = false) {
  return render(
    <MemoryRouter>
      <LearningPathAccessCard
        course={course}
        access={access}
        loading={loading}
      />
    </MemoryRouter>,
  );
}

describe('Carte du parcours payant', () => {
  afterEach(cleanup);

  it('affiche la carte uniquement avec le course_access actif correspondant', () => {
    renderCard({
      course_id: 'formation-prompt-level-1',
      status: 'active',
      expires_at: null,
    });

    expect(screen.getByRole('heading', { name: 'Introduction au Prompt Engineering' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Commencer ou reprendre' })).toHaveAttribute(
      'href',
      '/parcours/introduction-prompt-engineering',
    );
  });

  it.each(['suspended', 'revoked', 'refunded', 'expired'])(
    "n'affiche pas la carte avec un accès %s",
    (status) => {
      renderCard({ course_id: 'formation-prompt-level-1', status, expires_at: null });
      expect(screen.queryByRole('heading', { name: 'Introduction au Prompt Engineering' })).not.toBeInTheDocument();
    },
  );

  it("n'affiche pas la carte si l'accès actif est arrivé à échéance", () => {
    renderCard({
      course_id: 'formation-prompt-level-1',
      status: 'active',
      expires_at: '2020-01-01T00:00:00Z',
    });
    expect(screen.queryByRole('heading', { name: 'Introduction au Prompt Engineering' })).not.toBeInTheDocument();
  });

  it("n'affiche rien avant la fin de la vérification des droits", () => {
    renderCard({ course_id: 'formation-prompt-level-1', status: 'active', expires_at: null }, true);
    expect(screen.queryByRole('link', { name: 'Commencer ou reprendre' })).not.toBeInTheDocument();
  });
});
