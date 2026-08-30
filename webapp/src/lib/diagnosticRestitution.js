export const DIAGNOSTIC_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'to_complete', label: 'À réaliser' },
  { id: 'to_write', label: 'À rédiger' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'published', label: 'Publiés' },
];

export const MATURITY_LEVELS = [
  { value: 1, label: 'Découverte' },
  { value: 2, label: 'Expérimentation' },
  { value: 3, label: 'Structuration' },
  { value: 4, label: 'Intégration' },
  { value: 5, label: 'Optimisation' },
];

export const RESTITUTION_LIMITS = Object.freeze({
  overall_summary: 6000,
  maturity_assessment: 4000,
  current_uses: 4000,
  strengths: { items: 10, item: 500 },
  watch_points: { items: 10, item: 500 },
  priority_opportunities: { items: 3 },
  recommendations: { items: 12, item: 1000 },
  short_term_actions: { items: 6, item: 1000 },
  recommended_tool_families: { items: 12, item: 300 },
  privacy_rgpd_considerations: 4000,
  ai_act_considerations: 4000,
  next_steps: 4000,
  correction_reason: 1000,
});

const NARRATIVE_FIELDS = [
  'overall_summary',
  'maturity_assessment',
  'current_uses',
  'privacy_rgpd_considerations',
  'ai_act_considerations',
  'next_steps',
];

const ARRAY_FIELDS = [
  'strengths',
  'watch_points',
  'recommendations',
  'recommended_tool_families',
];

const OPPORTUNITY_LIMITS = Object.freeze({
  title: 200,
  expected_benefit: 1000,
  effort: 300,
  indicative_cost: 300,
  risk_or_watchpoint: 1000,
  first_action: 1000,
});

const VALID_HORIZONS = new Set(['immediate', '30_days', '90_days']);
const CLIENT_VISIBLE_ORDER_STATUSES = new Set(['paid', 'disputed', 'chargeback', 'refunded']);

export const DIAGNOSTIC_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createEmptyRestitutionContent() {
  return {
    overall_summary: '',
    observed_maturity_level: null,
    maturity_assessment: '',
    current_uses: '',
    strengths: [],
    watch_points: [],
    priority_opportunities: [],
    recommendations: [],
    short_term_actions: [],
    recommended_tool_families: [],
    privacy_rgpd_considerations: '',
    ai_act_considerations: '',
    next_steps: '',
  };
}

export function restitutionToContent(restitution) {
  const empty = createEmptyRestitutionContent();
  if (!restitution) return empty;
  return Object.fromEntries(Object.keys(empty).map((key) => [
    key,
    Array.isArray(empty[key])
      ? structuredClone(Array.isArray(restitution[key]) ? restitution[key] : empty[key])
      : restitution[key] ?? empty[key],
  ]));
}

function textIsValid(value, maximum) {
  return typeof value === 'string' && value.trim().length <= maximum && !/<\s*\/?[a-z!][^>]*>/i.test(value);
}

function textArrayIsValid(values, limits) {
  return Array.isArray(values)
    && values.length <= limits.items
    && values.every((value) => textIsValid(value, limits.item) && value.trim().length >= 1);
}

export function validateRestitutionContent(content, { forPublication = false } = {}) {
  const errors = [];
  const value = content || {};

  for (const field of NARRATIVE_FIELDS) {
    if (!textIsValid(value[field], RESTITUTION_LIMITS[field])) errors.push(field);
  }
  for (const field of ARRAY_FIELDS) {
    if (!textArrayIsValid(value[field], RESTITUTION_LIMITS[field])) errors.push(field);
  }
  if (value.observed_maturity_level !== null
    && !MATURITY_LEVELS.some((level) => level.value === Number(value.observed_maturity_level))) {
    errors.push('observed_maturity_level');
  }
  if (!Array.isArray(value.priority_opportunities)
    || value.priority_opportunities.length > RESTITUTION_LIMITS.priority_opportunities.items
    || value.priority_opportunities.some((item) => Object.entries(OPPORTUNITY_LIMITS)
      .some(([field, maximum]) => !textIsValid(item?.[field], maximum)))) {
    errors.push('priority_opportunities');
  }
  if (!Array.isArray(value.short_term_actions)
    || value.short_term_actions.length > RESTITUTION_LIMITS.short_term_actions.items
    || value.short_term_actions.some((item) => !textIsValid(item?.action, RESTITUTION_LIMITS.short_term_actions.item)
      || (item?.horizon !== '' && !VALID_HORIZONS.has(item?.horizon)))) {
    errors.push('short_term_actions');
  }

  if (forPublication) {
    if (value.overall_summary.trim().length < 50) errors.push('overall_summary_minimum');
    if (!MATURITY_LEVELS.some((level) => level.value === Number(value.observed_maturity_level))) errors.push('maturity_required');
    if (value.maturity_assessment.trim().length < 20) errors.push('maturity_assessment_minimum');
    if (value.current_uses.trim().length < 10) errors.push('current_uses_minimum');
    if (value.strengths.length < 1) errors.push('strengths_required');
    if (value.watch_points.length < 1) errors.push('watch_points_required');
    if (value.priority_opportunities.length < 1
      || value.priority_opportunities.some((item) => !item.title.trim() || !item.first_action.trim())) {
      errors.push('priority_opportunities_required');
    }
    if (value.recommendations.length < 1) errors.push('recommendations_required');
    if (value.short_term_actions.length < 1
      || value.short_term_actions.some((item) => !item.action.trim() || !VALID_HORIZONS.has(item.horizon))) {
      errors.push('short_term_actions_required');
    }
    if (value.privacy_rgpd_considerations.trim().length < 20) errors.push('privacy_required');
    if (value.next_steps.trim().length < 10) errors.push('next_steps_required');
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function throwQueryError(result, fallback) {
  if (!result?.error) return result?.data || [];
  const error = new Error(result.error.message || fallback);
  error.code = result.error.code || '';
  throw error;
}

function rpcRow(result, fallback) {
  const data = throwQueryError(result, fallback);
  return Array.isArray(data) ? data[0] : data;
}

function throwClientReadError(result, message) {
  if (!result?.error) return result?.data || [];
  const error = new Error(message);
  error.code = result.error.code || '';
  throw error;
}

// Lectures client : ces requêtes utilisent uniquement la clé publique configurée
// dans supabaseClient. Les filtres réduisent le résultat, mais la propriété et la
// visibilité réelle restent décidées par les politiques RLS de chaque table.
export async function fetchClientDiagnostics(client, userId) {
  if (!userId) return [];
  const [ordersResult, bookingsResult, questionnairesResult, restitutionsResult] = await Promise.all([
    client.from('diagnostic_ia_orders')
      .select('id,user_id,status,paid_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client.from('diagnostic_ia_bookings')
      .select('id,order_id,user_id,starts_at,ends_at,timezone,status,completed_at')
      .eq('user_id', userId)
      .order('starts_at', { ascending: false }),
    client.from('diagnostic_ia_preparation_questionnaires')
      .select('id,booking_id,user_id,submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false }),
    client.from('diagnostic_ia_restitutions')
      .select('id,booking_id,user_id,status,published_at,corrected_at,retention_due_at')
      .eq('user_id', userId)
      .order('published_at', { ascending: false }),
  ]);

  const orders = throwClientReadError(ordersResult, 'Vos Diagnostics IA ne peuvent pas être chargés.');
  const bookings = throwClientReadError(bookingsResult, 'Vos Diagnostics IA ne peuvent pas être chargés.');
  const questionnaires = throwClientReadError(questionnairesResult, 'Vos Diagnostics IA ne peuvent pas être chargés.');
  const restitutions = throwClientReadError(restitutionsResult, 'Vos Diagnostics IA ne peuvent pas être chargés.');
  const bookingByOrder = new Map(bookings.map((item) => [item.order_id, item]));
  const questionnaireByBooking = new Map(questionnaires.map((item) => [item.booking_id, item]));
  const restitutionByBooking = new Map(restitutions.map((item) => [item.booking_id, item]));

  return orders
    .filter((order) => CLIENT_VISIBLE_ORDER_STATUSES.has(order.status))
    .map((order) => {
      const booking = bookingByOrder.get(order.id) || null;
      return {
        order,
        booking,
        questionnaire: booking ? questionnaireByBooking.get(booking.id) || null : null,
        restitution: booking ? restitutionByBooking.get(booking.id) || null : null,
      };
    });
}

export function getClientDiagnosticState(diagnostic) {
  const { order, booking, questionnaire, restitution } = diagnostic;
  if (!booking) {
    return order?.status === 'paid'
      ? { id: 'booking_required', title: 'Réservation à effectuer', action: 'book' }
      : { id: 'unavailable', title: 'Diagnostic indisponible', action: null };
  }
  if (booking.status === 'booking_pending') {
    return { id: 'booking_pending', title: 'Réservation en cours', action: null };
  }
  if (booking.status === 'cancelled') {
    return { id: 'cancelled', title: 'Rendez-vous annulé', action: null };
  }
  if (booking.status === 'booked' && !questionnaire) {
    return { id: 'questionnaire_required', title: 'Questionnaire à compléter', action: 'questionnaire' };
  }
  if (booking.status === 'booked') {
    return { id: 'scheduled', title: 'Rendez-vous prévu', action: null };
  }
  if (booking.status === 'completed' && restitution?.status === 'published') {
    return { id: 'published', title: 'Restitution disponible', action: 'restitution' };
  }
  if (booking.status === 'completed') {
    return { id: 'preparing', title: 'Restitution en préparation', action: null };
  }
  return { id: 'unavailable', title: 'Diagnostic indisponible', action: null };
}

export async function fetchPublishedDiagnosticRestitution(client, bookingId) {
  if (!DIAGNOSTIC_UUID_PATTERN.test(bookingId || '')) return null;
  const restitutionResult = await client.from('diagnostic_ia_restitutions')
    .select([
      'id', 'booking_id', 'status', 'published_at', 'corrected_at', 'retention_due_at',
      'overall_summary', 'observed_maturity_level', 'maturity_assessment', 'current_uses',
      'strengths', 'watch_points', 'priority_opportunities', 'recommendations',
      'short_term_actions', 'recommended_tool_families', 'privacy_rgpd_considerations',
      'ai_act_considerations', 'next_steps',
    ].join(','))
    .eq('booking_id', bookingId)
    .eq('status', 'published')
    .maybeSingle();
  const restitution = throwClientReadError(
    restitutionResult,
    'La restitution ne peut pas être chargée pour le moment.',
  );
  if (!restitution || Array.isArray(restitution)) return null;

  const bookingResult = await client.from('diagnostic_ia_bookings')
    .select('id,starts_at,ends_at,timezone,status,completed_at')
    .eq('id', bookingId)
    .maybeSingle();
  const booking = throwClientReadError(
    bookingResult,
    'La restitution ne peut pas être chargée pour le moment.',
  );
  if (!booking || Array.isArray(booking)) return null;
  return { ...restitution, booking };
}

export async function fetchDiagnosticAdministration(client) {
  const [bookingsResult, ordersResult, questionnairesResult, restitutionsResult] = await Promise.all([
    client.from('diagnostic_ia_bookings').select(
      'id,order_id,user_id,starts_at,ends_at,timezone,status,google_sync_status,google_meet_status,completed_at,created_at,updated_at',
    ).order('starts_at', { ascending: false }),
    client.from('diagnostic_ia_orders').select(
      'id,user_id,customer_email,status,sales_context,paid_at,created_at',
    ).order('created_at', { ascending: false }),
    client.from('diagnostic_ia_preparation_questionnaires').select(
      'id,booking_id,user_id,questionnaire_version,first_name,last_name,organization,job_title,sector,organization_size,tools_used,ai_level,repetitive_tasks,documents_handled,main_difficulty,diagnostic_goal,one_task_to_remove,submitted_at,retention_due_at',
    ).order('submitted_at', { ascending: false }),
    client.from('diagnostic_ia_restitutions').select('*').order('updated_at', { ascending: false }),
  ]);

  const bookings = throwQueryError(bookingsResult, 'Les réservations Diagnostic ne sont pas disponibles.');
  const orders = throwQueryError(ordersResult, 'Les commandes Diagnostic ne sont pas disponibles.');
  const questionnaires = throwQueryError(questionnairesResult, 'Les questionnaires Diagnostic ne sont pas disponibles.');
  const restitutions = throwQueryError(restitutionsResult, 'Les restitutions Diagnostic ne sont pas disponibles.');
  const orderById = new Map(orders.map((item) => [item.id, item]));
  const questionnaireByBooking = new Map(questionnaires.map((item) => [item.booking_id, item]));
  const restitutionByBooking = new Map(restitutions.map((item) => [item.booking_id, item]));

  return bookings.map((booking) => {
    const order = orderById.get(booking.order_id) || null;
    const questionnaire = questionnaireByBooking.get(booking.id) || null;
    const restitution = restitutionByBooking.get(booking.id) || null;
    const clientName = questionnaire
      ? `${questionnaire.first_name} ${questionnaire.last_name}`.trim()
      : order?.customer_email || 'Client non identifié';
    return { ...booking, order, questionnaire, restitution, clientName };
  });
}

export function filterDiagnostics(items, filter) {
  if (filter === 'to_complete') return items.filter((item) => item.status === 'booked');
  if (filter === 'to_write') return items.filter((item) => item.status === 'completed' && !item.restitution);
  if (filter === 'draft') return items.filter((item) => item.restitution?.status === 'draft');
  if (filter === 'published') return items.filter((item) => item.restitution?.status === 'published');
  return items;
}

export async function completeDiagnosticBooking(client, bookingId) {
  return rpcRow(await client.rpc('admin_complete_diagnostic_ia_booking', {
    p_booking_id: bookingId,
    p_completed_at: null,
  }), 'Le diagnostic ne peut pas être marqué comme réalisé.');
}

export async function saveDiagnosticRestitution(client, bookingId, expectedRevision, content) {
  return rpcRow(await client.rpc('admin_save_diagnostic_ia_restitution', {
    p_booking_id: bookingId,
    p_expected_revision: expectedRevision,
    p_content: content,
  }), 'Le brouillon ne peut pas être enregistré.');
}

export async function publishDiagnosticRestitution(client, restitutionId, expectedRevision) {
  return rpcRow(await client.rpc('admin_publish_diagnostic_ia_restitution', {
    p_restitution_id: restitutionId,
    p_expected_revision: expectedRevision,
  }), 'La restitution ne peut pas être publiée.');
}

export async function correctDiagnosticRestitution(client, restitutionId, expectedRevision, content, reason) {
  return rpcRow(await client.rpc('admin_correct_diagnostic_ia_restitution', {
    p_restitution_id: restitutionId,
    p_expected_revision: expectedRevision,
    p_content: content,
    p_reason: reason.trim(),
  }), 'La restitution publiée ne peut pas être corrigée.');
}

export function isRevisionConflict(error) {
  return error?.code === '40001' || /conflit de révision/i.test(error?.message || '');
}
