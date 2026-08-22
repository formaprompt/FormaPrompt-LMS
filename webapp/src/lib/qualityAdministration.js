const CLOSED_ACTION_STATUSES = new Set(['completed', 'cancelled']);
const CLOSED_RISK_STATUSES = new Set(['accepted', 'closed']);
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function unwrap(result, fallback) {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data || [];
}

export async function fetchQualityAdministration(client) {
  const [records, complaints, risks, actions, profiles] = await Promise.all([
    client.from('quality_records').select('*').order('detected_at', { ascending: false }),
    client.from('quality_complaints').select('*').order('received_at', { ascending: false }),
    client.from('quality_risks').select('*').order('risk_score', { ascending: false }),
    client.from('quality_actions').select('*').order('due_at', { ascending: true, nullsFirst: false }),
    client.from('profiles').select('id,email,role').eq('role', 'admin'),
  ]);
  return {
    records: unwrap(records, 'Le registre qualité est indisponible.'),
    complaints: unwrap(complaints, 'Les réclamations sont indisponibles.'),
    risks: unwrap(risks, 'Les risques sont indisponibles.'),
    actions: unwrap(actions, 'Les actions qualité sont indisponibles.'),
    profiles: unwrap(profiles, 'Les responsables qualité sont indisponibles.'),
  };
}

export function buildQualityOverview(data, now = new Date()) {
  const timestamp = now.getTime();
  const recordsById = new Map((data.records || []).map((item) => [item.id, item]));
  const complaints = (data.complaints || []).map((item) => {
    const parent = recordsById.get(item.quality_record_id) || {};
    const due = item.response_due_at ? Date.parse(item.response_due_at) : Number.POSITIVE_INFINITY;
    return {
      ...item,
      parent,
      priorityRank: item.outcome !== 'pending' ? 9
        : !item.acknowledged_at ? 0
          : due < timestamp ? 1
            : !item.final_response_at ? 2 : 3,
      isOverdue: due < timestamp && item.outcome === 'pending',
      associatedActions: (data.actions || []).filter((action) => action.quality_record_id === item.quality_record_id),
    };
  }).sort((a, b) => a.priorityRank - b.priorityRank
    || (SEVERITY_ORDER[a.parent.severity] ?? 4) - (SEVERITY_ORDER[b.parent.severity] ?? 4)
    || Date.parse(a.received_at) - Date.parse(b.received_at));

  const actions = (data.actions || []).map((item) => ({
    ...item,
    parent: recordsById.get(item.quality_record_id) || {},
    isOverdue: Boolean(item.due_at && Date.parse(item.due_at) < timestamp && !CLOSED_ACTION_STATUSES.has(item.status)),
    isUpcoming: Boolean(item.due_at && Date.parse(item.due_at) >= timestamp
      && Date.parse(item.due_at) <= timestamp + 7 * 86400000 && !CLOSED_ACTION_STATUSES.has(item.status)),
  })).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue)
    || (SEVERITY_ORDER[a.priority] ?? 4) - (SEVERITY_ORDER[b.priority] ?? 4));

  const risks = (data.risks || []).map((item) => ({
    ...item,
    parent: recordsById.get(item.quality_record_id) || {},
    needsReview: Boolean(item.review_due_at && Date.parse(item.review_due_at) < timestamp && !CLOSED_RISK_STATUSES.has(item.status)),
  })).sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || Number(b.risk_score) - Number(a.risk_score));

  const closableRecords = (data.records || []).filter((record) => record.status === 'resolved'
    || (record.status !== 'closed'
      && !(data.actions || []).some((action) => action.quality_record_id === record.id && !CLOSED_ACTION_STATUSES.has(action.status))
      && !(data.complaints || []).some((complaint) => complaint.quality_record_id === record.id && complaint.outcome === 'pending')));
  return {
    complaints,
    actions,
    risks,
    openComplaints: complaints.filter((item) => item.outcome === 'pending'),
    overdueActions: actions.filter((item) => item.isOverdue),
    highRisks: risks.filter((item) => !CLOSED_RISK_STATUSES.has(item.status) && Number(item.risk_score) >= 15),
    closableRecords,
  };
}

async function rpc(client, name, params) {
  const result = await client.rpc(name, params);
  if (result.error) throw new Error(result.error.message || `L’opération ${name} a échoué.`);
  return result.data;
}

export async function createComplaint(client, values) {
  const record = await rpc(client, 'admin_create_quality_record', {
    p_record_type: 'complaint', p_source_type: 'complaint', p_title: values.title,
    p_factual_description: values.description, p_severity: values.severity,
    p_owner_user_id: values.ownerUserId, p_reason: values.reason,
    p_occurred_at: values.receivedAt, p_incident_id: null,
  });
  const parent = Array.isArray(record) ? record[0] : record;
  return rpc(client, 'admin_create_quality_complaint', {
    p_quality_record_id: parent.id, p_received_at: values.receivedAt,
    p_channel: values.channel, p_complainant_type: values.complainantType,
    p_reason: values.reason, p_complainant_name: values.complainantName || null,
    p_complainant_email: values.complainantEmail || null,
    p_training_enrollment_id: values.trainingEnrollmentId || null,
    p_contact_request_id: values.contactRequestId || null,
    p_acknowledged_at: null, p_response_due_at: values.responseDueAt || null,
    p_final_response_at: null, p_outcome: 'pending', p_resolution_summary: null,
  });
}

export const createQualityRecord = (client, values) => rpc(client, 'admin_create_quality_record', {
  p_record_type: values.recordType, p_source_type: values.sourceType, p_title: values.title,
  p_factual_description: values.description, p_severity: values.severity,
  p_owner_user_id: values.ownerUserId, p_reason: values.reason,
  p_occurred_at: values.occurredAt || null, p_incident_id: values.incidentId || null,
});

export const updateQualityRecord = (client, values) => rpc(client, 'admin_update_quality_record', {
  p_record_id: values.recordId, p_reason: values.reason, p_status: values.status || null,
  p_severity: values.severity || null, p_owner_user_id: values.ownerUserId || null,
  p_title: values.title || null, p_factual_description: values.description || null,
});

export const updateComplaint = (client, values) => rpc(client, 'admin_update_quality_complaint', {
  p_quality_record_id: values.qualityRecordId, p_reason: values.reason,
  p_channel: null, p_complainant_type: null, p_complainant_name: null,
  p_complainant_email: null, p_training_enrollment_id: null, p_contact_request_id: null,
  p_acknowledged_at: values.acknowledgedAt || null, p_response_due_at: values.responseDueAt || null,
  p_final_response_at: values.finalResponseAt || null, p_outcome: values.outcome || null,
  p_resolution_summary: values.resolutionSummary || null,
});

export const createQualityAction = (client, values) => rpc(client, 'admin_create_quality_action', {
  p_quality_record_id: values.qualityRecordId, p_risk_id: values.riskId || null,
  p_action_type: values.actionType, p_title: values.title,
  p_action_description: values.description, p_priority: values.priority,
  p_responsible_user_id: values.responsibleUserId, p_reason: values.reason,
  p_due_at: values.dueAt || null,
});

export const updateQualityAction = (client, values) => rpc(client, 'admin_update_quality_action', {
  p_action_id: values.actionId, p_reason: values.reason, p_status: values.status,
  p_responsible_user_id: values.responsibleUserId || null, p_due_at: values.dueAt || null,
  p_completion_evidence: values.completionEvidence || null,
});

export const createQualityRisk = (client, values) => rpc(client, 'admin_create_quality_risk', {
  p_quality_record_id: values.qualityRecordId, p_title: values.title,
  p_risk_description: values.description, p_likelihood: Number(values.likelihood),
  p_impact: Number(values.impact), p_treatment_strategy: values.strategy,
  p_owner_user_id: values.ownerUserId, p_reason: values.reason,
  p_review_due_at: values.reviewDueAt || null,
});

export const updateQualityRisk = (client, values) => rpc(client, 'admin_update_quality_risk', {
  p_risk_id: values.riskId, p_reason: values.reason, p_status: values.status,
  p_likelihood: values.likelihood ? Number(values.likelihood) : null,
  p_impact: values.impact ? Number(values.impact) : null,
  p_treatment_strategy: values.strategy || null, p_owner_user_id: values.ownerUserId || null,
  p_review_due_at: values.reviewDueAt || null,
});
