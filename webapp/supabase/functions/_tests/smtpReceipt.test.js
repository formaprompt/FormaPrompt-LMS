import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attemptWithdrawalReceiptDelivery,
  buildWithdrawalReceiptEmail,
  readSmtpConfig,
  sendWithdrawalReceiptEmail,
  SmtpReceiptError,
} from '../_shared/smtpReceipt.js';

const receipt = {
  id: '66000000-0000-0000-0000-000000000001',
  purchase_id: '63000000-0000-0000-0000-000000000001',
  course_id: 'formation-ia-act',
  claimant_first_name: 'Marie',
  claimant_last_name: 'Durand',
  acknowledgement_email: 'marie@example.test',
  declaration: 'Je vous informe par la présente de ma décision de me rétracter.',
  received_at: '2026-08-12T10:05:00.000Z',
};

test('construit un accusé cohérent sans promettre un remboursement', () => {
  const email = buildWithdrawalReceiptEmail(receipt, 'thierry@formaprompt.com');
  assert.equal(email.to, 'marie@example.test');
  assert.match(email.body, /66000000-0000-0000-0000-000000000001/);
  assert.match(email.body, /Marie Durand/);
  assert.match(email.body, /63000000-0000-0000-0000-000000000001/);
  assert.match(email.body, /12 août 2026/);
  assert.match(email.body, /La réception de votre demande ne constitue pas, à elle seule, une confirmation de remboursement\./i);
  assert.doesNotMatch(email.data, /Je vous informe par la présente/);
});

test('ne lit que les cinq secrets serveur attendus et valide IONOS 465', () => {
  const requested = [];
  const values = {
    SMTP_HOST: 'smtp.ionos.fr',
    SMTP_PORT: '465',
    SMTP_USER: 'thierry@formaprompt.com',
    SMTP_PASSWORD: 'secret-de-test',
    SMTP_FROM: 'thierry@formaprompt.com',
  };
  const config = readSmtpConfig((name) => { requested.push(name); return values[name]; });
  assert.deepEqual(requested, Object.keys(values));
  assert.equal(config.host, 'smtp.ionos.fr');
  assert.equal(config.port, 465);
});

test('refuse une configuration SMTP absente ou différente de la référence IONOS', () => {
  assert.throws(() => readSmtpConfig(() => ''), SmtpReceiptError);
  const values = {
    SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_USER: 'a@example.test',
    SMTP_PASSWORD: 'x', SMTP_FROM: 'a@example.test',
  };
  assert.throws(() => readSmtpConfig((name) => values[name]), /smtp_configuration_invalid/);
});

test('marque un envoi réussi sans modifier la demande enregistrée', async () => {
  let sentReceipt = null;
  const update = await attemptWithdrawalReceiptDelivery(receipt, {
    send: async (value) => { sentReceipt = value; },
    now: (() => {
      const dates = ['2026-08-12T10:05:01.000Z', '2026-08-12T10:05:02.000Z'];
      return () => dates.shift();
    })(),
  });
  assert.equal(sentReceipt, receipt);
  assert.equal(update.acknowledgement_delivery_status, 'sent');
  assert.equal(update.acknowledgement_delivered_at, '2026-08-12T10:05:02.000Z');
});

test('une panne SMTP produit un état réessayable sans faire échouer la demande', async () => {
  const update = await attemptWithdrawalReceiptDelivery(receipt, {
    send: async () => { throw new Error('détail réseau sensible'); },
    now: () => '2026-08-12T10:05:01.000Z',
  });
  assert.equal(update.acknowledgement_delivery_status, 'failed');
  assert.equal(update.acknowledgement_delivered_at, null);
  assert.equal(update.acknowledgement_delivery_error_code, 'smtp_delivery_failed');
  assert.doesNotMatch(JSON.stringify(update), /détail réseau sensible/);
});

test('refuse toute injection dans une adresse utilisée comme en-tête', () => {
  assert.throws(
    () => buildWithdrawalReceiptEmail({ ...receipt, acknowledgement_email: 'victime@example.test\r\nBcc:x@example.test' }, 'thierry@formaprompt.com'),
    /smtp_recipient_invalid/,
  );
});

test('émet le dialogue SMTP TLS attendu lorsque IONOS accepte le message', async () => {
  const replies = ['220 prêt\r\n', '250 bonjour\r\n', '334 user\r\n', '334 pass\r\n', '235 ok\r\n', '250 sender\r\n', '250 recipient\r\n', '354 data\r\n', '250 queued\r\n', '221 bye\r\n'];
  const writes = [];
  const connection = {
    async read(buffer) {
      const reply = replies.shift();
      if (!reply) return null;
      const bytes = new TextEncoder().encode(reply);
      buffer.set(bytes);
      return bytes.length;
    },
    async write(bytes) { writes.push(new TextDecoder().decode(bytes)); return bytes.length; },
    close() {},
  };
  const values = {
    SMTP_HOST: 'smtp.ionos.fr', SMTP_PORT: '465', SMTP_USER: 'thierry@formaprompt.com',
    SMTP_PASSWORD: 'secret-de-test', SMTP_FROM: 'thierry@formaprompt.com',
  };
  const result = await sendWithdrawalReceiptEmail(receipt, {
    getEnv: (name) => values[name],
    connectTls: async (options) => {
      assert.deepEqual(options, { hostname: 'smtp.ionos.fr', port: 465 });
      return connection;
    },
  });
  assert.equal(result.status, 'sent');
  assert.equal(writes[0], 'EHLO formaprompt.com\r\n');
  assert.ok(writes.some((value) => value.startsWith('RCPT TO:<marie@example.test>')));
  assert.ok(writes.some((value) => value.includes('Content-Transfer-Encoding: base64')));
});
