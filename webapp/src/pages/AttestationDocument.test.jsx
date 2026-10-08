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
  const data = {
    course_final_project_latest_submissions: { id: 42, user_id: 'apprenant-fictif', course_id: mocks.courseId },
    course_final_project_review_history: { id: 7, review_status: mocks.reviewStatus },
    course_booking_requests: {
      id: 'reservation-fictive', status: 'completed', delivery_mode: 'remote', schedule_format: 'one_7h',
      course_session_bookings: [session],
      course_session_attendance: [{
        id: 'presence-fictive', booking_request_id: 'reservation-fictive',
        session_starts_at: session.starts_at, session_ends_at: session.ends_at,
        learner_confirmed_at: session.starts_at, learner_signature_sha256: 'signature-fictive',
        trainer_status: 'partial', actual_ends_at: '2026-07-01T14:30:00Z',
        trainer_validated_at: session.ends_at, trainer_signature_sha256: mocks.signed ? 'signature-fictive' : null,
        locked_at: session.ends_at,
      }],
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
    };
    COURSE_ATTESTATION_CONFIG[mocks.courseId] = { objectives: ['Objectif actuel différent'] };
    render(<IssuedAttestationDocument />);
    expect(await screen.findByText('Titre historique figé')).toBeVisible();
    expect(screen.getByText('Nature historique figée')).toBeVisible();
    expect(screen.queryByText('Objectif actuel différent')).not.toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
