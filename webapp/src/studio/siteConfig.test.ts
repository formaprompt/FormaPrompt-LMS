import { describe, expect, it } from 'vitest';
import { SITE_CONFIG } from '../config/site';
import { STUDIO_PRIVACY_COPY } from '../config/studioPrivacy';

describe('coordonnées et confidentialité publiques du Studio', () => {
  it('utilise uniquement le domaine et le courriel publics actuels', () => {
    expect(SITE_CONFIG.domain).toBe('formaprompt.com');
    expect(SITE_CONFIG.baseUrl).toBe('https://formaprompt.com');
    expect(SITE_CONFIG.contactEmail).toBe('thierry@formaprompt.com');
    expect(JSON.stringify(SITE_CONFIG)).not.toContain('formaprompt.fr');
  });

  it('décrit fidèlement le brouillon local et autorise une situation réelle formulée sans donnée sensible', () => {
    const publicCopy = Object.values(STUDIO_PRIVACY_COPY).join(' ');

    expect(publicCopy).toContain('stockage local de ce navigateur');
    expect(publicCopy).toContain('situation professionnelle réelle');
    expect(publicCopy).toContain('termes génériques');
    expect(publicCopy).not.toMatch(/aucune saisie conservée|anonymis/i);
  });
});
