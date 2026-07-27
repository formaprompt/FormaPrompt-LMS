import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';

const { insertMock, fromMock } = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    insertMock: insert,
    fromMock: vi.fn(() => ({ insert })),
  };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

function renderContact() {
  return render(
    <MemoryRouter initialEntries={['/contact']}>
      <Contact />
    </MemoryRouter>,
  );
}

describe('formulaire de contact', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    insertMock.mockReset();
    fromMock.mockClear();
    insertMock.mockResolvedValue({ error: null });
  });

  it('explique les corrections avant tout appel réseau', async () => {
    const user = userEvent.setup();
    renderContact();

    await user.type(screen.getByLabelText(/nom ou organisme/i), 'A');
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'adresse incorrecte');
    await user.type(screen.getByLabelText(/message/i), 'essai');
    await user.click(screen.getByRole('button', { name: /envoyer ma demande/i }));

    expect(await screen.findByText(/2 caractères minimum/i)).toBeVisible();
    expect(screen.getByText(/adresse e-mail valide/i)).toBeVisible();
    expect(screen.getByText(/au moins 10 caractères/i)).toBeVisible();
    expect(insertMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText(/nom ou organisme/i)).toHaveFocus());
  });

  it('transmet des données normalisées et confirme la réussite', async () => {
    const user = userEvent.setup();
    renderContact();

    await user.type(screen.getByLabelText(/nom ou organisme/i), '  Organisme Exemple  ');
    await user.type(screen.getByLabelText(/adresse e-mail/i), ' contact@example.com ');
    await user.selectOptions(screen.getByLabelText(/sujet de votre demande/i), 'Autre question');
    await user.type(
      screen.getByLabelText(/message/i),
      '  Je souhaite obtenir des informations sur une formation.  ',
    );
    await user.click(screen.getByRole('button', { name: /envoyer ma demande/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith([
        {
          name: 'Organisme Exemple',
          email: 'contact@example.com',
          subject: 'Autre question',
          message: 'Je souhaite obtenir des informations sur une formation.',
          status: 'pending',
        },
      ]);
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Votre demande a bien été transmise',
    );
  });

  it('conserve les informations et propose le courriel direct en cas d’échec', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    insertMock.mockResolvedValueOnce({ error: { message: 'Réseau indisponible' } });
    renderContact();

    await user.type(screen.getByLabelText(/nom ou organisme/i), 'Organisme Exemple');
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'contact@example.com');
    await user.type(
      screen.getByLabelText(/message/i),
      'Je souhaite recevoir des informations complémentaires.',
    );
    await user.click(screen.getByRole('button', { name: /envoyer ma demande/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Votre demande n’a pas pu être envoyée');
    expect(screen.getByLabelText(/message/i)).toHaveValue(
      'Je souhaite recevoir des informations complémentaires.',
    );
    expect(
      screen.getByRole('link', { name: 'thierry@formaprompt.com' }),
    ).toHaveAttribute('href', 'mailto:thierry@formaprompt.com');

    consoleError.mockRestore();
  });
});
