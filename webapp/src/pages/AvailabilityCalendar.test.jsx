import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AvailabilityCalendar from './AvailabilityCalendar';

const { fromMock, insertMock, invokeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: null }) }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: fromMock, functions: { invoke: invokeMock } },
}));

describe('calendrier public', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 26, 10));
    invokeMock.mockResolvedValue({ data: {
      status: 'available', time_zone: 'Europe/Paris', checked_at: new Date().toISOString(),
      range: { from: '2026-08-31T22:00:00Z', to: '2026-09-30T22:00:00Z' },
      blocks: [{ booking_date: '2026-09-28', slot: 'Matin' }],
    }, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    fromMock.mockReset();
    insertMock.mockReset();
    invokeMock.mockReset();
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
    invokeMock.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    const { container } = render(<AvailabilityCalendar />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des disponibilités');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();

    pending.splice(0).forEach((resolve) => resolve({ data: { status: 'available', time_zone: 'Europe/Paris', checked_at: new Date().toISOString(), range: { from: '2026-08-31T22:00:00Z', to: '2026-09-30T22:00:00Z' }, blocks: [] }, error: null }));
    await waitFor(() => expect(container.querySelector('.calendar-grid')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByRole('heading', { name: 'Octobre 2026' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des disponibilités');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();
  });

  it('expire la lecture au bout de 30 secondes et masque les plages si l’agenda devient inaccessible', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<AvailabilityCalendar />);
    await waitFor(() => expect(container.querySelector('.calendar-grid')).toBeInTheDocument());
    invokeMock.mockResolvedValue({data:null,error:{message:'CALENDAR_UNAVAILABLE'}});
    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(container.querySelector('.calendar-list-slot')).toBeNull();
    expect(container.querySelector('.calendar-grid')).toBeNull();
    log.mockRestore();
  });

  it('réessaie la même intention OF via le serveur avec le même UUID sans écrire en REST', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const available = {status:'available',time_zone:'Europe/Paris',checked_at:new Date().toISOString(),range:{from:'2026-08-31T22:00:00Z',to:'2026-09-30T22:00:00Z'},blocks:[]};
    const attempts = [];
    invokeMock.mockImplementation(async (name, options) => {
      if (name === 'get-unified-availability') return {data:{...available,checked_at:new Date().toISOString()},error:null};
      attempts.push(options.body);
      return attempts.length === 1 ? {data:null,error:{message:'network'}} : {data:{bookings:[{id:'booking',date:'2026-09-28',slot:'Matin'}]},error:null};
    });
    const {container} = render(<AvailabilityCalendar />);
    await waitFor(() => expect(container.querySelector('[aria-label="Choisir matin le 28/09/2026"]')).toBeInTheDocument());
    fireEvent.click(container.querySelector('[aria-label="Choisir matin le 28/09/2026"]'));
    fireEvent.change(screen.getByLabelText("Nom de l'Organisme de Formation (OF) *"),{target:{value:'OF exemple'}});
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(screen.getByRole('button',{name:'Valider'})).toBeEnabled());
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
    await waitFor(() => expect(attempts).toHaveLength(2));
    expect(attempts[0].request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0]).toMatchObject({action:'create',booking:{date:'2026-09-28',slot:'Matin',type:'option'}});
    expect(fromMock).not.toHaveBeenCalled();
    alertMock.mockRestore();
  });

  it.each([
    ['2026-09-30T22:30:00Z', 'Octobre 2026', '2026-10', 1, 1],
    ['2026-10-01T22:30:00Z', 'Octobre 2026', '2026-10', 2, 1],
  ])('utilise le jour Paris à %s pour le mois initial et les jours passés', async (instant, monthLabel, monthKey, today, yesterday) => {
    vi.setSystemTime(new Date(instant));
    invokeMock.mockResolvedValue({data:{status:'available',time_zone:'Europe/Paris',checked_at:instant,range:{from:'2026-09-30T22:00:00Z',to:'2026-10-31T23:00:00Z'},blocks:[]},error:null});
    const {container} = render(<AvailabilityCalendar />);
    await waitFor(() => expect(container.querySelector('.calendar-grid')).toBeInTheDocument());
    expect(screen.getByRole('heading',{name:monthLabel})).toBeVisible();
    expect(invokeMock).toHaveBeenCalledWith('get-unified-availability',{body:{purpose:'public_calendar',month:monthKey}});
    const findDay = day => [...container.querySelectorAll('.calendar-day:not(.empty)')].find(element => element.querySelector('.calendar-date')?.textContent.trim() === String(day));
    expect(findDay(today)).not.toHaveClass('past');
    if (today !== yesterday) {
      expect(findDay(yesterday)).toHaveClass('past');
      fireEvent.click(findDay(yesterday));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(container.querySelector('[aria-label="Choisir matin le 01/10/2026"]')).toBeNull();
    }
  });

  it('signale un échec et ne présente aucun créneau comme libre', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    invokeMock.mockResolvedValue({ data: null, error: { message: 'CALENDAR_UNAVAILABLE' } });
    const { container } = render(<AvailabilityCalendar />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Les disponibilités ne peuvent pas être affichées');
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.calendar-list-slot')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
