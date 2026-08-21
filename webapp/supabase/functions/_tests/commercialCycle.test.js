import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuoteEmail, buildQuoteSnapshot, communicationKey, validateQuoteInput, validateRequestUpdate,
} from '../_shared/commercialCycle.js';
import { buildCommercialEmail } from '../_shared/smtpReceipt.js';

const request = {
  name: 'Entreprise Exemple', email: 'contact@example.test', course_id: 'formation-ia-act',
  organization_name: 'Entreprise Exemple', beneficiary_name: 'Camille Martin', beneficiary_email: 'camille@example.test',
};

test('qualifie une demande avec les statuts et types du Sprint 3', () => {
  const value = validateRequestUpdate({ status: 'processing', requestType: 'professional', courseId: 'formation-ia-act' });
  assert.equal(value.status, 'processing'); assert.equal(value.request_type, 'professional');
  assert.throws(() => validateRequestUpdate({ status: 'paid', requestType: 'professional' }), /Statut invalide/);
});

test('construit un devis cohérent avec le catalogue existant et la TVA 293 B', () => {
  const validUntil = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
  const value = validateQuoteInput({ quantity: 2, unitPriceCents: 18700, validUntil }, request);
  assert.equal(value.course_title, 'IA : acculturation et préparation à la conformité AI Act');
  assert.equal(value.tax_statement, 'TVA non applicable - article 293 B du CGI');
});

test('fige les données envoyées et produit un e-mail sans en-tête injectable', () => {
  const quote = { id: 'q', quote_number: 'FP-2026-000001', version: 1, created_at: '2026-08-21T10:00:00Z', valid_until: '2026-09-21', client_name: 'Camille', client_email: 'camille@example.test', organization_name: null, beneficiary_name: null, beneficiary_email: null, course_id: 'formation-ia', course_title: 'IA générative', quantity: 1, unit_price_cents: 49700, currency: 'eur', tax_statement: 'TVA non applicable - article 293 B du CGI' };
  const snapshot = buildQuoteSnapshot(quote, '2026-08-21T11:00:00Z');
  assert.equal(snapshot.pricing.totalPriceCents, 49700);
  const email = buildQuoteEmail(snapshot);
  const message = buildCommercialEmail({ recipientEmail: quote.client_email, ...email, messageId: 'commercial-test-1234' }, 'thierry@formaprompt.com');
  assert.match(message.data, /Message-ID: <commercial-test-1234@formaprompt.com>/);
  assert.throws(() => buildCommercialEmail({ recipientEmail: quote.client_email, subject: 'X\r\nBcc: x@y.test', body: 'ok', messageId: 'commercial-test-1234' }, 'thierry@formaprompt.com'), /subject_invalid/);
});

test('la clé idempotente est stable pour une même version', () => {
  assert.equal(communicationKey('quote', '00000000-0000-4000-8000-000000000001', 2), 'quote:00000000-0000-4000-8000-000000000001:2');
});
