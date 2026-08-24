import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CockpitActionList from './CockpitActionList';

describe('CockpitActionList', () => {
  afterEach(cleanup);

  it('rend une demande de retractation directement actionnable sans placeholder', () => {
    render(<MemoryRouter><CockpitActionList actions={[{
      domain: 'commercial', item_id: 'withdrawal-1', item_type: 'withdrawal_request',
      severity: 'high', neutral_label: 'Demande de rétractation à instruire',
      destination_path: '/admin', age_seconds: 86400,
    }]} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Traiter' })).toHaveAttribute('href', '/admin/retractations');
    expect(screen.queryByText(/à venir|bientôt disponible|écran futur|TODO/i)).not.toBeInTheDocument();
  });
});
