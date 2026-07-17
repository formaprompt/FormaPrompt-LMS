import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttestationSnapshot, formatAttestationDeliveryMode } from './attestationSnapshot.js';

test('formate les trois rythmes de la formation IA générative', () => {
  assert.equal(
    formatAttestationDeliveryMode({ delivery_mode: 'remote', schedule_format: 'three_4h_4h_2h' }),
    'Distanciel synchrone · 3 séances : 4 h + 4 h + 2 h',
  );
  assert.equal(
    formatAttestationDeliveryMode({ delivery_mode: 'in_person', schedule_format: 'two_5h' }),
    'Présentiel · 2 séances de 5 h',
  );
});

test('fige uniquement les informations utiles au document et à sa traçabilité', () => {
  const snapshot = createAttestationSnapshot({
    documentType: 'competences',
    record: {
      learnerName: 'Camille Exemple',
      learnerEmail: 'information-a-ne-pas-copier@example.com',
      submission: { id: 42, course_id: 'formation-ia' },
      review: {
        id: 7,
        review_status: 'validated',
        appreciation: 'Compétences acquises.',
        improvement_areas: 'Poursuivre la vérification des sources.',
      },
    },
    documentData: {
      course: { title: 'Formation IA Générative' },
      booking: { id: 'booking-1', delivery_mode: 'remote', schedule_format: 'four_2h30' },
      dossier: {
        attendedMinutes: 600,
        plannedMinutes: 600,
        sessionCount: 4,
        sessionProofs: [{
          attendanceId: 'attendance-1',
          startsAt: '2026-07-01T08:00:00Z',
          endsAt: '2026-07-01T10:30:00Z',
        }],
      },
      criteria: [{ id: 'need', label: 'Besoin', level: 'Acquis' }],
      attestationConfig: { nature: 'Action de formation', objectives: ['Comprendre les usages.'] },
    },
  });

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.learnerName, 'Camille Exemple');
  assert.equal(snapshot.evaluation.statusLabel, 'Compétences évaluées et validées');
  assert.deepEqual(snapshot.traceability.attendanceIds, ['attendance-1']);
  assert.equal(JSON.stringify(snapshot).includes('information-a-ne-pas-copier@example.com'), false);
});
