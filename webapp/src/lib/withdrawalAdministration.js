const OPEN_STATUSES = new Set(['received', 'under_review', 'accepted', 'rejected']);

export const WITHDRAWAL_STATUS_LABELS = {
  received: 'Reçue',
  under_review: 'En instruction',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  closed: 'Clôturée',
};

export function splitWithdrawalRequests(requests = []) {
  return requests.reduce((groups, request) => {
    groups[OPEN_STATUSES.has(request.status) ? 'open' : 'closed'].push(request);
    return groups;
  }, { open: [], closed: [] });
}

export async function fetchWithdrawalRequests(client) {
  const { data, error } = await client.rpc('admin_list_withdrawal_requests');
  if (error) throw new Error(error.message || 'Les demandes de rétractation sont indisponibles.');
  return Array.isArray(data) ? data : [];
}

export async function updateWithdrawalRequest(client, requestId, status, reason) {
  if (!requestId || !WITHDRAWAL_STATUS_LABELS[status]) {
    throw new Error('La demande ou le statut est invalide.');
  }
  const normalizedReason = String(reason || '').trim();
  if (normalizedReason.length < 10) {
    throw new Error('Le motif administratif doit contenir au moins 10 caractères.');
  }
  const { data, error } = await client.rpc('admin_update_withdrawal_request', {
    p_request_id: requestId,
    p_status: status,
    p_reason: normalizedReason,
  });
  if (error) throw new Error(error.message || 'La demande ne peut pas être mise à jour.');
  return data;
}
