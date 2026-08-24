export const ACTIVITY_RELATIONSHIPS = Object.freeze({
  direct: 'Directe FormaPrompt hors LMS',
  subcontracted_to_us: 'Sous-traitance confiée à FormaPrompt',
  subcontracted_by_us: 'Sous-traitance confiée par FormaPrompt',
});

export const ACTIVITY_STATUSES = Object.freeze({
  planned: 'Planifiée',
  completed: 'Réalisée',
  cancelled: 'Annulée',
});

export const INVOICE_STATUSES = Object.freeze({
  not_invoiced: 'Non facturée',
  invoiced: 'Facturée',
  partially_paid: 'Partiellement encaissée',
  paid: 'Encaissée',
  cancelled: 'Facture annulée',
});

const CUSTOMER_CATEGORIES = new Set(['individual', 'company', 'training_organization', 'public_body', 'nonprofit', 'other']);
const FUNDING_MODES = new Set(['self_funded', 'company', 'opco', 'free', 'other']);
const DELIVERY_MODES = new Set(['remote', 'in_person', 'hybrid']);
const RELATIONSHIPS = new Set(Object.keys(ACTIVITY_RELATIONSHIPS));
const STATUSES = new Set(Object.keys(ACTIVITY_STATUSES));
const INVOICE_STATUS_VALUES = new Set(Object.keys(INVOICE_STATUSES));

function throwIfError(result, fallback) {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data || [];
}

function validateFilters(filters) {
  if (!filters?.dateFrom || !filters?.dateTo || filters.dateTo < filters.dateFrom) {
    throw new Error('La période sélectionnée est invalide.');
  }
}

function periodQuery(client, source, filters) {
  return client.from(source).select('*')
    .gte('starts_on', filters.dateFrom)
    .lte('starts_on', filters.dateTo)
    .order('starts_on', { ascending: false });
}

export async function fetchBpfAdministration(client, filters) {
  validateFilters(filters);
  const [external, internal, allSources, bpfRows] = await Promise.all([
    periodQuery(client, 'external_training_activities', filters),
    periodQuery(client, 'admin_internal_training_activity', filters),
    periodQuery(client, 'admin_training_activity_all_sources', filters),
    periodQuery(client, 'admin_bpf_preparation_rows', filters),
  ]);
  return {
    externalActivities: throwIfError(external, 'Les activités externes sont indisponibles.'),
    internalActivities: throwIfError(internal, 'Les activités internes sont indisponibles.'),
    allActivities: throwIfError(allSources, 'La consolidation des activités est indisponible.'),
    bpfRows: throwIfError(bpfRows, 'La préparation BPF est indisponible.'),
  };
}

function eurosToCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Les montants doivent être positifs.');
  return Math.round(amount * 100);
}

function activityRpcPayload(values) {
  if (!RELATIONSHIPS.has(values.activityRelationship)) throw new Error('La relation de prestation est invalide.');
  if (!CUSTOMER_CATEGORIES.has(values.customerCategory)) throw new Error('La catégorie client est invalide.');
  if (!FUNDING_MODES.has(values.fundingMode)) throw new Error('Le financement est invalide.');
  if (!DELIVERY_MODES.has(values.deliveryMode)) throw new Error('La modalité est invalide.');
  if (!STATUSES.has(values.status)) throw new Error('Le statut de l’activité est invalide.');
  if (!INVOICE_STATUS_VALUES.has(values.invoiceStatus)) throw new Error('Le statut de facture est invalide.');
  if (values.endsOn < values.startsOn) throw new Error('La date de fin doit suivre la date de début.');
  if (values.activityRelationship !== 'direct' && !values.orderingOrganization?.trim()) {
    throw new Error('L’organisme donneur d’ordre est requis pour une sous-traitance.');
  }
  return {
    p_title: values.title,
    p_activity_relationship: values.activityRelationship,
    p_ordering_organization: values.orderingOrganization || null,
    p_customer_category: values.customerCategory,
    p_funding_mode: values.fundingMode,
    p_delivery_mode: values.deliveryMode,
    p_starts_on: values.startsOn,
    p_ends_on: values.endsOn,
    p_status: values.status,
    p_trainee_count: Number(values.traineeCount),
    p_delivered_hours: Number(values.deliveredHours),
    p_trainee_hours: Number(values.traineeHours),
    p_invoiced_amount_cents: eurosToCents(values.invoicedAmount),
    p_collected_amount_cents: values.collectedAmount === '' || values.collectedAmount == null
      ? null : eurosToCents(values.collectedAmount),
    p_invoice_reference: values.invoiceReference || null,
    p_invoice_status: values.invoiceStatus,
    p_administrative_note: values.administrativeNote || null,
    p_reason: values.reason,
  };
}

async function rpc(client, name, params) {
  const result = await client.rpc(name, params);
  if (result.error) throw new Error(result.error.message || 'L’opération sur l’activité externe a échoué.');
  return result.data;
}

export function createExternalActivity(client, values) {
  return rpc(client, 'admin_create_external_training_activity', activityRpcPayload(values));
}

export function updateExternalActivity(client, values) {
  return rpc(client, 'admin_update_external_training_activity', {
    p_activity_id: values.activityId,
    ...activityRpcPayload(values),
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

export function buildBpfSummary(allActivities = [], bpfRows = []) {
  const completed = allActivities.filter((row) => row.status === 'completed');
  const internal = completed.filter((row) => row.source_kind === 'internal_lms');
  const external = completed.filter((row) => row.source_kind === 'external');
  const subcontracting = external.filter((row) => row.activity_relationship === 'subcontracted_to_us'
    || row.activity_relationship === 'subcontracted_by_us');
  const products = sum(bpfRows, 'product_amount_cents');
  const make = (rows) => ({
    activityCount: rows.length,
    traineeCount: sum(rows, 'trainee_count'),
    trainingHours: sum(rows, 'delivered_hours'),
    traineeHours: sum(rows, 'trainee_hours'),
  });
  return {
    internal: make(internal),
    external: make(external),
    total: { ...make(completed), productAmountCents: products },
    subcontracting: make(subcontracting),
    externalInvoicedCents: sum(external, 'invoiced_amount_cents'),
    externalCollectedCents: sum(external, 'collected_amount_cents'),
  };
}

export function findBpfDataIssues(allActivities = [], internalActivities = []) {
  const issues = [];
  const seen = new Set();
  for (const row of allActivities) {
    const key = `${row.source_kind}:${row.activity_id}`;
    if (seen.has(key)) issues.push({ key: `duplicate:${key}`, severity: 'critical', type: 'duplicate', activityId: row.activity_id, label: 'Activité comptée plusieurs fois dans la consolidation.' });
    seen.add(key);
    if (row.status === 'completed' && Number(row.trainee_count || 0) <= 0) issues.push({ key: `trainees:${key}`, severity: 'high', type: 'missing_trainees', activityId: row.activity_id, label: 'Activité réalisée sans stagiaire renseigné.' });
    if (row.status === 'completed' && !(Number(row.delivered_hours) > 0)) issues.push({ key: `hours:${key}`, severity: 'high', type: 'missing_hours', activityId: row.activity_id, label: 'Activité réalisée sans heures de formation vérifiables.' });
    if (row.status === 'completed' && !(Number(row.trainee_hours) > 0)) issues.push({ key: `trainee-hours:${key}`, severity: 'high', type: 'missing_trainee_hours', activityId: row.activity_id, label: 'Activité réalisée sans heures-stagiaires.' });
    if (row.source_kind === 'external' && !row.activity_relationship) issues.push({ key: `relationship:${key}`, severity: 'high', type: 'missing_relationship', activityId: row.activity_id, label: 'Classification de prestation manquante.' });
    if (row.source_kind === 'external' && row.status === 'completed' && row.invoice_status === 'not_invoiced') issues.push({ key: `invoice:${key}`, severity: 'medium', type: 'not_invoiced', activityId: row.activity_id, label: 'Activité externe réalisée mais non facturée.' });
    if (row.source_kind === 'external' && !['not_invoiced', 'cancelled'].includes(row.invoice_status) && !(Number(row.invoiced_amount_cents) > 0)) issues.push({ key: `amount:${key}`, severity: 'high', type: 'invoice_without_amount', activityId: row.activity_id, label: 'Facture renseignée sans montant facturé.' });
  }
  const consolidatedInternal = new Set(allActivities.filter((row) => row.source_kind === 'internal_lms').map((row) => row.activity_id));
  for (const row of internalActivities) {
    if (!consolidatedInternal.has(row.activity_id)) issues.push({ key: `missing-internal:${row.activity_id}`, severity: 'critical', type: 'missing_internal', activityId: row.activity_id, label: 'Activité interne absente de la consolidation.' });
  }
  return issues;
}

export function deriveBpfCockpitActions(rows = [], now = new Date()) {
  return findBpfDataIssues(rows)
    .filter((issue) => issue.type !== 'duplicate')
    .slice(0, 8)
    .map((issue) => ({
      domain: 'bpf', severity: issue.severity, item_type: `bpf_${issue.type}`,
      item_id: issue.activityId, course_id: null, neutral_label: issue.label,
      created_at: now.toISOString(), due_at: null, age_seconds: 0,
      destination_path: '/admin/bpf',
    }));
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildBpfCsv(rows = []) {
  const columns = [
    ['source_kind', 'source'], ['activity_id', 'identifiant'], ['title', 'intitule'],
    ['activity_relationship', 'relation_prestation'], ['ordering_organization', 'donneur_ordre'],
    ['customer_category', 'categorie_client'], ['funding_mode', 'financement'],
    ['starts_on', 'date_debut'], ['ends_on', 'date_fin'], ['trainee_count', 'stagiaires'],
    ['training_hours', 'heures_formation'], ['trainee_hours', 'heures_stagiaires'],
    ['product_amount_cents', 'produit_formation_centimes'], ['product_amount_basis', 'base_montant'],
    ['invoice_status', 'statut_facture'],
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(';')];
  for (const row of rows) lines.push(columns.map(([field]) => csvCell(row[field])).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}

export function filterExternalActivities(rows = [], filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('fr-FR');
  return rows.filter((row) => (!filters.relationship || row.activity_relationship === filters.relationship)
    && (!filters.status || row.status === filters.status)
    && (!search || `${row.title} ${row.ordering_organization || ''} ${row.invoice_reference || ''}`.toLocaleLowerCase('fr-FR').includes(search)));
}
