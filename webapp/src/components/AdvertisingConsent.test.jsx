import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AdvertisingConsent from './AdvertisingConsent';
import { ADVERTISING_COOKIE, getAdvertisingConsent, requestAdvertisingPreferences } from '../lib/advertisingConsent';

afterEach(() => {
  cleanup();
  for (const part of document.cookie.split(';')) document.cookie = `${part.trim().split('=')[0]}=; Max-Age=0; Path=/`;
});
describe('AdvertisingConsent', () => {
  it('requires new advertising choice despite legacy technical cookie and permits refusal/reopening', () => {
    document.cookie = 'formaprompt_cookie_consent=true; Path=/';
    render(<AdvertisingConsent />);
    expect(screen.getByText('Votre choix pour les cookies publicitaires')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser ou retirer la mesure publicitaire Google Ads' }));
    expect(getAdvertisingConsent()).toBe('denied');
    expect(screen.queryByText('Votre choix pour les cookies publicitaires')).not.toBeInTheDocument();
    act(() => requestAdvertisingPreferences());
    fireEvent.click(screen.getByRole('button', { name: 'Accepter la mesure publicitaire Google Ads' }));
    expect(getAdvertisingConsent()).toBe('granted');
  });
  it('does not reopen automatically when versioned preference exists', () => {
    document.cookie = `${ADVERTISING_COOKIE}=v1.denied; Path=/`;
    render(<AdvertisingConsent />);
    expect(screen.queryByText('Votre choix pour les cookies publicitaires')).not.toBeInTheDocument();
  });
});
