import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttestationDocument from './AttestationDocument';
import IssuedAttestationDocument from './IssuedAttestationDocument';
import { COURSE_ATTESTATION_CONFIG } from '../data/attestationConfig';
import { courseCatalog } from '../data/courseCatalog';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), insert: vi.fn(), navigate: vi.fn(),
  courseId: 'formation-prompt-level-1', documentType: 'realisation',
  reviewStatus: 'validated', signed: true,
  user: { id: 'admin-fictif' },
  historicalSnapshot: null,
  deliveryMode: 'remote', scheduleFormat: 'one_7h',
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: mocks.from } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: mocks.user, role: 'admin' }) }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ submissionId: '42', documentType: mocks.documentType, issuanceId: 'historique-fictif' }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../lib/courseBookingSlots', () => ({ groupBookedSessions: (sessions) => sessions }));

const session = { starts_at: '2026-07-01T08:00:00Z', ends_at: '2026-07-01T15:00:00Z' };
const originalConfig = { ...COURSE_ATTESTATION_CONFIG };

function responseFor(table) {
  const sessions = mocks.scheduleFormat === 'two_3h30' ? [
    { starts_at: '2026-07-01T08:00:00Z', ends_at: '2026-07-01T11:30:00Z' },
    { starts_at: '2026-07-02T08:00:00Z', ends_at: '2026-07-02T11:30:00Z' },
  ] : [session];
  const data = {
    course_final_project_latest_submissions: { id: 42, user_id: 'apprenant-fictif', course_id: mocks.courseId },
    course_final_project_review_history: { id: 7, review_status: mocks.reviewStatus },
    course_booking_requests: {
      id: 'reservation-fictive', status: 'completed', delivery_mode: mocks.deliveryMode, schedule_format: mocks.scheduleFormat,
      course_session_bookings: sessions,
      course_session_attendance: sessions.map((slot, index) => ({
        id: `presence-fictive-${index}`, booking_request_id: 'reservation-fictive',
        session_starts_at: slot.starts_at, session_ends_at: slot.ends_at,
        learner_confirmed_at: slot.starts_at, learner_signature_sha256: 'signature-fictive',
        trainer_status: sessions.length === 2 && index === 0 ? 'present' : 'partial',
        actual_ends_at: sessions.length === 2 ? (index === 0 ? slot.ends_at : '2026-07-02T11:00:00Z') : '2026-07-01T14:30:00Z',
        trainer_validated_at: slot.ends_at, trainer_signature_sha256: mocks.signed ? 'signature-fictive' : null,
        locked_at: slot.ends_at,
      })),
    },
    course_positioning_assessments: { learner_name: 'Camille Exemple Fictif' },
    profiles: { email: 'camille@example.invalid' },
    course_attestation_issuances: mocks.historicalSnapshot ? {
      id: 'historique-fictif', document_type: 'realisation', content_snapshot: mocks.historicalSnapshot,
      reference: 'FP-REA-2026-FICTIF00', issued_at: '2026-07-01T15:00:00Z',
    } : null,
  }[table];
  const query = {};
  ['select', 'eq', 'order', 'limit'].forEach((name) => { query[name] = vi.fn(() => query); });
  query.maybeSingle = vi.fn(async () => ({ data, error: null }));
  query.insert = mocks.insert.mockImplementation((payload) => ({
    select: () => ({ single: async () => ({ data: { id: 'simulation-locale' }, error: null }) }), payload,
  }));
  return query;
}

describe('AttestationDocument — simulations locales uniquement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.courseId = 'formation-prompt-level-1'; mocks.documentType = 'realisation';
    mocks.reviewStatus = 'validated'; mocks.signed = true;
    mocks.historicalSnapshot = null;
    mocks.deliveryMode = 'remote'; mocks.scheduleFormat = 'one_7h';
    mocks.from.mockImplementation(responseFor);
  });
  afterEach(() => {
    cleanup();
    Object.keys(COURSE_ATTESTATION_CONFIG).forEach((key) => { delete COURSE_ATTESTATION_CONFIG[key]; });
    Object.assign(COURSE_ATTESTATION_CONFIG, originalConfig);
  });

  it.each([undefined, null, {}, { objectives: undefined }, { objectives: null },
    { objectives: [] }, { objectives: 'Texte' }, { objectives: [1] }, { objectives: [null] },
    { objectives: ['Valide', ''] }, { objectives: [' \t\n'] },
    { objectives: ['\u0085\u00a0\u2003\u202f\u3000\ufeff'] },
  ])('bloque sans crash ni insertion la configuration invalide %j', async (config) => {
    COURSE_ATTESTATION_CONFIG[mocks.courseId] = config;
    render(<AttestationDocument />);
    expect(await screen.findByRole('status')).toHaveTextContent('objectifs pédagogiques absents ou invalides');
    const button = screen.getByRole('button', { name: /Délivrer et ouvrir/ });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith('course_attestation_issuances');
  });

  it.each(['formation-prompt-level-1', 'formation-ia', 'formation-ia-act'])('fige les objectifs du bon cours %s et la durée réellement suivie', async (courseId) => {
    mocks.courseId = courseId;
    render(<AttestationDocument />);
    await screen.findByText('Camille Exemple Fictif');
    const button = screen.getByRole('button', { name: /Délivrer et ouvrir/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(mocks.insert).toHaveBeenCalledOnce();
    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.content_snapshot.objectives).toEqual(originalConfig[courseId].objectives);
    expect(payload.content_snapshot.nature).toBe('Action de formation professionnelle');
    expect(payload.content_snapshot.courseTitle).toBe(courseCatalog[courseId].title);
    expect(payload.content_snapshot.period).toBe('Le 01 juillet 2026');
    expect(payload.content_snapshot.plannedMinutes).toBe(420);
    expect(payload.content_snapshot.attendedMinutes).toBe(390);
  });

  it('permet les compétences du Prompt avec une évaluation validée', async () => {
    mocks.documentType = 'competences';
    render(<AttestationDocument />);
    await screen.findByText('Camille Exemple Fictif');
    await userEvent.click(screen.getByRole('button', { name: /Délivrer et ouvrir/ }));
    expect(mocks.insert.mock.calls[0][0].content_snapshot.objectives).toEqual(originalConfig[mocks.courseId].objectives);
    expect(mocks.insert.mock.calls[0][0].review_id).toBe(7);
  });

  it.each([
    ['realisation', 'Attestation de réalisation', 'remote', 'Distanciel synchrone'],
    ['realisation', 'Attestation de réalisation', 'in_person', 'Présentiel'],
    ['competences', 'Attestation de compétences', 'remote', 'Distanciel synchrone'],
    ['competences', 'Attestation de compétences', 'in_person', 'Présentiel'],
  ])('affiche %s avec two_3h30 en %s et conserve les temps émargés', async (documentType, title, deliveryMode, label) => {
    mocks.documentType = documentType; mocks.deliveryMode = deliveryMode; mocks.scheduleFormat = 'two_3h30';
    render(<AttestationDocument />);
    expect(await screen.findByText(`${label} · 2 séances de 3 h30`)).toBeVisible();
    expect(screen.getByText(title, { selector: 'h1' })).toBeVisible();
    expect(screen.getByText('6 h 30 réellement suivie sur 7 h planifiées')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Délivrer et ouvrir/ }));
    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.content_snapshot.deliveryMode).toBe(`${label} · 2 séances de 3 h30`);
    expect(payload.content_snapshot.attendedMinutes).toBe(390);
    expect(payload.content_snapshot.plannedMinutes).toBe(420);
    expect(payload.content_snapshot.sessionCount).toBe(2);
    expect(payload.content_snapshot.objectives).toEqual(originalConfig[mocks.courseId].objectives);
    expect(payload.content_snapshot.objectives).toHaveLength(6);
  });

  it('maintient le blocage de compétences sans évaluation validée', async () => {
    mocks.documentType = 'competences'; mocks.reviewStatus = 'needs_revision';
    render(<AttestationDocument />);
    expect(await screen.findByRole('status')).toHaveTextContent('évaluation finale validée');
    expect(screen.getByRole('button', { name: /Délivrer et ouvrir/ })).toBeDisabled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('maintient le blocage de réalisation sans signature formateur', async () => {
    mocks.signed = false;
    render(<AttestationDocument />);
    expect(await screen.findByRole('status')).toHaveTextContent('émargements');
    expect(screen.getByRole('button', { name: /Délivrer et ouvrir/ })).toBeDisabled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('affiche le snapshot historique fictif sans le recalculer ni le réécrire', async () => {
    mocks.historicalSnapshot = {
      title: 'Attestation de réalisation', learnerName: 'Camille Historique Fictif',
      courseTitle: 'Titre historique figé', nature: 'Nature historique figée', objectives: [],
      attendedMinutes: 360, plannedMinutes: 420, organization: {}, traceability: {},
      deliveryMode: 'Modalité historique figée · two_3h30',
    };
    COURSE_ATTESTATION_CONFIG[mocks.courseId] = { objectives: ['Objectif actuel différent'] };
    render(<IssuedAttestationDocument />);
    expect(await screen.findByText('Titre historique figé')).toBeVisible();
    expect(screen.getByText('Nature historique figée')).toBeVisible();
    expect(screen.getByText('Modalité historique figée · two_3h30')).toBeVisible();
    expect(screen.getByText('6 h réellement suivie sur 7 h planifiées')).toBeVisible();
    expect(screen.queryByText(/2 séances de 3 h30/)).not.toBeInTheDocument();
    expect(screen.queryByText('Objectif actuel différent')).not.toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
