import { certificateErrorMessage } from './iagCertificateApi.js';

export function createIagCertificateDocumentController(api, issuanceId, authorizationKey) {
  let generation = 0;
  let snapshot = Object.freeze({ loading:true, issuance:null, error:'' });
  const listeners = new Set();
  const publish = value => { snapshot = Object.freeze(value); for (const fn of listeners) fn(); };
  async function reload() {
    const token = ++generation;
    publish({ loading:true, issuance:null, error:'' });
    try {
      const issuance = await api.readCertificate(issuanceId);
      if (token === generation) publish({ loading:false, issuance, error:'' });
    } catch (error) {
      if (token === generation) publish({ loading:false, issuance:null, error:certificateErrorMessage(error) });
    }
  }
  return Object.freeze({ getSnapshot:() => snapshot,
    subscribe:fn => { listeners.add(fn); return () => listeners.delete(fn); },
    reload, authorizationKey, cancel:() => { generation += 1; } });
}
