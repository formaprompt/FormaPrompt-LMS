import { certificateErrorMessage } from './iagCertificateApi.js';

// One instance per owner and Supabase client. React subscribes to this immutable store.
export function createIagCertificateController(api) {
  let generation = 0;
  let snapshot = { loading:true, busy:false, identity:null, documents:[], error:'' };
  const listeners = new Set();
  const publish = next => { snapshot = Object.freeze(next); for (const fn of listeners) fn(); };
  async function reload() {
    const token = ++generation;
    publish({ loading:true, busy:false, identity:null, documents:[], error:'' });
    try {
      const [identity, documents] = await Promise.all([api.readIdentity(), api.listCertificates()]);
      if (token !== generation) return;
      publish({ loading:false, busy:false, identity, documents, error:'' });
    } catch (error) {
      if (token === generation) publish({ loading:false, busy:false, identity:null, documents:[], error:certificateErrorMessage(error) });
    }
  }
  async function mutate(operation) {
    if (snapshot.loading || snapshot.busy || snapshot.error) return null;
    const token = generation;
    publish({ ...snapshot, busy:true, error:'' });
    try {
      const result = await operation();
      if (token !== generation) return null;
      const [identity, documents] = await Promise.all([api.readIdentity(), api.listCertificates()]);
      if (token !== generation) return null;
      publish({ loading:false, busy:false, identity, documents, error:'' });
      return result;
    } catch (error) {
      if (token === generation) publish({ loading:false, busy:false, identity:null, documents:[], error:certificateErrorMessage(error) });
      return null;
    }
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    reload,
    cancel: () => { generation += 1; },
    declareIdentity: values => mutate(() => api.declareIdentity({ ...values, expectedIdentityId:snapshot.identity?.id || null })),
    issueCertificate: type => mutate(() => api.issueCertificate(type)),
  });
}
