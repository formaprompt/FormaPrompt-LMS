import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CourseCohorts.css';
import { createHalfDayChoices, findChoiceForSlotIds, formatRange, parisDate } from './courseCohortRangeChoices';

const FORMATS = [{ id: 'four_half_days_3h30', label: '4 demi-journées de 3 h 30' }, { id: 'two_days_2x3h30', label: '2 jours de 7 h (2 × 3 h 30 par jour)' }];
const STATUS_LABELS = { draft: 'Brouillon', published: 'Publiée', confirmed: 'Confirmée', cancelled: 'Annulée' };
const emptyDraft = () => ({ course_id: '', delivery_mode: '', schedule_format: '', capacity: '', minimum_participants: '', sessions: Array.from({ length: 4 }, (_, position) => ({ position: position + 1, slot_ids: [] })) });
const sessionName = (format, index) => format === 'two_days_2x3h30' ? `${index < 2 ? 'Jour 1' : 'Jour 2'} · ${index % 2 === 0 ? '1re plage' : '2e plage'}` : `Demi-journée ${index + 1}`;
const rangesOverlap = (first, second) => new Date(first.starts_at) < new Date(second.ends_at) && new Date(second.starts_at) < new Date(first.ends_at);
const parisMonth = (value) => parisDate(value).slice(0, 7);
const currentParisMonth = () => parisMonth(new Date().toISOString());
const monthLabel = (month) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(`${month}-15T12:00:00Z`));
const uniqueSlots = (slots) => [...new Map(slots.map((slot) => [slot.id, slot])).values()];

export default function AdminCourseCohorts({ courseOptions = [], cohorts = [], availableSlots = [], saving = false, error = '', onLoadAvailabilityMonth, onSaveDraft, onPublish, onConfirm, onCancel, onSetMeetingUrl, onGenerateMeetingLinks, onCleanupMeetingEvents }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [feedback, setFeedback] = useState('');
  const [cancellationReasons, setCancellationReasons] = useState({});
  const [meetingUrls, setMeetingUrls] = useState({});
  const [meetingGeneration, setMeetingGeneration] = useState({});
  const [runningAction, setRunningAction] = useState('');
  const [editableSessions, setEditableSessions] = useState([]);
  const [dayDates, setDayDates] = useState(['', '']);
  const [calendarMonths, setCalendarMonths] = useState(() => Array(4).fill(onLoadAvailabilityMonth || availableSlots.length === 0 ? currentParisMonth() : parisMonth(availableSlots[0].starts_at)));
  const [slotsByMonth, setSlotsByMonth] = useState({});
  const [loadingMonths, setLoadingMonths] = useState({});
  const [monthErrors, setMonthErrors] = useState({});
  const loadedMonths = useRef(new Set());
  const requestVersions = useRef({});
  const mounted = useRef(true);
  const suppliedSlotsByMonth = useMemo(() => availableSlots.reduce((result, slot) => {
    const month = parisMonth(slot.starts_at);
    result[month] = [...(result[month] || []), slot];
    return result;
  }, {}), [availableSlots]);
  const loadMonth = useCallback(async (month) => {
    if (!onLoadAvailabilityMonth || loadedMonths.current.has(month)) return;
    const version = (requestVersions.current[month] || 0) + 1;
    requestVersions.current[month] = version;
    setLoadingMonths((current) => ({ ...current, [month]: true }));
    setMonthErrors((current) => ({ ...current, [month]: '' }));
    try {
      const slots = await onLoadAvailabilityMonth(month);
      if (!mounted.current || requestVersions.current[month] !== version) return;
      loadedMonths.current.add(month);
      setSlotsByMonth((current) => ({ ...current, [month]: uniqueSlots(Array.isArray(slots) ? slots : []) }));
    } catch (loadError) {
      if (!mounted.current || requestVersions.current[month] !== version) return;
      setMonthErrors((current) => ({ ...current, [month]: loadError?.message || 'Les disponibilités de ce mois ne peuvent pas être chargées.' }));
    } finally {
      if (mounted.current && requestVersions.current[month] === version) setLoadingMonths((current) => ({ ...current, [month]: false }));
    }
  }, [onLoadAvailabilityMonth]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!onLoadAvailabilityMonth) return;
    [...new Set(calendarMonths)].forEach((month) => { loadMonth(month); });
  }, [calendarMonths, loadMonth, onLoadAvailabilityMonth]);
  useEffect(() => {
    if (!onLoadAvailabilityMonth) return;
    setSlotsByMonth((current) => Object.fromEntries(Object.entries(current).map(([month, slots]) => [
      month,
      suppliedSlotsByMonth[month] ? uniqueSlots([...slots, ...suppliedSlotsByMonth[month]]) : slots,
    ])));
  }, [onLoadAvailabilityMonth, suppliedSlotsByMonth]);
  const allAvailableSlots = useMemo(() => onLoadAvailabilityMonth
    ? uniqueSlots(Object.values(slotsByMonth).flat())
    : availableSlots, [availableSlots, onLoadAvailabilityMonth, slotsByMonth]);
  const choices = useMemo(() => createHalfDayChoices(allAvailableSlots, draft.delivery_mode, editableSessions), [allAvailableSlots, draft.delivery_mode, editableSessions]);
  const selectedChoices = useMemo(() => draft.sessions.map((session) => findChoiceForSlotIds(choices, session.slot_ids)), [choices, draft.sessions]);
  const selectedSlotIds = useMemo(() => new Set(draft.sessions.flatMap((session) => session.slot_ids)), [draft.sessions]);
  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const resetSchedule = (field, value) => { setEditableSessions([]); setDayDates(['', '']); setCalendarMonths((current) => Array(4).fill(onLoadAvailabilityMonth ? currentParisMonth() : current[0])); setDraft((current) => ({ ...current, [field]: value, sessions: emptyDraft().sessions })); };
  const editDraft = (cohort) => {
    const sessions = Array.from({ length: 4 }, (_, index) => {
      const session = cohort.sessions?.find((item) => Number(item.position) === index + 1);
      return { position: index + 1, slot_ids: Array.isArray(session?.slot_ids) ? session.slot_ids : [], starts_at: session?.starts_at, ends_at: session?.ends_at };
    });
    setDraft({ id: cohort.id, course_id: cohort.course_id || '', delivery_mode: cohort.delivery_mode || '', schedule_format: cohort.schedule_format || '', capacity: String(cohort.capacity ?? ''), minimum_participants: String(cohort.minimum_participants ?? ''), sessions });
    setEditableSessions(sessions);
    setDayDates([sessions[0]?.starts_at ? parisDate(sessions[0].starts_at) : '', sessions[2]?.starts_at ? parisDate(sessions[2].starts_at) : '']);
    setCalendarMonths(sessions.map((session) => session?.starts_at ? parisMonth(session.starts_at) : currentParisMonth()));
    setFeedback('Brouillon chargé. Ses plages déjà réservées restent modifiables.');
  };
  const selectRange = (sessionIndex, choiceId) => {
    const choice = choices.find((item) => item.id === choiceId);
    if (!choice) return;
    setDraft((current) => ({ ...current, sessions: current.sessions.map((session, index) => index === sessionIndex ? { position: session.position, slot_ids: choice.slotIds, starts_at: choice.starts_at, ends_at: choice.ends_at } : session) }));
  };
  const selectDayDate = (dayIndex, value) => {
    setDayDates((current) => current.map((date, index) => index === dayIndex ? value : date));
    setDraft((current) => ({ ...current, sessions: current.sessions.map((session, index) => (index === dayIndex * 2 || index === dayIndex * 2 + 1) ? { position: session.position, slot_ids: [] } : session) }));
  };
  const setCalendarMonth = (indexes, month) => {
    setCalendarMonths((current) => current.map((value, index) => indexes.includes(index) ? month : value));
    if (indexes.length === 2) setDayDates((current) => current.map((date, index) => indexes.includes(index * 2) ? '' : date));
  };
  const validateDraft = () => {
    const capacity = Number(draft.capacity); const minimum = Number(draft.minimum_participants);
    if (!draft.course_id || !draft.delivery_mode || !draft.schedule_format) return 'Choisissez la formation, le mode de réalisation et le format de 14 heures.';
    if (!Number.isInteger(capacity) || capacity <= 0 || !Number.isInteger(minimum) || minimum <= 0 || minimum > capacity) return 'Saisissez une capacité et un seuil minimum valides.';
    if (selectedChoices.some((choice) => !choice)) return 'Choisissez une plage complète de 3 h 30 pour chacune des quatre demi-journées.';
    if (selectedSlotIds.size !== 28) return 'Une plage ne peut pas chevaucher une autre demi-journée.';
    if (selectedChoices.some((choice, index) => selectedChoices.some((other, otherIndex) => index !== otherIndex && rangesOverlap(choice, other)))) return 'Deux demi-journées ne peuvent pas se chevaucher.';
    if (draft.schedule_format === 'four_half_days_3h30' && new Set(selectedChoices.map((choice) => parisDate(choice.starts_at))).size !== 4) return 'Le format choisi exige quatre demi-journées sur quatre dates distinctes.';
    if (draft.schedule_format === 'two_days_2x3h30') {
      for (const index of [0, 2]) {
        const first = selectedChoices[index]; const second = selectedChoices[index + 1];
        if (parisDate(first.starts_at) !== parisDate(second.starts_at) || new Date(second.starts_at) <= new Date(first.ends_at)) return 'Chaque jour doit réunir deux plages de 3 h 30 séparées par une pause.';
      }
      if (new Date(selectedChoices[0].starts_at) >= new Date(selectedChoices[2].starts_at)) return 'Le Jour 1 doit précéder le Jour 2.';
    }
    return '';
  };
  const saveDraft = async (event) => { event.preventDefault(); const validationError = validateDraft(); setFeedback(validationError); if (validationError) return; const sessions = [...draft.sessions].sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at)).map((session, index) => ({ position: index + 1, slot_ids: session.slot_ids })); setRunningAction('save'); try { await onSaveDraft?.({ ...draft, sessions, capacity: Number(draft.capacity), minimum_participants: Number(draft.minimum_participants) }); } catch (saveError) { setFeedback(saveError?.message || 'Le brouillon ne peut pas être enregistré pour le moment.'); } finally { setRunningAction(''); } };
  const runAction = async (action, cohortId, callback, ...args) => { setFeedback(''); setRunningAction(`${action}:${cohortId}`); try { await callback?.(cohortId, ...args); } catch (actionError) { setFeedback(actionError?.message || 'Cette action ne peut pas être enregistrée pour le moment.'); } finally { setRunningAction(''); } };
  const saveMeetingUrl = async (cohortId, sessionId) => { const key = `${cohortId}:${sessionId}`; const session = cohorts.find((item) => item.id === cohortId)?.sessions?.find((item) => item.id === sessionId); const meetingUrl = meetingUrls[key] ?? session?.meeting_url ?? ''; try { if (new URL(meetingUrl).protocol !== 'https:') throw new Error(); } catch { setFeedback('Saisissez une adresse HTTPS valide pour la visioconférence.'); return; } await runAction('meeting', cohortId, onSetMeetingUrl, sessionId, meetingUrl); };
  const generateMeetingLinks = async (cohortId) => {
    if (runningAction === `meeting-links:${cohortId}`) return;
    setFeedback(''); setRunningAction(`meeting-links:${cohortId}`);
    try {
      const result = await onGenerateMeetingLinks?.(cohortId);
      setMeetingGeneration((current) => ({ ...current, [cohortId]: result || { complete: false, sessions: [] } }));
      setMeetingUrls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${cohortId}:`))));
      setFeedback(result?.complete ? 'Tous les liens de visioconférence sont prêts.' : 'Certains liens Google Meet restent à générer. Vous pouvez réessayer.');
    } catch {
      setFeedback('Les liens Google Meet ne peuvent pas être générés pour le moment. Vous pouvez réessayer.');
    } finally { setRunningAction(''); }
  };
  const cleanupMeetingEvents = async (cohortId) => {
    if (runningAction === `meeting-cleanup:${cohortId}`) return;
    setFeedback(''); setRunningAction(`meeting-cleanup:${cohortId}`);
    try { const result = await onCleanupMeetingEvents?.(cohortId); setMeetingGeneration((current) => ({ ...current, [`cleanup:${cohortId}`]: result || { complete: false, sessions: [] } })); setFeedback(result?.complete ? 'Les événements Google Meet sont nettoyés.' : 'Certains événements restent à nettoyer. Vous pouvez réessayer.'); } catch { setFeedback('Les événements Google Meet ne peuvent pas être nettoyés pour le moment. Vous pouvez réessayer.'); } finally { setRunningAction(''); }
  };
  const cohortDates = (cohort) => {
    const sessions = [...(cohort.sessions || [])].sort((first, second) => first.position - second.position);
    const result = meetingGeneration[cohort.id]; const cleanup = meetingGeneration[`cleanup:${cohort.id}`];
    const canGenerate = cohort.delivery_mode === 'remote' && ['published', 'confirmed'].includes(cohort.status) && sessions.some((session) => !session.meeting_url);
    if (sessions.length === 0) return 'Dates non disponibles';
    const cleanupNeeded = cohort.status === 'cancelled' && sessions.some((session) => ['delete_pending', 'delete_error'].includes(session.google_sync_status));
    return <><span className="admin-course-cohorts__session-list">{sessions.map((session) => <span className="admin-course-cohorts__session-line" key={session.id || session.position}><span>Séance {session.position}</span><strong>{formatRange(session)}</strong>{result?.sessions?.find((item) => item.session_id === session.id) && <em>{({ existing: 'Lien déjà présent', created: 'Lien créé', recovered: 'Lien retrouvé', pending: 'À réessayer', failed: 'À réessayer' })[result.sessions.find((item) => item.session_id === session.id).status] || 'À vérifier'}</em>}</span>)}</span>{cohort.delivery_mode === 'remote' && cohort.status === 'draft' && <span className="admin-course-cohorts__meet-note">Publiez la cohorte pour générer ses liens Google Meet.</span>}{canGenerate && <button className="btn admin-course-cohorts__meet-generate" type="button" disabled={Boolean(runningAction)} onClick={() => generateMeetingLinks(cohort.id)}>{runningAction === `meeting-links:${cohort.id}` ? 'Génération des liens…' : 'Générer les liens Google Meet'}</button>}{cleanupNeeded && <button className="btn admin-course-cohorts__meet-generate" type="button" disabled={Boolean(runningAction)} onClick={() => cleanupMeetingEvents(cohort.id)}>{runningAction === `meeting-cleanup:${cohort.id}` ? 'Nettoyage…' : 'Réessayer le nettoyage Google Meet'}</button>}{result && <span className="admin-course-cohorts__meet-result" role="status">{result.complete ? 'Tous les liens de visioconférence sont prêts.' : 'Génération partielle : les séances indiquées « À réessayer » peuvent être relancées.'}</span>}{cleanup && <span className="admin-course-cohorts__meet-result" role="status">{cleanup.complete ? 'Les événements Google Meet sont nettoyés.' : 'Nettoyage partiel : vous pouvez réessayer.'}</span>}</>;
  };
  const monthPicker = (indexes, label) => {
    const month = calendarMonths[indexes[0]];
    const errorForMonth = monthErrors[month];
    return <div className="admin-course-cohorts__month-picker"><label>{label}<input aria-label={label} type="month" value={month} onChange={(event) => setCalendarMonth(indexes, event.target.value)} /></label>{loadingMonths[month] && <span role="status">Chargement des disponibilités de {monthLabel(month)}…</span>}{errorForMonth && <span role="alert">{errorForMonth} Consultez l’onglet Mes disponibilités, puis réessayez.</span>}</div>;
  };
  const rangePicker = (index, date = '') => {
    const selected = selectedChoices[index]; const name = sessionName(draft.schedule_format, index);
    const month = calendarMonths[index];
    const currentChoices = choices.filter((choice) => parisMonth(choice.starts_at) === month && (!date || parisDate(choice.starts_at) === date));
    const visibleChoices = selected && !currentChoices.some((choice) => choice.id === selected.id) ? [selected, ...currentChoices] : currentChoices;
    const selectionMonthChanged = selected && parisMonth(selected.starts_at) !== month;
    return <div className="admin-course-cohorts__range" key={index}><label htmlFor={`cohort-range-${index}`}>{name} · 3 h 30</label>{monthPicker([index], `Mois à consulter — ${name}`)}<select id={`cohort-range-${index}`} aria-label={`${name} · plage de 3 h 30`} value={selected?.id || ''} onChange={(event) => selectRange(index, event.target.value)} disabled={!draft.delivery_mode || (draft.schedule_format === 'two_days_2x3h30' && !date)}><option value="">Choisir une plage disponible</option>{visibleChoices.map((choice) => { const conflicts = choice.slotIds.some((id) => selectedSlotIds.has(id) && !selected?.slotIds.includes(id)) || selectedChoices.some((other, otherIndex) => other && otherIndex !== index && rangesOverlap(choice, other)); return <option key={choice.id} value={choice.id} disabled={conflicts}>{formatRange(choice)}{choice.existing ? ' (plage du brouillon)' : selectionMonthChanged && choice.id === selected?.id ? ' (sélection conservée)' : ''}</option>; })}</select>{selected && <span className="admin-course-cohorts__range-summary">{selectionMonthChanged ? `Sélection conservée : ${formatRange(selected)}` : `${formatRange(selected)} · 3 h 30`}</span>}</div>;
  };
  const dayDatePicker = (dayIndex) => {
    const unavailable = dayDates[1 - dayIndex];
    const month = calendarMonths[dayIndex * 2];
    const dates = choices.filter((choice) => parisMonth(choice.starts_at) === month).reduce((items, choice) => items.some((item) => item.date === parisDate(choice.starts_at)) ? items : [...items, { date: parisDate(choice.starts_at), label: new Date(choice.starts_at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) }], []).filter(({ date }) => (!unavailable || (dayIndex === 0 ? date < unavailable : date > unavailable)));
    const currentDate = dayDates[dayIndex];
    const visibleDates = currentDate && !dates.some(({ date }) => date === currentDate) ? [{ date: currentDate, label: `${new Date(`${currentDate}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} (sélection conservée)` }, ...dates] : dates;
    return <><div className="admin-course-cohorts__day-month">{monthPicker([dayIndex * 2, dayIndex * 2 + 1], `Mois à consulter — Jour ${dayIndex + 1}`)}</div><label className="admin-course-cohorts__day-date">Date<select aria-label={`Date Jour ${dayIndex + 1}`} value={currentDate} onChange={(event) => selectDayDate(dayIndex, event.target.value)}><option value="">Choisir une date disponible</option>{visibleDates.map(({ date, label }) => <option key={date} value={date}>{label}</option>)}</select></label></>;
  };
  return <section className="admin-course-cohorts" aria-labelledby="admin-course-cohorts-title">
    <header><p className="course-cohorts__eyebrow">Formation inter-entreprises</p><h2 id="admin-course-cohorts-title">Cohortes inter</h2><p>Choisissez uniquement parmi les plages complètes déjà disponibles. Les dates, les seuils et les disponibilités ne sont pas créés automatiquement.</p></header>
    {(error || feedback) && <p className="course-cohorts__message course-cohorts__message--error" role="alert">{feedback || error}</p>}
    <form className="admin-course-cohorts__form" onSubmit={saveDraft}>
      <label>Formation<select value={draft.course_id} onChange={(event) => updateDraft('course_id', event.target.value)} required><option value="">Choisir une formation</option>{courseOptions.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}</select></label>
      <fieldset className="admin-course-cohorts__delivery"><legend>Mode de réalisation</legend><label><input type="radio" name="delivery-mode" value="remote" checked={draft.delivery_mode === 'remote'} onChange={(event) => resetSchedule('delivery_mode', event.target.value)} required /> À distance</label><label><input type="radio" name="delivery-mode" value="in_person" checked={draft.delivery_mode === 'in_person'} onChange={(event) => resetSchedule('delivery_mode', event.target.value)} /> En présentiel</label></fieldset>
      <label>Format<select value={draft.schedule_format} onChange={(event) => resetSchedule('schedule_format', event.target.value)} required><option value="">Choisir le format</option>{FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
      <label>Capacité maximale<input type="number" min="1" step="1" value={draft.capacity} onChange={(event) => updateDraft('capacity', event.target.value)} required /></label><label>Seuil minimum de participants<input type="number" min="1" step="1" value={draft.minimum_participants} onChange={(event) => updateDraft('minimum_participants', event.target.value)} required /></label>
      <div className="admin-course-cohorts__sessions"><h3>{draft.schedule_format === 'two_days_2x3h30' ? 'Composer les 2 jours · 14 h' : 'Composer les 4 demi-journées · 14 h'}</h3>{!draft.delivery_mode ? <p>Choisissez d’abord le mode de réalisation.</p> : draft.schedule_format === 'two_days_2x3h30' ? <div className="admin-course-cohorts__day-grid"><fieldset><legend>Jour 1</legend>{dayDatePicker(0)}{rangePicker(0, dayDates[0])}{rangePicker(1, dayDates[0])}</fieldset><fieldset><legend>Jour 2</legend>{dayDatePicker(1)}{rangePicker(2, dayDates[1])}{rangePicker(3, dayDates[1])}</fieldset></div> : <div className="admin-course-cohorts__range-grid">{[0, 1, 2, 3].map((index) => rangePicker(index))}</div>}<p className="admin-course-cohorts__availability-note">Aucune disponibilité n’est créée ici. Si le mois est vide, ajoutez d’abord des plages dans Mes disponibilités.</p><p className="admin-course-cohorts__total">4 plages de 3 h 30 · total 14 h</p></div>
      <div className="admin-course-cohorts__draft-actions"><button className="btn btn-primary" type="submit" disabled={saving || runningAction === 'save'}>{saving || runningAction === 'save' ? 'Enregistrement…' : draft.id ? 'Mettre à jour le brouillon' : 'Enregistrer le brouillon'}</button>{draft.id && <button className="btn" type="button" disabled={Boolean(runningAction)} onClick={() => { setEditableSessions([]); setDayDates(['', '']); setDraft(emptyDraft()); setFeedback('Modification du brouillon annulée.'); }}>Annuler la modification</button>}</div>
    </form>
    <div className="admin-course-cohorts__list"><h3>Cohortes existantes</h3>{cohorts.length === 0 ? <p>Aucune cohorte n’est encore créée.</p> : cohorts.map((cohort) => { const terminal = ['cancelled', 'completed'].includes(cohort.status); return <article key={cohort.id}><header><strong>{courseOptions.find((course) => course.id === cohort.course_id)?.label || cohort.course_id}</strong><span>{STATUS_LABELS[cohort.status] || cohort.status}</span></header><p>{cohortDates(cohort)}</p><p>{cohort.delivery_mode === 'remote' ? 'À distance' : cohort.delivery_mode === 'in_person' ? 'En présentiel' : 'Mode non renseigné'}</p><p>{cohort.enrolled_count || 0}/{cohort.capacity} inscrit{Number(cohort.enrolled_count) > 1 ? 's' : ''} · seuil {cohort.minimum_participants}</p>{cohort.delivery_mode === 'remote' && !terminal && (cohort.sessions || []).filter((session) => session.id).map((session) => { const key = `${cohort.id}:${session.id}`; return <div className="admin-course-cohorts__meeting" key={key}><label>Visioconférence — séance {session.position}<input type="url" inputMode="url" placeholder="https://…" value={meetingUrls[key] ?? session.meeting_url ?? ''} onChange={(event) => setMeetingUrls((current) => ({ ...current, [key]: event.target.value }))} /></label><button className="btn" type="button" disabled={Boolean(runningAction)} onClick={() => saveMeetingUrl(cohort.id, session.id)}>{runningAction === `meeting:${cohort.id}` ? 'Enregistrement…' : 'Enregistrer le lien'}</button></div>; })}{cohort.status === 'draft' && <div className="admin-course-cohorts__draft-actions"><button className="btn" type="button" disabled={Boolean(runningAction)} onClick={() => editDraft(cohort)}>Modifier</button><button className="btn" type="button" disabled={Boolean(runningAction)} onClick={() => runAction('publish', cohort.id, onPublish)}>{runningAction === `publish:${cohort.id}` ? 'Publication…' : 'Publier'}</button></div>}{cohort.status === 'published' && <button className="btn" type="button" disabled={Boolean(runningAction)} onClick={() => runAction('confirm', cohort.id, onConfirm)}>{runningAction === `confirm:${cohort.id}` ? 'Confirmation…' : 'Confirmer'}</button>}{!terminal && <div className="admin-course-cohorts__cancel"><label>Motif d’annulation<input value={cancellationReasons[cohort.id] || ''} onChange={(event) => setCancellationReasons((current) => ({ ...current, [cohort.id]: event.target.value }))} /></label><button className="btn" type="button" disabled={!cancellationReasons[cohort.id]?.trim() || Boolean(runningAction)} onClick={() => runAction('cancel', cohort.id, onCancel, cancellationReasons[cohort.id].trim())}>{runningAction === `cancel:${cohort.id}` ? 'Annulation…' : 'Annuler la cohorte'}</button></div>}</article>; })}</div>
  </section>;
}
