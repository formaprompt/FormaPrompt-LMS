import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStudioDraft,
  loadStudioDraft,
  saveStudioDraft,
  STUDIO_DRAFT_KEY,
  STUDIO_DRAFT_VERSION,
  type StudioDraft,
} from './draft';

const validDraft: StudioDraft = {
  version: STUDIO_DRAFT_VERSION,
  updatedAt: new Date().toISOString(),
  categoryId: 'training',
  activeFamily: 'transmit',
  values: { trainingNeed: 'Préparer une séquence pédagogique sans donnée personnelle.' },
  progress: { activeStep: 3, completedSections: ['context'] },
};

describe('brouillon local du Studio', () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => vi.restoreAllMocks());

  it('sauvegarde, restaure et supprime la catégorie, les champs et la progression', () => {
    expect(saveStudioDraft(validDraft)).toBe(true);
    expect(loadStudioDraft()).toEqual(validDraft);
    expect(clearStudioDraft()).toBe(true);
    expect(loadStudioDraft()).toBeNull();
  });

  it.each([
    ['un JSON corrompu', '{invalide'],
    ['une version obsolète', JSON.stringify({ ...validDraft, version: 0 })],
    ['une structure incomplète', JSON.stringify({ version: STUDIO_DRAFT_VERSION })],
  ])('rejette %s et retire la valeur invalide', (_label, rawDraft) => {
    window.localStorage.setItem(STUDIO_DRAFT_KEY, rawDraft);

    expect(loadStudioDraft()).toBeNull();
    expect(window.localStorage.getItem(STUDIO_DRAFT_KEY)).toBeNull();
  });

  it('ignore un brouillon expiré', () => {
    window.localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({
      ...validDraft,
      updatedAt: '2020-01-01T00:00:00.000Z',
    }));

    expect(loadStudioDraft()).toBeNull();
    expect(window.localStorage.getItem(STUDIO_DRAFT_KEY)).toBeNull();
  });

  it('reste utilisable lorsque le stockage du navigateur est indisponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage indisponible');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage indisponible');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('stockage indisponible');
    });

    expect(loadStudioDraft()).toBeNull();
    expect(saveStudioDraft(validDraft)).toBe(false);
    expect(clearStudioDraft()).toBe(false);
  });
});
