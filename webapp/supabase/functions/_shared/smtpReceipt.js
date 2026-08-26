const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SmtpReceiptError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SmtpReceiptError';
    this.code = code;
  }
}

function requiredSecret(getEnv, name) {
  const value = getEnv(name)?.trim();
  if (!value) throw new SmtpReceiptError('smtp_configuration_missing');
  return value;
}

export function readSmtpConfig(getEnv = (name) => globalThis.Deno.env.get(name)) {
  const host = requiredSecret(getEnv, 'SMTP_HOST');
  const port = Number(requiredSecret(getEnv, 'SMTP_PORT'));
  const user = requiredSecret(getEnv, 'SMTP_USER');
  const password = requiredSecret(getEnv, 'SMTP_PASSWORD');
  const from = requiredSecret(getEnv, 'SMTP_FROM').toLowerCase();
  if (host !== 'smtp.ionos.fr' || port !== 465) throw new SmtpReceiptError('smtp_configuration_invalid');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    throw new SmtpReceiptError('smtp_configuration_invalid');
  }
  if (user.split('@')[1]?.toLowerCase() !== from.split('@')[1]?.toLowerCase()) {
    throw new SmtpReceiptError('smtp_sender_domain_mismatch');
  }
  return { host, port, user, password, from };
}

function base64Utf8(value) {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

function safeHeaderAddress(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(normalized)) {
    throw new SmtpReceiptError('smtp_recipient_invalid');
  }
  return normalized;
}

export function buildWithdrawalReceiptEmail(receipt, fromAddress, contactEmail = 'thierry@formaprompt.com') {
  const to = safeHeaderAddress(receipt.acknowledgement_email);
  const from = safeHeaderAddress(fromAddress);
  const receivedAt = new Date(receipt.received_at);
  if (Number.isNaN(receivedAt.getTime())) throw new SmtpReceiptError('receipt_timestamp_invalid');
  const receivedLabel = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(receivedAt);
  const subject = `Accusé de réception de votre rétractation ${receipt.id}`;
  const body = [
    'FormaPrompt — Accusé de réception de rétractation',
    '',
    'Votre déclaration de rétractation a bien été reçue.',
    `Référence de la demande : ${receipt.id}`,
    `Date et heure de réception : ${receivedLabel}`,
    `Identité déclarée : ${receipt.claimant_first_name} ${receipt.claimant_last_name}`,
    `Référence de commande ou de contrat : ${receipt.diagnostic_order_id || receipt.purchase_id}`,
    `Prestation : ${receipt.diagnostic_order_id ? 'Diagnostic IA Express' : receipt.course_id}`,
    `Déclaration : ${receipt.declaration}`,
    '',
    "La réception de votre demande ne constitue pas, à elle seule, une confirmation de remboursement. La demande sera instruite par FormaPrompt.",
    `Contact : ${contactEmail}`,
  ].join('\n');
  const headers = [
    `From: FormaPrompt <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${base64Utf8(subject)}?=`,
    `Date: ${receivedAt.toUTCString()}`,
    `Message-ID: <withdrawal-${receipt.id}@formaprompt.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return {
    from,
    to,
    subject,
    body,
    data: `${headers.join('\r\n')}\r\n\r\n${wrapBase64(base64Utf8(body))}\r\n`,
  };
}

export function buildCommercialEmail({ recipientEmail, subject, body, messageId }, fromAddress) {
  const to = safeHeaderAddress(recipientEmail);
  const from = safeHeaderAddress(fromAddress);
  const normalizedSubject = String(subject || '').trim();
  const normalizedBody = String(body || '').trim();
  const normalizedMessageId = String(messageId || '').trim().replace(/[^a-zA-Z0-9._-]/g, '');
  if (normalizedSubject.length < 2 || normalizedSubject.length > 300 || /[\r\n]/.test(normalizedSubject)) {
    throw new SmtpReceiptError('smtp_subject_invalid');
  }
  if (normalizedBody.length < 2 || normalizedBody.length > 30000) {
    throw new SmtpReceiptError('smtp_body_invalid');
  }
  if (normalizedMessageId.length < 8 || normalizedMessageId.length > 180) {
    throw new SmtpReceiptError('smtp_message_id_invalid');
  }
  const headers = [
    `From: FormaPrompt <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${base64Utf8(normalizedSubject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${normalizedMessageId}@formaprompt.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return {
    from,
    to,
    subject: normalizedSubject,
    body: normalizedBody,
    data: `${headers.join('\r\n')}\r\n\r\n${wrapBase64(base64Utf8(normalizedBody))}\r\n`,
  };
}

async function readReply(connection) {
  const buffer = new Uint8Array(4096);
  let response = '';
  while (true) {
    const count = await connection.read(buffer);
    if (count === null) throw new SmtpReceiptError('smtp_connection_closed');
    response += decoder.decode(buffer.subarray(0, count));
    const lines = response.split(/\r?\n/).filter(Boolean);
    const last = lines.at(-1) || '';
    if (/^\d{3} /.test(last)) return { code: Number(last.slice(0, 3)), response };
    if (response.length > 32768) throw new SmtpReceiptError('smtp_response_too_large');
  }
}

async function writeLine(connection, value) {
  await connection.write(encoder.encode(`${value}\r\n`));
}

async function command(connection, value, expectedCodes) {
  await writeLine(connection, value);
  const reply = await readReply(connection);
  if (!expectedCodes.includes(reply.code)) throw new SmtpReceiptError(`smtp_rejected_${reply.code || 'unknown'}`);
}

export async function sendWithdrawalReceiptEmail(receipt, options = {}) {
  const config = readSmtpConfig(options.getEnv);
  const email = buildWithdrawalReceiptEmail(receipt, config.from, options.contactEmail);
  const connectTls = options.connectTls || ((connectionOptions) => globalThis.Deno.connectTls(connectionOptions));
  const connection = await connectTls({ hostname: config.host, port: config.port });
  const timeoutMs = options.timeoutMs || 12000;
  let timeoutId;
  try {
    return await Promise.race([
      (async () => {
        const greeting = await readReply(connection);
        if (greeting.code !== 220) throw new SmtpReceiptError('smtp_greeting_rejected');
        await command(connection, 'EHLO formaprompt.com', [250]);
        await command(connection, 'AUTH LOGIN', [334]);
        await command(connection, base64Utf8(config.user), [334]);
        await command(connection, base64Utf8(config.password), [235]);
        await command(connection, `MAIL FROM:<${email.from}>`, [250]);
        await command(connection, `RCPT TO:<${email.to}>`, [250, 251]);
        await command(connection, 'DATA', [354]);
        await connection.write(encoder.encode(`${email.data}.\r\n`));
        const accepted = await readReply(connection);
        if (accepted.code !== 250) throw new SmtpReceiptError(`smtp_rejected_${accepted.code || 'unknown'}`);
        await command(connection, 'QUIT', [221]);
        return { status: 'sent' };
      })(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new SmtpReceiptError('smtp_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
    try { connection.close(); } catch { /* connexion déjà fermée */ }
  }
}

export async function sendCommercialEmail(message, options = {}) {
  const config = readSmtpConfig(options.getEnv);
  const email = buildCommercialEmail(message, config.from);
  const connectTls = options.connectTls || ((connectionOptions) => globalThis.Deno.connectTls(connectionOptions));
  const connection = await connectTls({ hostname: config.host, port: config.port });
  const timeoutMs = options.timeoutMs || 12000;
  let timeoutId;
  try {
    return await Promise.race([
      (async () => {
        const greeting = await readReply(connection);
        if (greeting.code !== 220) throw new SmtpReceiptError('smtp_greeting_rejected');
        await command(connection, 'EHLO formaprompt.com', [250]);
        await command(connection, 'AUTH LOGIN', [334]);
        await command(connection, base64Utf8(config.user), [334]);
        await command(connection, base64Utf8(config.password), [235]);
        await command(connection, `MAIL FROM:<${email.from}>`, [250]);
        await command(connection, `RCPT TO:<${email.to}>`, [250, 251]);
        await command(connection, 'DATA', [354]);
        await connection.write(encoder.encode(`${email.data}.\r\n`));
        const accepted = await readReply(connection);
        if (accepted.code !== 250) throw new SmtpReceiptError(`smtp_rejected_${accepted.code || 'unknown'}`);
        await command(connection, 'QUIT', [221]);
        return { status: 'sent', messageId: message.messageId };
      })(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new SmtpReceiptError('smtp_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
    try { connection.close(); } catch { /* connexion déjà fermée */ }
  }
}

export function smtpFailureCode(error) {
  return error instanceof SmtpReceiptError ? error.code : 'smtp_delivery_failed';
}

export async function attemptWithdrawalReceiptDelivery(receipt, {
  send = sendWithdrawalReceiptEmail,
  now = () => new Date().toISOString(),
} = {}) {
  const attemptedAt = now();
  try {
    await send(receipt);
    return {
      acknowledgement_delivery_status: 'sent',
      acknowledgement_delivered_at: now(),
      acknowledgement_delivery_attempted_at: attemptedAt,
      acknowledgement_delivery_attempts: 1,
      acknowledgement_delivery_error_code: null,
    };
  } catch (error) {
    return {
      acknowledgement_delivery_status: 'failed',
      acknowledgement_delivered_at: null,
      acknowledgement_delivery_attempted_at: attemptedAt,
      acknowledgement_delivery_attempts: 1,
      acknowledgement_delivery_error_code: smtpFailureCode(error),
    };
  }
}
