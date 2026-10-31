import { InputError, requiredUuid, singleEmail } from './httpInput.js';

export function validateContactSubmission(input) {
  const submissionId = requiredUuid(input?.submissionId);
  function text(key, min, max) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (value.length < min || value.length > max) throw new InputError('Demande incomplète ou invalide.');
    return value;
  }
  const requestType = input.request_type;
  if (!['individual','professional','beneficiary','funding'].includes(requestType)) throw new InputError('Type de demande invalide.');
  return {
    id: submissionId, name: text('name', 2, 150), email: singleEmail(input.email),
    subject: text('subject', 2, 200), message: text('message', 10, 5000),
    request_type: requestType, funding_requested: requestType === 'funding',
  };
}

export async function submitContact(input, { store, notify, defer = (task) => task.catch(() => {}) }) {
  // A honeypot does not insert a row or emit any email.
  if (input?.website) return { accepted: true };
  const row = validateContactSubmission(input);
  let existing = await store.find(row.id);
  if (!existing) {
    if (await store.recentCount(row.email) >= 5) throw new InputError('Plusieurs demandes ont déjà été reçues. Merci de patienter avant de réessayer.', 429);
    try { await store.insert(row); }
    catch (error) {
      if (error?.code !== '23505') throw error;
      existing = await store.find(row.id);
      if (!existing) throw error;
    }
  }
  if (existing && Object.keys(row).some((key) => existing[key] !== row[key])) throw new InputError('Cette référence correspond déjà à une autre demande.', 409);
  const task = Promise.resolve().then(() => notify(row.id)).catch(() => {});
  defer(task);
  return { accepted: true };
}

export function createContactStore(database, now = () => Date.now()) {
  return {
    async find(id) {
      const { data, error } = await database.from('contact_requests').select('id,name,email,subject,message,request_type,funding_requested').eq('id',id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async recentCount(email) {
      const { count, error } = await database.from('contact_requests').select('id',{ count:'exact',head:true }).eq('email',email).gte('created_at',new Date(now()-10*60_000).toISOString());
      if (error) throw error;
      return count || 0;
    },
    async insert(row) {
      const { error } = await database.from('contact_requests').insert(row);
      if (error) throw error;
    },
  };
}
