import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_ONBOARDING_CONFIG, hasSeenOnboardingVideo, loadLearnerOnboardingConfig } from '../lib/learnerOnboarding';

export default function useLearnerOnboarding(userId) {
  const location = useLocation();
  const [state, setState] = useState({ config: DEFAULT_ONBOARDING_CONFIG, loading: true, owner: null });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    loadLearnerOnboardingConfig({ signal: controller.signal }).then((config) => {
      if (active) setState({ config, loading: false, owner: userId });
    }).catch(() => {
      if (active) setState({ config: DEFAULT_ONBOARDING_CONFIG, loading: false, owner: userId });
    });
    return () => { active = false; controller.abort(); };
  }, [userId, location.key]);
  const current = state.owner === userId;
  const config = current ? state.config : DEFAULT_ONBOARDING_CONFIG;
  return {
    config,
    loading: !current || state.loading,
    seen: current && hasSeenOnboardingVideo(userId, config.version),
  };
}
