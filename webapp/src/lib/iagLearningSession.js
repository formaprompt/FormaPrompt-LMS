import { IAG_LESSONS, validateIagCourse, validateIagProgress } from './iagLearningApi.js';

export function resumeIagLesson(progress) {
  const rows = [...progress.lessons].filter(row => Number.isFinite(Date.parse(row.lastViewedAt)));
  rows.sort((a,b) => Date.parse(b.lastViewedAt) - Date.parse(a.lastViewedAt) || IAG_LESSONS.indexOf(a.lessonId) - IAG_LESSONS.indexOf(b.lessonId));
  return rows[0]?.lessonId || IAG_LESSONS[0];
}
// Used by the actual reader. No storage of content, signed URLs or client completion truth.
export function createIagLearningSession({ api, ownerId, onState }) {
  let alive = true, serial = 0;
  let state = { ownerId, phase: 'idle', course: null, progress: null, lessonId: null, document: null, anchorId: null, error: '' };
  const emit = change => { if (alive) { state = { ...state, ...change }; onState(state); } };
  const current = turn => alive && turn === serial;
  const failed = (turn, error) => { if (current(turn)) emit({ phase: 'error', document: null, error: error.message || 'Lecture indisponible. Réessayez.' }); };
  async function readLesson(lessonId, documentId, anchorId = null) {
    const turn = ++serial;
    emit({ phase: 'loading-document', document: null, lessonId, anchorId: null, error: '' });
    try {
      const [document, progress] = await Promise.all([api.document(lessonId, documentId), api.progress('view', lessonId)]);
      if (current(turn)) emit({ phase: 'ready', document, progress: validateIagProgress(progress), anchorId, error: '' });
    } catch (error) { failed(turn, error); }
  }
  return {
    snapshot: () => state,
    async load(preferredLesson = null) {
      const turn = ++serial;
      emit({ phase: 'loading', course: null, document: null, progress: null, error: '' });
      try {
        const [courseValue, progressValue] = await Promise.all([api.loadCourse(), api.progress()]);
        if (!current(turn)) return;
        const course = validateIagCourse(courseValue), progress = validateIagProgress(progressValue);
        const lessonId = IAG_LESSONS.includes(preferredLesson) ? preferredLesson : resumeIagLesson(progress);
        emit({ course, progress });
        await readLesson(lessonId, course.modules.find(item => item.id === lessonId).lesson.contentDocumentId);
      } catch (error) { failed(turn, error); }
    },
    async select(lessonId) {
      if (!state.course || !IAG_LESSONS.includes(lessonId)) return;
      const module = state.course.modules.find(item => item.id === lessonId);
      await readLesson(lessonId, module.lesson.contentDocumentId);
    },
    async openDocument(documentId, anchorId = null) {
      const document = state.course?.structuredContent.documents[documentId];
      if (!document || (anchorId !== null && !/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(anchorId))) return;
      const lessonId = !document.lessonIds?.length || document.lessonIds.includes(state.lessonId)
        ? state.lessonId : document.lessonIds.find(id => IAG_LESSONS.includes(id));
      if (lessonId) await readLesson(lessonId, documentId, anchorId);
    },
    async complete() {
      if (state.phase !== 'ready' || !state.lessonId) return;
      const turn = ++serial, lessonId = state.lessonId;
      emit({ phase: 'saving', error: '' });
      try {
        const progress = validateIagProgress(await api.progress('complete', lessonId));
        if (current(turn)) emit({ phase: 'ready', progress, error: '' });
      } catch (error) { failed(turn, error); }
    },
    dispose() { alive = false; serial += 1; state = { ownerId, phase: 'disposed', course: null, progress: null, lessonId: null, document: null, error: '' }; },
  };
}
