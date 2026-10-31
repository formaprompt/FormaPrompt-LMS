// Application limits: deliberately below IONOS Basic/Pro's published 70 MB
// attachment limit and bounded for the Edge worker's memory/CPU budget.
export const CLIENT_REPLY_LIMITS = Object.freeze({
  maxFiles: 3,
  maxFileBytes: 3 * 1024 * 1024,
  maxTotalBytes: 6 * 1024 * 1024,
  maxRequestBytes: 7 * 1024 * 1024,
  maxFilenameBytes: 150,
  maxSubjectLength: 300,
  maxMessageLength: 10000,
});
export const CLIENT_REPLY_MIME_TYPES = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
