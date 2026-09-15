-- Excel Initiation remet des classeurs XLSX depuis le bucket déjà privé.
-- Les politiques Storage existantes et course_access ne sont pas modifiés.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png'
]::text[]
WHERE id = 'paid-course-content';
