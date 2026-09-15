import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import OfficeResources from './OfficeResources';

const mocks = vi.hoisted(() => ({
  fetchOfficeResources: vi.fn(),
}));

vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/paidCourseContent', () => ({
  fetchOfficeResources: mocks.fetchOfficeResources,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

function CourseSwitcher() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/course/office-supports/word-perfectionnement')}>Word Perfectionnement</button>
      <button type="button" onClick={() => navigate('/course/office-supports/powerpoint-initiation')}>PowerPoint Initiation</button>
    </>
  );
}

it('conserve le droit commercial exact tout en affichant le pack pédagogique canonique', async () => {
  mocks.fetchOfficeResources.mockResolvedValueOnce([{
    title: 'Pack apprenant Word Initiation',
    description: 'Exercices protégés.',
    href: 'https://signed.invalid/word-initiation',
    download: 'word-initiation.zip',
  }]);

  render(
    <MemoryRouter initialEntries={['/course/office-supports/word-initiation-individuel']}>
      <Routes>
        <Route path="course/office-supports/:courseId" element={<OfficeResources />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Supports Word Initiation' })).toBeVisible();
  expect(mocks.fetchOfficeResources).toHaveBeenCalledWith(expect.anything(), 'word-initiation-individuel');
  expect(screen.getByText('Pack apprenant Word Initiation')).toBeVisible();
});

it('efface le pack et l erreur précédents pendant chaque nouveau contrôle d accès', async () => {
  const firstRequest = deferred();
  const secondRequest = deferred();
  const thirdRequest = deferred();
  mocks.fetchOfficeResources
    .mockReturnValueOnce(firstRequest.promise)
    .mockReturnValueOnce(secondRequest.promise)
    .mockReturnValueOnce(thirdRequest.promise);

  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/course/office-supports/word-initiation']}>
      <CourseSwitcher />
      <Routes>
        <Route path="course/office-supports/:courseId" element={<OfficeResources />} />
      </Routes>
    </MemoryRouter>,
  );

  firstRequest.resolve([{
    title: 'Pack apprenant Word Initiation',
    description: 'Exercices protégés.',
    href: 'https://signed.invalid/word-initiation',
    download: 'word-initiation.zip',
  }]);
  expect(await screen.findByText('Pack apprenant Word Initiation')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Word Perfectionnement' }));
  expect(screen.getByRole('status')).toHaveTextContent('Vérification de votre accès');
  expect(screen.queryByText('Pack apprenant Word Initiation')).not.toBeInTheDocument();

  secondRequest.reject(new Error('Accès à la formation refusé.'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès à la formation refusé.');

  await user.click(screen.getByRole('button', { name: 'PowerPoint Initiation' }));
  expect(screen.getByRole('status')).toHaveTextContent('Vérification de votre accès');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  thirdRequest.resolve([]);
  await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});
