import { describe, expect, it, vi } from 'vitest';
import {
  copyPromptForExternalService,
  EXTERNAL_AI_SERVICES,
  openExternalAiService,
} from './externalAi';

describe('préparation des services d’IA externes', () => {
  it('copie le prompt avant de préparer une URL officielle sans contenu transmis', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const prompt = 'Prompt confidentiel de test qui ne doit jamais apparaître dans une URL.';
    const service = await copyPromptForExternalService(prompt, 'chatgpt', { writeText });

    expect(writeText).toHaveBeenCalledWith(prompt);
    expect(service.url).toBe('https://chatgpt.com/');
    expect(service.url).not.toContain(encodeURIComponent(prompt));
    expect(service.url).not.toContain(prompt);
  });

  it('utilise uniquement des adresses HTTPS sans paramètre de prompt', () => {
    EXTERNAL_AI_SERVICES.forEach((service) => {
      const url = new URL(service.url);
      expect(url.protocol).toBe('https:');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    });
  });

  it('ouvre une seule fois le service officiel sans inclure le prompt dans son adresse', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const opener = vi.fn();
    const prompt = 'Prompt qui reste uniquement dans le presse-papiers.';
    const service = await copyPromptForExternalService(prompt, 'chatgpt', { writeText });

    openExternalAiService(service, opener);

    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener).toHaveBeenCalledWith('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
    expect(opener.mock.calls[0]?.[0]).not.toContain(prompt);
  });

  it('n’ouvre rien lorsque la copie échoue', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('copie refusée'));
    const opener = vi.fn();
    await expect(copyPromptForExternalService('Prompt', 'claude', { writeText })).rejects.toThrow('copie refusée');
    expect(opener).not.toHaveBeenCalled();
  });
});
