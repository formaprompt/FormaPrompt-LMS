import { COURSE, CONTENT, publicDocumentProjection } from './iagCertificateDomain.js';
import { normalizeDeclaredIdentity, identityError } from './iagCertificateIdentity.js';

export function certificateErrorMessage(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  if (text.includes('IAG_IDENTITY_FROZEN')) return 'Un certificat porte déjà cette identité. Contactez FormaPrompt pour demander une rectification ; aucun document existant ne sera réécrit.';
  if (text.includes('IAG_IDENTITY_CONFLICT')) return 'L’identité a changé dans une autre demande. Rechargez avant de poursuivre.';
  if (text.includes('IAG_IDENTITY_REQUIRED')) return 'Déclarez votre prénom et votre nom avant de demander le certificat.';
  if (text.includes('IAG_IDENTITY_INVALID')) return 'Vérifiez le prénom et le nom : aucun lien, adresse e-mail, caractère de contrôle ou nom générique.';
  if (text.includes('IAG_SESSION_CHANGED')) return 'Le compte a changé. Rechargez cet espace.';
  return 'Cette demande ne peut pas être confirmée. Rechargez ou contactez FormaPrompt si le problème persiste.';
}
export function createIagCertificateApi(supabase, { userId } = {}) {
  async function currentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id || (userId && data.user.id !== userId)) throw identityError('IAG_SESSION_CHANGED');
    return data.user.id;
  }
  async function request(name, params, validate) {
    const actor = await currentUser();
    const result = await supabase.rpc(name, params);
    if (await currentUser() !== actor) throw identityError('IAG_SESSION_CHANGED');
    if (result.error) throw result.error;
    return validate(result.data, actor);
  }
  function identity(data, actor) {
    if (data === null) return null;
    if (data?.userId !== actor || data.courseId !== COURSE || data.source !== 'self_declared'
      || data.declarationVersion !== 'iag-identity-declaration-v1' || typeof data.id !== 'string') throw identityError('IAG_INVALID_RESPONSE');
    normalizeDeclaredIdentity(data);
    return data;
  }
  function documents(data, actor, ownerOnly = true) {
    if (!Array.isArray(data)) throw identityError('IAG_INVALID_RESPONSE');
    for (const row of data) {
      if (typeof row.id !== 'string' || !/^[1-9][0-9]{0,18}$/u.test(row.id) || typeof row.user_id !== 'string'
        || (ownerOnly && row.user_id !== actor) || row.course_id !== COURSE
        || !['iag_completion','iag_success'].includes(row.document_type) || row.content_snapshot?.version !== 'iag-1'
        || row.content_snapshot.contentVersion !== CONTENT) throw identityError('IAG_INVALID_RESPONSE');
      publicDocumentProjection(row);
    }
    return data;
  }
  const readCertificate = async id => {
    if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/u.test(id)) throw identityError('IAG_INVALID_RESPONSE');
    // A specific row may belong to a learner whom server RLS authorizes staff to read.
    // No browser role or owner-only comparison replaces that server decision.
    const rows = await request('iag_certificate_documents', { p_id:id }, (data, actor) => documents(data, actor, false));
    if (rows.length !== 1 || rows[0].id !== id) throw identityError('IAG_DOCUMENT_UNAVAILABLE');
    return rows[0];
  };
  return Object.freeze({
    readIdentity: () => request('iag_certificate_identity', {}, identity),
    declareIdentity: ({ firstName, lastName, expectedIdentityId = null }) => {
      const names = normalizeDeclaredIdentity({ firstName, lastName });
      return request('iag_declare_certificate_identity', { p_first_name:names.firstName,
        p_last_name:names.lastName, p_expected_identity_id:expectedIdentityId }, identity);
    },
    listCertificates: () => request('iag_certificate_documents', { p_id:null }, documents),
    readCertificate,
    issueCertificate: async type => {
      if (!['iag_completion','iag_success'].includes(type)) throw identityError('IAG_INVALID_TYPE');
      const id = await request('iag_issue_certificate', { p_type:type }, data => {
        if (typeof data !== 'string' || !/^[1-9][0-9]{0,18}$/u.test(data)) throw identityError('IAG_INVALID_RESPONSE');
        return data;
      });
      return readCertificate(id);
    },
  });
}
