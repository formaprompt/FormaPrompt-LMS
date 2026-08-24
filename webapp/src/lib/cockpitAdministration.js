import { deriveBpfCockpitActions } from './bpfAdministration.js';

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
  const destinations = {
    '/admin/stripe-apres-paiement': '/admin/stripe-apres-paiement',
    '/admin/commercial': '/admin/commercial',
    '/admin/dossiers': '/admin/dossiers',
    '/admin/demandes-rgpd': '/admin/demandes-rgpd',
    '/admin/acces-incidents': '/admin/acces-incidents',
    '/admin/qualite': '/admin/qualite',
    '/admin/bpf': '/admin/bpf',
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
  if (courseId) activityQuery = activityQuery.eq('course_id', courseId);
  const [{ data, error }, activitiesResult] = await Promise.all([
    client.rpc('admin_get_cockpit_summary', {
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_course_id: courseId,
    }),
    activityQuery,
  ]);

  if (error) throw new Error(error.message || 'Le cockpit ne peut pas être chargé.');
  if (!data || typeof data !== 'object') throw new Error('Le résumé du cockpit est indisponible.');
  if (activitiesResult.error) throw new Error(activitiesResult.error.message || 'Le contrôle BPF du cockpit est indisponible.');
  const bpfActions = deriveBpfCockpitActions(activitiesResult.data || []);
  const priorityActions = [...(data.priority_actions || []), ...bpfActions];
  return {
    ...data,
    priority_actions: priorityActions,
    action_counts_by_domain: {
      ...(data.action_counts_by_domain || {}),
      ...(bpfActions.length ? { bpf: bpfActions.length } : {}),
    },
    kpis: {
      ...(data.kpis || {}),
      action_items_total: Number(data.kpis?.action_items_total || 0) + bpfActions.length,
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
