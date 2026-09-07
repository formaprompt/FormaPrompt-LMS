import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const htaccess = readFileSync(new URL('../../public/.htaccess', import.meta.url), 'utf8')
const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')
const formations = ['formation-ia-generative', 'formation-prompt-engineering', 'formation-ia-act-conformite']
const rules = htaccess.split(/\r?\n/).flatMap((line) => {
  const match = line.trim().match(/^RewriteRule (\S+) (\S+) \[([^\]]+)\]$/)
  return match ? [{ pattern: new RegExp(match[1]), target: match[2], flags: match[3], source: line.trim() }] : []
})
const formationRules = rules.filter(rule => rule.source.includes('formation-ia-generative'))

// Contrôles statiques du contrat de routage, pas une simulation du serveur Apache.
test('les trois URL sans slash ciblent explicitement leur index pré-rendu', () => {
  const internal = formationRules.find(rule => rule.flags === 'END')
  assert.ok(internal)
  for (const route of formations) {
    assert.equal(route.replace(internal.pattern, internal.target), `${route}/index.html`)
  }
  const ruleIndex = htaccess.indexOf(internal.source)
  const conditions = htaccess.slice(0, ruleIndex).trimEnd().split(/\r?\n/).slice(-2).map(line => line.trim())
  assert.deepEqual(conditions, [
    'RewriteCond %{REQUEST_FILENAME} !-f',
    'RewriteCond %{REQUEST_FILENAME}/index.html -f',
  ])
  assert.ok(ruleIndex < htaccess.indexOf('RewriteCond %{REQUEST_FILENAME} -f [OR]'))
})

test('les variantes avec slash redirigent en 301 vers les trois canonicals sans slash', () => {
  const redirect = formationRules.find(rule => rule.flags === 'R=301,L')
  assert.ok(redirect)
  for (const route of formations) {
    assert.equal(`${route}/`.replace(redirect.pattern, redirect.target), `/${route}`)
    assert.equal(redirect.pattern.test(route), false)
  }
})

test('les règles formations ne capturent ni assets, ni autres dossiers, ni index internes', () => {
  for (const route of [
    'assets/app.js', 'assets/app.css', 'assets/photo.png', 'sitemap.xml',
    'studio/', 'blog/', 'contact', 'uploads/', 'url-inexistante',
    ...formations.map(route => `${route}/index.html`),
    ...formations.map(route => `${route}/image.png`),
  ]) {
    for (const rule of formationRules) assert.equal(rule.pattern.test(route), false, route)
  }
})

test('les protections contact/blog, les fichiers physiques et la vraie 404 restent en place', () => {
  assert.match(htaccess, /DirectorySlash Off/)
  for (const route of ['contact', 'blog']) {
    const internal = rules.find(rule => rule.source === `RewriteRule ^${route}$ ${route}.html [END]`)
    assert.ok(internal)
    assert.ok(htaccess.indexOf(internal.source) < htaccess.indexOf('RewriteCond %{REQUEST_FILENAME} -f [OR]'))
    assert.ok(rules.some(rule => rule.source === `RewriteRule ^${route}/$ /${route} [R=301,L]`))
  }
  assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -f \[OR\]\s+RewriteCond %\{REQUEST_FILENAME\} -d\s+RewriteRule \^ - \[L\]/)
  assert.equal(rules.at(-1).source, 'RewriteRule ^ - [R=404,L]')
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/)
})

test('le sitemap référence les destinations canoniques et conserve la redirection historique', () => {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  assert.equal(new Set(urls).size, urls.length)
  assert.ok(!urls.some(url => url.includes('www.formaprompt.com') || url.includes('/formation-ia-formateur')))
  for (const route of [...formations, 'formation-organismes', 'blog/meilleur-generateur-prompts-comparatif-2026']) {
    assert.ok(urls.includes(`https://formaprompt.com/${route}`))
    assert.ok(!urls.includes(`https://formaprompt.com/${route}/`))
  }
  assert.ok(rules.some(rule => rule.source === 'RewriteRule ^formation-ia-formateur/?$ /formation-organismes [R=301,L]'))
})
