import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { subscribeAudienceConsent } from '../lib/audienceConsent';
import { getPublicAnalyticsPage, isAnalyticsDocumentLoaded, stopAudienceMeasurement,
  updateAnalyticsPage } from '../lib/googleAnalytics';
import { installAnalyticsNavigationBoundary, replaceAnalyticsDocument } from '../lib/analyticsNavigationBoundary';

export default function AnalyticsBoundary({ children }) {
  const location = useLocation();
  const { loading, user } = useAuth();
  const unsafe = !getPublicAnalyticsPage(location.pathname) || Boolean(location.search || location.hash)
    || Boolean(user);
  const mustReplaceDocument = isAnalyticsDocumentLoaded() && unsafe;

  useLayoutEffect(() => installAnalyticsNavigationBoundary({ window, document,
    isLoaded: isAnalyticsDocumentLoaded, isPublicPage: getPublicAnalyticsPage,
    stop: stopAudienceMeasurement }), []);

  useLayoutEffect(() => {
    if (mustReplaceDocument) {
      stopAudienceMeasurement();
      replaceAnalyticsDocument(`${location.pathname}${location.search}${location.hash}`);
      return;
    }
    updateAnalyticsPage(location.pathname, location.key, { loading, user });
  }, [location.pathname, location.search, location.hash, location.key, loading, user, mustReplaceDocument]);

  useEffect(() => subscribeAudienceConsent((choice) => {
    if (choice !== 'granted' && isAnalyticsDocumentLoaded()) {
      stopAudienceMeasurement();
      replaceAnalyticsDocument();
    } else {
      updateAnalyticsPage(location.pathname, location.key, { loading, user });
    }
  }), [location.pathname, location.key, loading, user]);

  // Do not render a private React tree into a document containing the SDK.
  return mustReplaceDocument ? null : children;
}
