import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWithdrawalRequestPayload } from '../_shared/withdrawalValidation.js';

const validPayload = {
  purchase_id: '2cb81599-d845-45e2-95b6-89b5c32f8bba',
  first_name: 'Marie',
  last_name: 'Durand',
  acknowledgement_email: 'marie@example.test',
  declaration: 'Je vous informe clairement de ma décision de me rétracter de ce contrat.',
};

test('accepte une demande de rétractation minimale et explicite', () => {
  assert.equal(validateWithdrawalRequestPayload(validPayload), null);
});

test('refuse une commande ou une adresse électronique incohérente', () => {
  assert.match(validateWithdrawalRequestPayload({ ...validPayload, purchase_id: 'x' }), /Commande/);
  assert.match(validateWithdrawalRequestPayload({ ...validPayload, acknowledgement_email: 'x' }), /électronique/);
});

test('refuse une déclaration trop courte', () => {
  assert.match(validateWithdrawalRequestPayload({ ...validPayload, declaration: 'Annuler' }), /clairement/);
});

test('refuse les retours à la ligne dans les champs d identité', () => {
  assert.match(validateWithdrawalRequestPayload({ ...validPayload, first_name: 'Marie\r\nBcc: tiers@example.test' }), /Prénom/);
  assert.match(validateWithdrawalRequestPayload({ ...validPayload, last_name: 'Durand\nCc: tiers@example.test' }), /Nom/);
});
