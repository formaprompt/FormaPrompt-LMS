import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_ATTESTATION_CONFIG } from '../data/attestationConfig.js';
import { createAttestationSnapshot, formatAttestationDeliveryMode, hasValidAttestationObjectives } from './attestationSnapshot.js';

test('refuse une configuration absente ou des objectifs non textuels, vides ou blancs Unicode', () => {
  const configs = [undefined, null, {}, { objectives: undefined }, { objectives: null },
    { objectives: [] }, { objectives: 'texte' }, { objectives: [null] }, { objectives: [1] },
    { objectives: ['Valide', ''] }, { objectives: [' \t\n'] }, { objectives: Array(1) },
    { objectives: ['\u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'] }];
  for (const attestationConfig of configs) {
    assert.equal(hasValidAttestationObjectives(attestationConfig), false);
    assert.equal(createAttestationSnapshot({ documentType: 'realisation', record: {}, documentData: { attestationConfig } }), null);
  }
  assert.equal(hasValidAttestationObjectives({ objectives: ['  Un objectif.  '] }), true);
});

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

test('les trois formations conservent leurs six objectifs pour les deux types de document', () => {
  for (const courseId of ['formation-prompt-level-1', 'formation-ia', 'formation-ia-act']) {
    const config = COURSE_ATTESTATION_CONFIG[courseId];
    assert.ok(config, `Configuration ${courseId}`);
    assert.equal(config.objectives.length, 6);
    for (const documentType of ['realisation', 'competences']) {
      const snapshot = createAttestationSnapshot({
        documentType,
        record: { learnerName: 'Camille Fictif', submission: { id: 1, course_id: courseId }, review: { id: 1, review_status: 'validated' } },
        documentData: { course: { title: `Titre fictif ${courseId}` }, booking: null,
          dossier: { attendedMinutes: 390, plannedMinutes: 420, sessionCount: 1, sessionProofs: [] },
          criteria: [], attestationConfig: config },
      });
      assert.deepEqual(snapshot.objectives, config.objectives);
      assert.notEqual(snapshot.objectives, config.objectives);
      assert.equal(snapshot.nature, 'Action de formation professionnelle');
      assert.equal(snapshot.courseTitle, `Titre fictif ${courseId}`);
      assert.equal(snapshot.attendedMinutes, 390);
      assert.equal(snapshot.plannedMinutes, 420);
    }
  }
});

test('formate les trois rythmes de la formation IA Act', () => {
  assert.equal(
    formatAttestationDeliveryMode({ delivery_mode: 'in_person', schedule_format: 'one_4h' }),
    'Présentiel · 1 séance de 4 h',
  );
  assert.equal(
    formatAttestationDeliveryMode({ delivery_mode: 'remote', schedule_format: 'two_2h' }),
    'Distanciel synchrone · 2 séances de 2 h',
  );
  assert.equal(
    formatAttestationDeliveryMode({ delivery_mode: 'remote', schedule_format: 'four_1h' }),
    'Distanciel synchrone · 4 séances de 1 h',
  );
});

test('conserve les objectifs pédagogiques sur une attestation IA Act', () => {
  const snapshot = createAttestationSnapshot({
    documentType: 'realisation',
    record: {
      learnerName: 'Camille Exemple',
      submission: { id: 84, course_id: 'formation-ia-act' },
      review: null,
    },
    documentData: {
      course: { title: 'IA : acculturation et préparation à la conformité AI Act' },
      booking: { id: 'booking-ia-act', delivery_mode: 'remote', schedule_format: 'two_2h' },
      dossier: {
        attendedMinutes: 240,
        plannedMinutes: 240,
        sessionCount: 2,
        sessionProofs: [],
      },
      criteria: [],
      attestationConfig: COURSE_ATTESTATION_CONFIG['formation-ia-act'],
    },
  });

  assert.equal(snapshot.nature, 'Action de formation professionnelle');
  assert.equal(snapshot.objectives.length, 6);
  assert.match(snapshot.objectives.join(' '), /plan d’acculturation/);
  assert.equal(snapshot.deliveryMode, 'Distanciel synchrone · 2 séances de 2 h');
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
