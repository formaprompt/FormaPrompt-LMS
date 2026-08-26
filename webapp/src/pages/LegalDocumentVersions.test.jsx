import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CGVConsumer from './CGVConsumer';
import CGVProfessional from './CGVProfessional';

vi.mock('../components/SEO', () => ({ default: () => null }));

const EXPECTED_VERSIONS = Object.freeze({
  b2c: Object.freeze({
    id: 'CGV-B2C-2026-08-26',
    hash: '888f14bd7f8b99d8731b1520652463a63bf3629ab94b1dd602c8a3e4ebda0476',
  }),
  b2b: Object.freeze({
    id: 'CGV-B2B-2026-08-26',
    hash: '85bd6b41a4ce2a7f22ca465e232b45de2f75ce947c7059392eba96175659f76e',
  }),
});

function renderCanonicalText(Page) {
  render(<MemoryRouter><Page /></MemoryRouter>);
  const blocks = [...screen.getByRole('article').children].map((element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return clone.textContent.replace(/[ \t]+/g, ' ').trim();
  });
  return blocks.join('\n\n');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function migrationCanonicalText(tag, documentType, previousVersion, nextVersion) {
  const previousMigration = readFileSync(resolve('supabase/migrations/20260812132848_publish_commercial_legal_versions.sql'), 'utf8').replace(/\r\n/g, '\n');
  const legalMigration = readFileSync(resolve('supabase/migrations/20260826192602_add_diagnostic_ia_legal_consents.sql'), 'utf8').replace(/\r\n/g, '\n');
  const previousText = previousMigration.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))?.[1];
  const segment = legalMigration
    .split(`SELECT\n    '${documentType}',`)[1]
    .split(`FROM source WHERE document_type = '${documentType}'`)[0];
  if (!previousText || !segment) throw new Error(`Migration juridique ${documentType} illisible`);
  let text = previousText.replace(previousVersion, nextVersion);
  for (const match of segment.matchAll(/'([^']*)',\s*\$txt\$([\s\S]*?)\$txt\$/g)) {
    text = text.replace(match[1], match[2]);
  }
  return text;
}

describe('versions contractuelles figées', () => {
  afterEach(() => cleanup());

  it('fige exactement la page CGV B2C, sa TVA et le médiateur CM2C', () => {
    const text = renderCanonicalText(CGVConsumer);
    expect(text).toContain(`CGV B2C — version ${EXPECTED_VERSIONS.b2c.id.replace('CGV-B2C-', '')}`);
    expect(text).toContain('TVA non applicable - article 293 B du CGI');
    expect(text).toContain('CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice');
    expect(text).not.toMatch(/document préparatoire|publication après validation|TVA applicable/i);
    expect(sha256(text)).toBe(EXPECTED_VERSIONS.b2c.hash);
    expect(migrationCanonicalText('b2c', 'cgv_b2c', '2026-08-12', '2026-08-26')).toBe(text);
  });

  it('fige exactement la page CGV B2B sans formulation contradictoire', () => {
    const text = renderCanonicalText(CGVProfessional);
    expect(text).toContain(`CGV B2B — version ${EXPECTED_VERSIONS.b2b.id.replace('CGV-B2B-', '')}`);
    expect(text).toContain('TVA non applicable - article 293 B du CGI');
    expect(text).not.toMatch(/document préparatoire|publication après validation|TVA applicable/i);
    expect(sha256(text)).toBe(EXPECTED_VERSIONS.b2b.hash);
    expect(migrationCanonicalText('b2b', 'cgv_b2b', '2026-08-12', '2026-08-26')).toBe(text);
  });
});
