import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Accès direct à l’aide sur hébergement Apache', () => {
  it('autorise uniquement la route réellement déclarée avant la réponse 404', () => {
    const rules = readFileSync(resolve('public/.htaccess'), 'utf8');
    const rule = 'RewriteRule ^aide/bien-demarrer/?$ /app-shell.html [L]';
    expect(rules).toContain(rule);
    expect(rules.indexOf(rule)).toBeLessThan(rules.indexOf('RewriteRule ^ - [R=404,L]'));
    expect(rules).not.toContain('RewriteRule ^aide(?:/.*)?$');
  });
});
