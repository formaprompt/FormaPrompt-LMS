import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { JSDOM } from 'jsdom';
import { inertContactText } from '../_shared/contactNotificationContent.js';
import { ADMIN_NOTIFICATION_EMAIL, buildAdminNotification, createNotificationStore, deliverAdminNotification } from '../_shared/adminEmailNotifications.js';
import { buildCommercialEmail } from '../_shared/smtpReceipt.js';

const row = { id: '20000000-0000-4000-8000-000000000001', source_id: '30000000-0000-4000-8000-000000000001', kind: 'contact_request', recipient_email: ADMIN_NOTIFICATION_EMAIL };
const contact = { id: row.source_id, name: 'Élodie Démo', email: 'elodie@example.test', subject: 'Formation IA pour notre équipe', request_type: 'professional', message: 'Bonjour,\r\nPouvez-vous former 8 collègues à l’IA ?\nMerci !', internal_notes: 'Ne pas transmettre', phone: 'Ne pas transmettre' };
const build = (changes = {}) => buildAdminNotification(row, { ...contact, ...changes });

test('demande légitime : objet, nature, nom, email et message ; aucun champ supplémentaire', () => {
  const before = structuredClone(contact);
  const mail = build();
  assert.equal(mail.recipientEmail, ADMIN_NOTIFICATION_EMAIL);
  assert.equal(mail.subject, 'FormaPrompt — Nouvelle demande de devis ou de contact');
  for (const content of ['Formation IA pour notre équipe', 'Professionnel / entreprise', 'Élodie Démo', 'elodie [arobase] example [point] test', '> Bonjour,\n> Pouvez-vous former 8 collègues à l’IA ?\n> Merci !']) assert.ok(mail.body.includes(content));
  assert.doesNotMatch(JSON.stringify(mail), /Ne pas transmettre/);
  assert.equal(mail.replyTo, undefined);
  assert.equal(mail.attachments, undefined);
  assert.deepEqual(contact, before);
});

for (const link of [
  'https://paiement.example.test/connexion?code=1', 'www.compte.example.test',
  'hxxps://compte[.]example[.]test', 'https[:]//compte[dot]example[dot]test',
  '//compte.example.test', 'compte。example｡test', 'https：／／compte．example．test',
  'h\u200bttps://compte.example.test', 'https://192.0.2.10', 'https://[2001:db8::1]',
  'mailto:fraude@example.test', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
  'https%3A%2F%2Fcompte%2Eexample%2Etest', 'compte&#46;example&#46;test',
  'https:\\compte.example.test', '\u202ehttps://compte.example.test',
]) test(`liens fictifs neutralisés : ${JSON.stringify(link)}`, () => {
  const mail = build({ name: link, subject: link, email: link, message: link });
  const untrusted = mail.body.split('Fin du contenu déclaré.')[0];
  // No URL or email separators survive in any untrusted field. This also
  // prevents ordinary clients from autolinking bare domains and addresses.
  assert.doesNotMatch(untrusted.split('\n').filter((line) => line.startsWith('> ')).slice(1).join('\n'), /[.:/@\\\u3002\uff61\u200b\u202e]/u);
  const document = new JSDOM(mail.htmlBody).window.document;
  const links = [...document.querySelectorAll('a')];
  assert.equal(links.length, 1);
  assert.equal(links[0].href, `https://formaprompt.com/admin/commercial?demande=${row.source_id}`);
  assert.equal(document.querySelectorAll('[src],[srcset],script,iframe,img,link,object,embed,form').length, 0);
});

test('HTML malveillant et entités restent visibles sans balise ni attribut actif', () => {
  const message = '<img src="https://trace.example.test" onerror="alert(1)"><script>alert(1)</script>\n<a href="https://fraude.example.test">Urgent</a> &lt;iframe&gt; & " \' ';
  const mail = build({ subject: message, message });
  const document = new JSDOM(mail.htmlBody).window.document;
  assert.equal(document.querySelectorAll('script,img,iframe,[onerror]').length, 0);
  assert.ok(document.querySelectorAll('pre')[4].textContent.includes('<script>alert(1)< [barre] script>'));
  assert.match(mail.htmlBody, /&lt;script&gt;/);
  assert.match(mail.htmlBody, /&amp;lt;iframe&amp;gt;/);
  assert.match(mail.htmlBody, /&quot;|&#39;/);
  assert.ok(mail.body.includes('<script>alert(1)< [barre] script>'));
});

test('vide, accents, lignes, contrôles et valeurs inattendues sont rendus explicitement', () => {
  const mail = build({ name: '', email: null, subject: '  ', message: '', request_type: '__proto__' });
  assert.equal((mail.body.match(/\(non renseigné\)/g) || []).length, 4);
  assert.match(mail.body, /Non précisée/);
  assert.equal(inertContactText('Été\r\nÀ bientôt\rSuite\u0000\u202e'), 'Été\nÀ bientôt\nSuite');
  assert.equal(inertContactText({ toString() { throw Error('do not coerce'); } }), '(non renseigné)');
});

test('message long et expansion des liens : troncature annoncée, taille MIME bornée, original intact', () => {
  const message = '😀 https://example.test/'.repeat(5000);
  const value = Object.freeze({ ...contact, message, subject: '.'.repeat(10000), email: '@'.repeat(10000), name: '/'.repeat(10000) });
  const mail = buildAdminNotification(row, value);
  assert.match(mail.body, /Extrait tronqué ; original complet dans l’administration/);
  assert.ok(mail.body.length < 17000);
  assert.ok(mail.htmlBody.length < 200000);
  assert.ok(!mail.body.includes('\ufffd'));
  assert.equal(value.message, message);
  assert.doesNotThrow(() => buildCommercialEmail(mail, 'sender@example.test'));
});

function readMimeParts(data) {
  return [...data.matchAll(/Content-Type: (text\/(?:plain|html)); charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]*?)(?=\r\n--)/g)]
    .map((match) => [match[1], Buffer.from(match[2].replaceAll('\r\n', ''), 'base64').toString('utf8')]);
}

test('les deux alternatives MIME restituent exactement les contenus sécurisés, sans PJ', () => {
  const mail = build({ message: 'Un exemple fictif : https://fraude.example.test\nÉté & <script>alerte</script>' });
  const mime = buildCommercialEmail(mail, 'sender@example.test');
  assert.equal(mime.to, ADMIN_NOTIFICATION_EMAIL);
  assert.match(mime.data, /Content-Type: multipart\/alternative/);
  assert.deepEqual(readMimeParts(mime.data), [['text/plain', mail.body], ['text/html', mail.htmlBody]]);
  assert.doesNotMatch(mime.data, /Content-Disposition: attachment|Bcc:|Cc:|Reply-To:/);
  assert.throws(() => buildCommercialEmail({ ...mail, htmlBody: {} }, 'sender@example.test'), /smtp_body_invalid/);
  assert.throws(() => buildCommercialEmail({ ...mail, htmlBody: 'x'.repeat(200001) }, 'sender@example.test'), /smtp_body_invalid/);
});

test('le MIME texte historique et les PJ restent inchangés sans alternative HTML', () => {
  const plain = buildCommercialEmail({ recipientEmail: ADMIN_NOTIFICATION_EMAIL, subject: 'Message fictif', body: 'Bonjour !', messageId: 'message-fictif' }, 'sender@example.test');
  assert.match(plain.data, /Content-Type: text\/plain; charset=UTF-8/);
  assert.doesNotMatch(plain.data, /multipart|text\/html/);
  const mail = build();
  const file = { name: 'fictif.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.7\n%%EOF') };
  const mixed = buildCommercialEmail({ ...mail, attachments: [file] }, 'sender@example.test');
  assert.match(mixed.data, /multipart\/mixed/);
  assert.deepEqual(readMimeParts(mixed.data), [['text/plain', mail.body], ['text/html', mail.htmlBody]]);
  assert.match(mixed.data, /Content-Disposition: attachment/);
});

test('la source liée est lue uniquement après réservation et ne contrôle pas le destinataire', async () => {
  const calls = [], changes = [];
  const store = { claim: async () => { calls.push('claim'); return row; }, contactForSource: async (id) => { calls.push(id); return { ...contact, recipient_email: 'fraude@example.test' }; }, finish: async (_id, change) => changes.push(change) };
  const result = await deliverAdminNotification(store, row.id, { send: async (mail) => { calls.push('send'); assert.match(mail.body, /Formation IA/); assert.equal(mail.recipientEmail, ADMIN_NOTIFICATION_EMAIL); } });
  assert.deepEqual(calls, ['claim', row.source_id, 'send']);
  assert.equal(result.status, 'sent');
  assert.doesNotMatch(JSON.stringify(changes), /Formation IA|elodie|Message reçu/);
  store.claim = async () => null;
  assert.deepEqual(await deliverAdminNotification(store, row.id), { status: 'unchanged' });
  assert.deepEqual(calls, ['claim', row.source_id, 'send']);
});

test('erreur de lecture : échec traçable sans SMTP, sans détails personnels ni réessai', async () => {
  let sent = 0, saved;
  const store = { claim: async () => row, contactForSource: async () => { throw Error('notification_content_unavailable'); }, finish: async (_id, changes) => { saved = changes; } };
  const result = await deliverAdminNotification(store, row.id, { send: async () => sent++ });
  assert.equal(sent, 0);
  assert.equal(result.status, 'failed');
  assert.equal(saved.error_code, 'notification_content_unavailable');
  assert.equal(saved.sent_at, null);
});

test('source absente : alerte explicite avec lien fiable ; source incorrecte : aucun envoi', () => {
  const mail = buildAdminNotification(row, null);
  assert.match(mail.body, /contenu de la demande est indisponible/);
  assert.match(mail.body, /https:\/\/formaprompt.com\/admin\/commercial\?demande=/);
  assert.throws(() => buildAdminNotification(row, { ...contact, id: row.id }), /notification_invalid/);
  assert.throws(() => buildAdminNotification({ ...row, recipient_email: contact.email }, contact), /notification_invalid/);
});

test('lecture Supabase limitée aux six champs utiles et à la référence liée, sans mutation', async () => {
  const calls = [];
  const database = { from(table) { calls.push(['from', table]); return { select(columns) { calls.push(['select', columns]); return this; }, eq(key, value) { calls.push(['eq', key, value]); return this; }, async maybeSingle() { return { data: contact, error: null }; } }; } };
  assert.deepEqual(await createNotificationStore(database).contactForSource(row.source_id), contact);
  assert.deepEqual(calls, [['from', 'contact_requests'], ['select', 'id,name,email,subject,message,request_type'], ['eq', 'id', row.source_id]]);
});

test('une erreur Supabase masque les détails internes et garde un code exploitable', async () => {
  const database = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: { message: 'détail confidentiel fictif' } }; } }; } };
  await assert.rejects(createNotificationStore(database).contactForSource(row.source_id), { message: 'notification_content_unavailable' });
});

test('paiements : aucun accès au contenu commercial, même en présence de données non fiables', async () => {
  const payment = { ...row, kind: 'payment_confirmed', payload: { amount_cents: 49700, currency: 'eur', message: contact.message } };
  let sent;
  await deliverAdminNotification({ claim: async () => payment, contactForSource: async () => { throw Error('must not read'); }, finish: async () => {} }, row.id, { send: async (mail) => { sent = mail; } });
  assert.equal(sent.recipientEmail, ADMIN_NOTIFICATION_EMAIL);
  assert.equal(sent.htmlBody, undefined);
  assert.match(sent.body, /497.00 EUR/);
  assert.doesNotMatch(sent.body, /collègues|Message reçu/);
});
