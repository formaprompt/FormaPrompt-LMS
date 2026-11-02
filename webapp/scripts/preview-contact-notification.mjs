import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAdminNotification } from '../supabase/functions/_shared/adminEmailNotifications.js';
import { buildCommercialEmail } from '../supabase/functions/_shared/smtpReceipt.js';

// Offline generation only. No environment, credentials, network or SMTP.
const output = resolve(process.argv[2] || '../notification-preview');
await mkdir(output, { recursive: true });
const row = {
  id: '20000000-0000-4000-8000-000000000001',
  source_id: '30000000-0000-4000-8000-000000000001',
  recipient_email: 'formaprompt@gmail.com', kind: 'contact_request',
};
const contact = {
  id: row.source_id, name: 'Camille Exemple', email: 'camille@example.test',
  subject: 'Formation IA pour une équipe', request_type: 'professional',
  message: 'Bonjour,\nNous souhaitons former 8 collègues à l’IA générative.\nPouvez-vous préciser les modalités ?\nMerci.',
};
const cases = {
  legitime: contact,
  lien_fictif: { ...contact, name: 'Expéditeur fictif', subject: 'Vérification urgente — exemple fictif',
    message: 'Votre compte doit être vérifié.\nConnectez-vous sur https://verification.example.test/compte\nAutre adresse : www.paiement.example.test\n<img src="https://trace.example.test/pixel" onerror="alert(1)">\nCeci est une donnée de test, pas une demande réelle.' },
};
for (const [name, source] of Object.entries(cases)) {
  const message = buildAdminNotification(row, source);
  const mime = buildCommercialEmail(message, 'expediteur-fictif@example.test');
  await writeFile(resolve(output, `${name}.txt`), `EXEMPLE FICTIF — AUCUN ENVOI\nDestinataire conservé : ${message.recipientEmail}\nObjet : ${message.subject}\n\n${message.body}\n`, 'utf8');
  await writeFile(resolve(output, `${name}.html`), message.htmlBody, 'utf8');
  await writeFile(resolve(output, `${name}.eml`), mime.data, 'utf8');
}
console.log(`Aperçus fictifs créés : ${output}`);
