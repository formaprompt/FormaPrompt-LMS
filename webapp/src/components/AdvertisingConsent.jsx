import { useEffect, useRef, useState } from 'react';
import { getAdvertisingConsent, setAdvertisingConsent,
  subscribeAdvertisingConsent, subscribeAdvertisingPreferences } from '../lib/advertisingConsent';
import { getAudienceConsent, setAudienceConsent, subscribeAudienceConsent } from '../lib/audienceConsent';
import { initGoogleAds } from '../lib/googleAdsPurchase';
import './AdvertisingConsent.css';

export default function AdvertisingConsent() {
  const [visible, setVisible] = useState(() =>
    getAdvertisingConsent() === 'unknown' || getAudienceConsent() === 'unknown');
  const [advertising, setAdvertising] = useState(() => getAdvertisingConsent() === 'granted');
  const [audience, setAudience] = useState(() => getAudienceConsent() === 'granted');
  const heading = useRef(null);
  const opener = useRef(null);
  const focusOnOpen = useRef(false);

  useEffect(() => {
    void initGoogleAds();
    const stopAdvertising = subscribeAdvertisingConsent((choice) => {
      setAdvertising(choice === 'granted');
      if (choice === 'granted') void initGoogleAds();
    });
    const stopAudience = subscribeAudienceConsent((choice) => setAudience(choice === 'granted'));
    const stopPreferences = subscribeAdvertisingPreferences(() => {
      opener.current = document.activeElement;
      focusOnOpen.current = true;
      setAdvertising(getAdvertisingConsent() === 'granted');
      setAudience(getAudienceConsent() === 'granted');
      setVisible(true);
      // Also handle a request while the preferences are already visible.
      heading.current?.focus();
    });
    return () => { stopAdvertising(); stopAudience(); stopPreferences(); };
  }, []);

  useEffect(() => {
    if (visible && focusOnOpen.current) {
      heading.current?.focus();
      focusOnOpen.current = false;
    }
  }, [visible]);

  function saveChoices(allowAdvertising, allowAudience) {
    setVisible(false);
    // Persist both choices before the audience subscriber handles any reload.
    setAdvertisingConsent(allowAdvertising ? 'granted' : 'denied');
    setAudienceConsent(allowAudience ? 'granted' : 'denied');
    if (opener.current?.isConnected) opener.current.focus();
  }

  if (!visible) return null;
  return (
    <section className="advertising-consent" aria-labelledby="cookie-preferences-title">
      <div className="advertising-consent__content">
        <h2 id="cookie-preferences-title" ref={heading} tabIndex={-1}>Vos choix pour les cookies</h2>
        <p>Choisissez séparément les mesures que vous autorisez. Refuser permet de continuer
          à naviguer, à vous connecter et à acheter.</p>
        <fieldset className="advertising-consent__choices">
          <legend>Mesures facultatives</legend>
          <label className="advertising-consent__choice">
            <input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)}
              aria-describedby="cookie-advertising-description" />
            <span>Mesure publicitaire Google Ads</span>
          </label>
          <p id="cookie-advertising-description">Relier les achats confirmés aux annonces FormaPrompt,
            sans personnalisation publicitaire.</p>
          <label className="advertising-consent__choice">
            <input type="checkbox" checked={audience} onChange={(event) => setAudience(event.target.checked)}
              aria-describedby="cookie-audience-description" />
            <span>Mesure d’audience Google Analytics</span>
          </label>
          <p id="cookie-audience-description">Lorsqu’elle est activée après votre accord, comprendre
            la consultation des pages publiques. Les espaces de connexion, de compte et de formation
            ainsi que les pages de paiement sont exclus.</p>
        </fieldset>
        <p>Vous pouvez modifier ces choix ou retirer votre accord via « Gérer mes cookies » en bas de page,
          sans effacer votre connexion. Le choix publicitaire est conservé 150 jours.
          Le choix d’audience est également conservé 150 jours ; les cookies Analytics durent uniquement la session.</p>
        <a href="/politique-confidentialite">En savoir plus sur les données utilisées</a>
      </div>
      <div className="advertising-consent__actions">
        <button type="button" className="advertising-consent__button" onClick={() => saveChoices(false, false)}>
          Refuser tout
        </button>
        <button type="button" className="advertising-consent__button" onClick={() => saveChoices(advertising, audience)}>
          Enregistrer mes choix
        </button>
      </div>
    </section>
  );
}
