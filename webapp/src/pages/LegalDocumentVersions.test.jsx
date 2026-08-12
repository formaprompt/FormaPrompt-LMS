import { createHash } from 'node:crypto';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CGVConsumer from './CGVConsumer';
import CGVProfessional from './CGVProfessional';

vi.mock('../components/SEO', () => ({ default: () => null }));

const EXPECTED_VERSIONS = Object.freeze({
  b2c: Object.freeze({
    id: 'CGV-B2C-2026-08-12',
    hash: '2638f1ae962efb81a8f8b7f1ed96a4ba673fd3300b6dd507ba39e53979a7d459',
  }),
  b2b: Object.freeze({
    id: 'CGV-B2B-2026-08-12',
    hash: '5ef0c09d8c454ad72f089aad6fc332c007011830aeb972e791eff9c0e80d3702',
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

describe('versions contractuelles figées', () => {
  afterEach(() => cleanup());

  it('fige exactement la page CGV B2C, sa TVA et le médiateur CM2C', () => {
    const text = renderCanonicalText(CGVConsumer);
    expect(text).toContain(`CGV B2C — version ${EXPECTED_VERSIONS.b2c.id.replace('CGV-B2C-', '')}`);
    expect(text).toContain('TVA non applicable - article 293 B du CGI');
    expect(text).toContain('CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice');
    expect(text).not.toMatch(/document préparatoire|publication après validation|TVA applicable/i);
    expect(sha256(text)).toBe(EXPECTED_VERSIONS.b2c.hash);
  });

  it('fige exactement la page CGV B2B sans formulation contradictoire', () => {
    const text = renderCanonicalText(CGVProfessional);
    expect(text).toContain(`CGV B2B — version ${EXPECTED_VERSIONS.b2b.id.replace('CGV-B2B-', '')}`);
    expect(text).toContain('TVA non applicable - article 293 B du CGI');
    expect(text).not.toMatch(/document préparatoire|publication après validation|TVA applicable/i);
    expect(sha256(text)).toBe(EXPECTED_VERSIONS.b2b.hash);
  });
});
