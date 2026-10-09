import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import AdvertisingConsent from './AdvertisingConsent';
import { ADVERTISING_COOKIE, getAdvertisingConsent, requestAdvertisingPreferences,
  setAdvertisingConsent } from '../lib/advertisingConsent';
import { AUDIENCE_COOKIE, getAudienceConsent, setAudienceConsent } from '../lib/audienceConsent';

const advertisingCheckbox = () => screen.getByRole('checkbox', { name: 'Mesure publicitaire Google Ads' });
const audienceCheckbox = () => screen.getByRole('checkbox', { name: 'Mesure d’audience Google Analytics' });

afterEach(() => {
  cleanup();
  // Reset the fail-closed in-memory refusals before deleting the test cookies.
  setAdvertisingConsent('granted');
  setAudienceConsent('granted');
  for (const part of document.cookie.split(';')) document.cookie = `${part.trim().split('=')[0]}=; Max-Age=0; Path=/`;
});

describe('AdvertisingConsent', () => {
  it('starts with both choices unchecked despite a legacy technical cookie and permits refusal/reopening', () => {
    document.cookie = 'formaprompt_cookie_consent=true; Path=/';
    render(<AdvertisingConsent />);
    expect(advertisingCheckbox()).not.toBeChecked();
    expect(audienceCheckbox()).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser tout' }));
    expect(getAdvertisingConsent()).toBe('denied');
    expect(getAudienceConsent()).toBe('denied');
    expect(screen.queryByRole('region', { name: 'Vos choix pour les cookies' })).not.toBeInTheDocument();
    act(() => requestAdvertisingPreferences());
    expect(advertisingCheckbox()).not.toBeChecked();
    expect(audienceCheckbox()).not.toBeChecked();
  });

  it('preserves an existing advertising agreement without inferring or saving an audience agreement on opening', () => {
    document.cookie = `${ADVERTISING_COOKIE}=v1.granted; Path=/`;
    render(<AdvertisingConsent />);
    expect(advertisingCheckbox()).toBeChecked();
    expect(audienceCheckbox()).not.toBeChecked();
    expect(getAdvertisingConsent()).toBe('granted');
    expect(getAudienceConsent()).toBe('unknown');
  });

  it.each([
    ['advertising', 'granted', 'denied'],
    ['audience', 'denied', 'granted'],
  ])('saves only the selected %s agreement', (selected, expectedAdvertising, expectedAudience) => {
    render(<AdvertisingConsent />);
    fireEvent.click(selected === 'advertising' ? advertisingCheckbox() : audienceCheckbox());
    expect(getAdvertisingConsent()).toBe('unknown');
    expect(getAudienceConsent()).toBe('unknown');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }));
    expect(getAdvertisingConsent()).toBe(expectedAdvertising);
    expect(getAudienceConsent()).toBe(expectedAudience);
  });

  it('does not reopen automatically only when both versioned preferences exist', () => {
    document.cookie = `${ADVERTISING_COOKIE}=v1.denied; Path=/`;
    document.cookie = `${AUDIENCE_COOKIE}=v1.denied; Path=/`;
    render(<AdvertisingConsent />);
    expect(screen.queryByRole('region', { name: 'Vos choix pour les cookies' })).not.toBeInTheDocument();
  });

  it('withdraws audience agreement without changing advertising agreement', () => {
    setAdvertisingConsent('granted');
    setAudienceConsent('granted');
    render(<AdvertisingConsent />);
    act(() => requestAdvertisingPreferences());
    fireEvent.click(audienceCheckbox());
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }));
    expect(getAdvertisingConsent()).toBe('granted');
    expect(getAudienceConsent()).toBe('denied');
  });

  it('supports keyboard selection and refusal, restoring focus to the preferences opener', async () => {
    const user = userEvent.setup();
    setAdvertisingConsent('denied');
    setAudienceConsent('denied');
    render(<><button onClick={requestAdvertisingPreferences}>Gérer mes cookies</button><AdvertisingConsent /></>);
    const opener = screen.getByRole('button', { name: 'Gérer mes cookies' });
    await user.tab();
    expect(opener).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Vos choix pour les cookies' })).toHaveFocus();
    await user.tab();
    expect(advertisingCheckbox()).toHaveFocus();
    await user.keyboard(' ');
    expect(advertisingCheckbox()).toBeChecked();
    await user.tab();
    expect(audienceCheckbox()).toHaveFocus();
    await user.keyboard(' ');
    expect(audienceCheckbox()).toBeChecked();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Refuser tout' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(getAdvertisingConsent()).toBe('denied');
    expect(getAudienceConsent()).toBe('denied');
    expect(opener).toHaveFocus();
  });
});
