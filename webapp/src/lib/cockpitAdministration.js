import { deriveBpfCockpitActions } from './bpfAdministration.js';
import {
  DISCIPLINARY_INCIDENT_STATUS_LABELS,
  isDisciplinaryIncidentOpen,
} from './disciplinaryIncidentAdministration.js';
import { buildQualityOverview } from './qualityAdministration.js';

const ALLOWED_COURSE_IDS = new Set([
  'formation-ia',
  'formation-prompt-level-1',
  'formation-ia-act',
]);

const CLIENT_ACTION_TYPES = new Set([
  'complaint',
  'commercial_follow_up',
  'withdrawal_request',
  'privacy_request',
]);

const OPERATIONAL_ACTION_TYPES = new Set(['funding_review']);

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function priorityGroup(action) {
  if (action.severity === 'critical') return 0;
  if (CLIENT_ACTION_TYPES.has(action.item_type)) return 1;
  if (OPERATIONAL_ACTION_TYPES.has(action.item_type)) return 2;
  if (action.domain === 'quality') return 3;
  return 4;
}

function dueTimestamp(value) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY;
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function actionKey(action) {
  return `${action.domain}:${action.item_type}:${action.item_id}`;
}

function ageInSeconds(value, now) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
}

function shortReference(id) {
  return String(id || '').slice(0, 8).toUpperCase();
}

export function deriveIncidentCockpitActions(incidents = [], now = new Date()) {
  return incidents
    .filter(isDisciplinaryIncidentOpen)
    .map((incident) => ({
      domain: 'incident',
      severity: incident.severity,
      item_type: 'disciplinary_incident',
      item_id: incident.id,
      course_id: incident.course_id || null,
      neutral_label: `Incident — ${DISCIPLINARY_INCIDENT_STATUS_LABELS[incident.incident_status] || 'À instruire'} · dossier ${shortReference(incident.id)}`,
      created_at: incident.reported_at || incident.created_at || null,
      due_at: null,
      age_seconds: ageInSeconds(incident.reported_at || incident.created_at, now),
      destination_path: '/admin/acces-incidents',
    }));
}

export function deriveQualityRiskCockpitActions(data = {}, now = new Date()) {
  return buildQualityOverview(data, now).risks
    .filter((risk) => risk.needsReview)
    .map((risk) => ({
      domain: 'quality',
      severity: risk.parent.severity || 'medium',
      item_type: 'quality_risk_review',
      item_id: risk.id,
      course_id: null,
      neutral_label: `Qualité — revue de risque requise · dossier ${shortReference(risk.id)}`,
      created_at: risk.created_at || risk.parent.detected_at || risk.review_due_at,
      due_at: risk.review_due_at,
      age_seconds: ageInSeconds(risk.created_at || risk.parent.detected_at || risk.review_due_at, now),
      destination_path: '/admin/qualite',
    }));
}

export function appendUniqueCockpitActions(existingActions = [], additions = []) {
  const knownKeys = new Set(existingActions.map(actionKey));
  return additions.filter((action) => {
    const key = actionKey(action);
    if (knownKeys.has(key)) return false;
    knownKeys.add(key);
    return true;
  });
}

function countActionsByDomain(actions) {
  return actions.reduce((counts, action) => ({
    ...counts,
    [action.domain]: Number(counts[action.domain] || 0) + 1,
  }), {});
}

export function prioritizeCockpitActions(actions = [], now = new Date()) {
  const nowTimestamp = now.getTime();
  return [...actions]
    .map((action) => ({
      ...action,
      functional_priority: priorityGroup(action),
      is_overdue: Boolean(action.due_at && dueTimestamp(action.due_at) < nowTimestamp),
    }))
    .sort((left, right) => {
      const groupDifference = left.functional_priority - right.functional_priority;
      if (groupDifference) return groupDifference;

      const severityDifference = (SEVERITY_ORDER[left.severity] ?? 4)
        - (SEVERITY_ORDER[right.severity] ?? 4);
      if (severityDifference) return severityDifference;

      if (left.is_overdue !== right.is_overdue) return left.is_overdue ? -1 : 1;

      const deadlineDifference = dueTimestamp(left.due_at) - dueTimestamp(right.due_at);
      if (deadlineDifference) return deadlineDifference;

      return Number(right.age_seconds || 0) - Number(left.age_seconds || 0);
    });
}

export function getActionDestination(action) {
  if (action?.item_type === 'withdrawal_request') return '/admin/retractations';
  const destinations = {
    '/admin/stripe-apres-paiement': '/admin/stripe-apres-paiement',
    '/admin/commercial': '/admin/commercial',
    '/admin/dossiers': '/admin/dossiers',
    '/admin/demandes-rgpd': '/admin/demandes-rgpd',
    '/admin/acces-incidents': '/admin/acces-incidents',
    '/admin/qualite': '/admin/qualite',
    '/admin/bpf': '/admin/bpf',
    '/admin/retractations': '/admin/retractations',
  };
  return destinations[action?.destination_path] || null;
}

export async function fetchCockpitSummary(client, filters) {
  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;
  const courseId = filters?.courseId || null;

  if (!dateFrom || !dateTo || dateTo < dateFrom) {
    throw new Error('La période sélectionnée est invalide.');
  }
  if (courseId && !ALLOWED_COURSE_IDS.has(courseId)) {
    throw new Error('La formation sélectionnée est invalide.');
  }

  let activityQuery = client.from('admin_training_activity_all_sources').select('*')
    .gte('starts_on', dateFrom).lte('starts_on', dateTo);
  let incidentsQuery = client.from('disciplinary_incidents')
    .select('id, incident_status, severity, course_id, reported_at, created_at')
    .neq('incident_status', 'closed');
  if (courseId) activityQuery = activityQuery.eq('course_id', courseId);
  if (courseId) incidentsQuery = incidentsQuery.eq('course_id', courseId);
  const [{ data, error }, activitiesResult, incidentsResult, risksResult, recordsResult] = await Promise.all([
    client.rpc('admin_get_cockpit_summary', {
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_course_id: courseId,
    }),
    activityQuery,
    incidentsQuery,
    client.from('quality_risks').select('id, quality_record_id, status, review_due_at, created_at'),
    client.from('quality_records').select('id, severity, detected_at'),
  ]);

  if (error) throw new Error(error.message || 'Le cockpit ne peut pas être chargé.');
  if (!data || typeof data !== 'object') throw new Error('Le résumé du cockpit est indisponible.');
  if (activitiesResult.error) throw new Error(activitiesResult.error.message || 'Le contrôle BPF du cockpit est indisponible.');
  if (incidentsResult.error) throw new Error(incidentsResult.error.message || 'Les incidents du cockpit sont indisponibles.');
  if (risksResult.error || recordsResult.error) throw new Error('Les risques qualité du cockpit sont indisponibles.');
  const bpfActions = deriveBpfCockpitActions(activitiesResult.data || []);
  const incidentActions = deriveIncidentCockpitActions(incidentsResult.data || []);
  const qualityRiskActions = deriveQualityRiskCockpitActions({
    records: recordsResult.data || [],
    risks: risksResult.data || [],
  });
  const additions = appendUniqueCockpitActions(data.priority_actions || [], [
    ...bpfActions,
    ...incidentActions,
    ...qualityRiskActions,
  ]);
  const additionCounts = countActionsByDomain(additions);
  const additionalCriticalCount = additions.filter((action) => action.severity === 'critical').length;
  const priorityActions = [...(data.priority_actions || []), ...additions];
  return {
    ...data,
    priority_actions: priorityActions,
    action_counts_by_domain: {
      ...(data.action_counts_by_domain || {}),
      ...Object.fromEntries(Object.entries(additionCounts).map(([domain, count]) => [
        domain,
        Number(data.action_counts_by_domain?.[domain] || 0) + count,
      ])),
    },
    kpis: {
      ...(data.kpis || {}),
      action_items_total: Number(data.kpis?.action_items_total || 0) + additions.length,
      critical_action_items: Number(data.kpis?.critical_action_items || 0) + additionalCriticalCount,
    },
  };
}

export function formatMoney(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: String(currency).toUpperCase(),
    maximumFractionDigits: 2,
  }).format(Number(cents || 0) / 100);
}
