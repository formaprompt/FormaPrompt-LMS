import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { getAdvertisingConsent, subscribeAdvertisingConsent } from '../lib/advertisingConsent';
import { isGoogleAdsPurchaseEnabled, sendGoogleAdsPurchase } from '../lib/googleAdsPurchase';
import { isLiveCheckoutSessionId, validatePurchaseConversionReceipt } from '../lib/purchaseConversionReceipt';

const MAX_ATTEMPTS = 10;
const POLL_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 5000;
const getServerConsent = () => 'unknown';

// Use only on payment confirmation routes; this has no effect on access or payment UI.
export function useGoogleAdsPurchase(sessionId) {
  const { user, loading } = useAuth();
  const userId = user?.is_anonymous ? null : user?.id;
  const consent = useSyncExternalStore(subscribeAdvertisingConsent, getAdvertisingConsent, getServerConsent);

  useEffect(() => {
    if (loading || !userId || consent !== 'granted'
      || !isLiveCheckoutSessionId(sessionId) || !isGoogleAdsPurchaseEnabled()) return undefined;

    let stopped = false;
    let attempts = 0;
    let timer;
    let timeout;
    let controller;

    async function checkReceipt() {
      if (stopped || getAdvertisingConsent() !== 'granted' || !isGoogleAdsPurchaseEnabled()) return;
      attempts += 1;
      controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const { data, error } = await supabase.functions.invoke('get-purchase-conversion-receipt', {
          body: { session_id: sessionId },
          signal: controller.signal,
        });
        window.clearTimeout(timeout);
        if (stopped || controller.signal.aborted || getAdvertisingConsent() !== 'granted'
          || !isGoogleAdsPurchaseEnabled() || error) return;
        const receipt = validatePurchaseConversionReceipt(data?.receipt);
        if (receipt) {
          await sendGoogleAdsPurchase(receipt);
          return;
        }
        // Retry only an explicit pending response; malformed receipts fail closed.
        if (data?.receipt === null && attempts < MAX_ATTEMPTS) {
          timer = window.setTimeout(checkReceipt, POLL_DELAY_MS);
        }
      } catch {
        // Advertising failures must not interrupt the learner's purchase confirmation.
      } finally {
        window.clearTimeout(timeout);
      }
    }

    // Deferral lets StrictMode cancel its first setup before any network request.
    timer = window.setTimeout(checkReceipt, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      controller?.abort();
    };
  }, [loading, userId, sessionId, consent]);
}
