export const ISSUED_ATTESTATION_ERROR = 'Cette attestation est introuvable ou vous n’êtes pas autorisé à la consulter.';

// Cancellation suppresses delivery to the old view; it does not abort transport.
// Authorization remains the existing authenticated query and its server RLS.
export function startIssuedAttestationRequest(client, issuanceId, onResult) {
  let active = true;
  const response = (async () => {
    try {
      const { data, error } = await client
        .from('course_attestation_issuances')
        .select('id, reference, user_id, course_id, document_type, content_snapshot, issued_at')
        .eq('id', issuanceId)
        .maybeSingle();
      return error || !data
        ? { issuance: null, error: ISSUED_ATTESTATION_ERROR }
        : { issuance: data, error: '' };
    } catch {
      return { issuance: null, error: ISSUED_ATTESTATION_ERROR };
    }
  })();
  const settled = response.then(result => { if (active) onResult(result); });
  return { cancel: () => { active = false; }, settled };
}
