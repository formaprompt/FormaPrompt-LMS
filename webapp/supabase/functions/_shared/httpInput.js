export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function readBoundedBody(request, maxBytes) {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new InputError('Requête trop volumineuse.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Requête vide.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new InputError('Requête trop volumineuse.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export function requiredUuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new InputError('Référence invalide.');
  return value;
}

export function singleEmail(value) {
  const raw = typeof value === 'string' ? value : '';
  const email = raw.trim().toLowerCase();
  if (/[\r\n\t]/.test(raw) || email.length > 320 || !/^[^\s@<>,;:"()[\]\\?&#%]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(email)) throw new InputError('Adresse e-mail invalide.');
  return email;
}
