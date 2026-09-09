import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExcelEnrollment from './ExcelEnrollment';
import { excelCourses } from '../data/excelCourses';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'local-user' } }) }));
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: async () => ({ data: null }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }));
afterEach(() => { cleanup(); invoke.mockReset(); });

for (const course of excelCourses) {
  for (const modality of ['inter', 'individuel']) {
    it(`Excel ${course.level} ${modality} ouvre le checkout existant avec la bonne offre`, async () => {
      invoke.mockResolvedValue({ error: { context: { json: async () => ({ checkout_unavailable: true, error: 'Paiement non ouvert.' }) } } });
      render(<MemoryRouter><ExcelEnrollment course={course} /></MemoryRouter>);
      await userEvent.click(screen.getByText(`Tarifs et inscription — ${course.level}`));
      expect(screen.getByText('Inter-entreprises — 690 € / participant')).toBeVisible();
      expect(screen.getByText('Individuel — 990 €')).toBeVisible();
      expect(screen.getByText('Intra-entreprise — 1 590 € / groupe jusqu’à 8 participants')).toBeVisible();
      await userEvent.click(screen.getByRole('radio', { name: modality === 'inter' ? /Inter-entreprises/ : /Individuel/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Voir le tarif et s’inscrire' }));
      const checkout = screen.getByRole('region', { name: `Inscription Excel ${course.level} — ${modality}` });
      const button = await within(checkout).findByRole('button', { name: /Commander et payer/ });
      const recap = within(checkout).getByRole('region', { name: /^Récapitulatif de votre formation Excel/ });
      expect(within(recap).getByText(modality === 'inter' ? 'Inter-entreprises' : 'Individuel', { exact: true })).toBeVisible();
      expect(recap).toHaveTextContent(`Excel ${course.level}`);
      expect(recap).toHaveTextContent('14 heures');
      expect(button).toHaveTextContent(modality === 'inter' ? '690' : '990');
      expect(within(checkout).queryByRole('link', { name: /devis/i })).not.toBeInTheDocument();
      for (const consent of within(checkout).getAllByRole('checkbox')) await userEvent.click(consent);
      await userEvent.click(button);
      expect(invoke).toHaveBeenCalledWith('create-checkout', expect.objectContaining({
        body: expect.objectContaining({ course_id: `excel-${course.id}-${modality}`, promo_code: null }),
      }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Paiement non ouvert.');
      const quote = screen.getByRole('link', { name: 'Demander un devis' });
      expect(quote).toHaveAttribute('href', '/contact');
      expect(quote.closest('.excel-intra')).toHaveTextContent('1 590 €');
    });
  }
}
