import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { courseCatalog } from '../supabase/functions/_shared/paidCourseCatalog.js';

const publicCatalog = Object.fromEntries(Object.entries(courseCatalog).map(([courseId, course]) => [courseId, {
  title: course.title,
  landingPath: course.landingPath,
  durationLabel: course.durationLabel,
  exercises: (course.exercises || []).map(({ id, title }) => ({ id, title })),
  finalProject: course.finalProject ? {
    rubric: course.finalProject.rubric || [],
    rubricLevels: course.finalProject.rubricLevels || [],
    submissionFields: course.finalProject.submissionFields || [],
  } : null,
}]));

const outputPath = fileURLToPath(new URL('../src/data/courseCatalog.js', import.meta.url));
const source = `// Généré par scripts/generatePublicCourseMetadata.mjs.\n// Aucun cours, exercice, corrigé ou URL de ressource payante ne doit être ajouté ici.\nexport const courseCatalog = ${JSON.stringify(publicCatalog, null, 2)};\n`;
await writeFile(outputPath, source, 'utf8');
