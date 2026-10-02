import { useEffect, useState } from 'react';
import CookieConsent from 'react-cookie-consent';
import { ADVERTISING_COOKIE, ADVERTISING_DAYS, getAdvertisingConsent, setAdvertisingConsent,
  subscribeAdvertisingConsent, subscribeAdvertisingPreferences } from '../lib/advertisingConsent';
import { initGoogleAds } from '../lib/googleAdsPurchase';
import './AdvertisingConsent.css';

export default function AdvertisingConsent() {
  const [visible, setVisible] = useState(() => getAdvertisingConsent() === 'unknown');
  useEffect(() => {
    void initGoogleAds();
    const unsubscribe = subscribeAdvertisingConsent((choice) => {
      setVisible(false);
      if (choice === 'granted') void initGoogleAds();
    });
    const stopPreferences = subscribeAdvertisingPreferences(() => setVisible(true));
    return () => { unsubscribe(); stopPreferences(); };
  }, []);
  return (
    <CookieConsent visible={visible ? 'show' : 'hidden'} cookieName={ADVERTISING_COOKIE}
      cookieValue="v1.granted" declineCookieValue="v1.denied" expires={ADVERTISING_DAYS}
      enableDeclineButton buttonText="Accepter la mesure publicitaire" declineButtonText="Refuser"
      onAccept={() => setAdvertisingConsent('granted')} onDecline={() => setAdvertisingConsent('denied')}
      disableStyles containerClasses="advertising-consent" contentClasses="advertising-consent__content"
      buttonWrapperClasses="advertising-consent__actions" buttonClasses="advertising-consent__button"
      declineButtonClasses="advertising-consent__button" ariaAcceptLabel="Accepter la mesure publicitaire Google Ads"
      ariaDeclineLabel="Refuser ou retirer la mesure publicitaire Google Ads">
      <strong>Votre choix pour les cookies publicitaires</strong>
      <p>Avec votre accord, Google Ads mesure les achats réalisés après nos annonces. Aucune personnalisation
        publicitaire ni mesure d'audience n'est activée. Refuser permet de continuer à utiliser le site.
        Vous pouvez retirer votre accord via « Gérer mes cookies » en bas de page. Le choix est conservé 150 jours.</p>
      <p>Si la mesure a déjà été chargée, le retrait recharge cette page pour l'arrêter, sans effacer votre connexion.</p>
      <a href="/politique-confidentialite">En savoir plus sur les données utilisées</a>
    </CookieConsent>
  );
}
