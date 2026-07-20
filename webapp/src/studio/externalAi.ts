export type ExternalAiServiceId = 'chatgpt' | 'claude' | 'gemini' | 'mistral' | 'copilot';

export interface ExternalAiService {
  id: ExternalAiServiceId;
  label: string;
  url: string;
}

export const EXTERNAL_AI_SERVICES: readonly ExternalAiService[] = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/' },
  { id: 'mistral', label: 'Mistral', url: 'https://chat.mistral.ai/' },
  { id: 'copilot', label: 'Copilot', url: 'https://copilot.microsoft.com/' },
] as const;

interface ClipboardWriter {
  writeText: (text: string) => Promise<void>;
}

export async function copyPromptToClipboard(prompt: string, clipboard: ClipboardWriter = navigator.clipboard) {
  await clipboard.writeText(prompt);
}

export async function copyPromptForExternalService(
  prompt: string,
  serviceId: ExternalAiServiceId,
  clipboard: ClipboardWriter = navigator.clipboard,
) {
  const service = EXTERNAL_AI_SERVICES.find((candidate) => candidate.id === serviceId);
  if (!service) throw new Error('Service externe inconnu.');
  await copyPromptToClipboard(prompt, clipboard);
  return service;
}
