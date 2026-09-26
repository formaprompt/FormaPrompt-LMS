import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AvailabilityCalendar from './AvailabilityCalendar';

const { fromMock, insertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: null }) }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: fromMock },
}));

describe('calendrier public', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 26, 10));
    fromMock.mockImplementation((table) => ({
      select: () => ({
        gte: () => ({
          lte: async () => ({
            data: table === 'calendar_bookings'
              ? [{ id: 1, date: '2026-09-28', slot: 'Matin', type: 'option', of_name: 'Organisme privé' }]
              : [],
            error: null,
          }),
        }),
      }),
      insert: insertMock,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    fromMock.mockReset();
    insertMock.mockReset();
  });

  it('présente les créneaux libres et préselectionne celui choisi sans réserver', async () => {
    const { container } = render(<AvailabilityCalendar />);

    await waitFor(() => expect(screen.queryByText('Chargement des disponibilités…')).not.toBeInTheDocument());
    expect(screen.getByText('Prochains créneaux disponibles')).toBeInTheDocument();
    expect(screen.getByText('Cette semaine')).toBeInTheDocument();
    expect(screen.getByText('Ce mois-ci')).toBeInTheDocument();
    expect(screen.getByText('Option en attente')).toBeInTheDocument();
    expect(screen.getByText('Réservé')).toBeInTheDocument();

    expect(container.querySelector('[aria-label="Choisir matin le 28/09/2026"]')).not.toBeInTheDocument();
    const slotButton = container.querySelector('[aria-label="Choisir après-midi le 28/09/2026"]');
    fireEvent.click(slotButton);
    expect(screen.getByRole('dialog', { name: 'Demander une réservation' })).toBeInTheDocument();
    expect(screen.getByLabelText("Nom de l'Organisme de Formation (OF) *")).toHaveFocus();
    expect(screen.getByLabelText('Créneau *')).toHaveValue('Après-midi');
    expect(screen.getByLabelText('Type de réservation *')).toHaveValue('option');
    expect(screen.getByLabelText('Commentaires / Sujet de formation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(slotButton).toHaveFocus();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('masque les créneaux tant que le mois affiché charge, y compris après navigation', async () => {
    const pending = [];
    fromMock.mockImplementation(() => ({
      select: () => ({
        gte: () => ({
          lte: () => new Promise((resolve) => pending.push(resolve)),
        }),
      }),
    }));
    const { container } = render(<AvailabilityCalendar />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des disponibilités');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();

    pending.splice(0).forEach((resolve) => resolve({ data: [], error: null }));
    await waitFor(() => expect(container.querySelector('.calendar-grid')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByRole('heading', { name: 'Octobre 2026' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des disponibilités');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();
  });

  it('signale un échec et ne présente aucun créneau comme libre', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fromMock.mockImplementation(() => ({
      select: () => ({
        gte: () => ({
          lte: async () => ({ data: null, error: { message: 'Service indisponible' } }),
        }),
      }),
    }));
    const { container } = render(<AvailabilityCalendar />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Les disponibilités ne peuvent pas être affichées');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
