import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installAnalyticsNavigationBoundary } from './analyticsNavigationBoundary.js';

function fixture(loaded = true) {
  const dom = new JSDOM('<a id="private" href="/dashboard">Compte</a>', { url: 'https://formaprompt.com/' });
  const { window: win } = dom;
  const navigations = [];
  let stopped = 0;
  const uninstall = installAnalyticsNavigationBoundary({ window: win, document: win.document,
    isLoaded: () => loaded, isPublicPage: (path) => ['/', '/contact'].includes(path),
    stop: () => { stopped += 1; }, navigate: (url) => navigations.push(url) });
  return { win, navigations, get stopped() { return stopped; }, uninstall };
}
test('inactive audience leaves React navigation unchanged', () => {
  const f = fixture(false);
  f.win.history.pushState({}, '', '/dashboard');
  assert.equal(f.win.location.pathname, '/dashboard');
  assert.equal(f.stopped, 0);
});
test('public navigation remains in the current document', () => {
  const f = fixture();
  f.win.history.pushState({}, '', '/contact');
  assert.equal(f.win.location.pathname, '/contact');
  assert.equal(f.stopped, 0);
});
test('private push or replace is intercepted before the URL changes', () => {
  for (const method of ['pushState', 'replaceState']) {
    const f = fixture();
    f.win.history[method]({}, '', '/dashboard?token=fixture');
    assert.equal(f.win.location.href, 'https://formaprompt.com/');
    assert.deepEqual(f.navigations, ['https://formaprompt.com/dashboard?token=fixture']);
    assert.equal(f.stopped, 1);
  }
});
test('parameters and fragments also trigger document replacement', () => {
  for (const url of ['/contact?email=fixture', '/contact#token']) {
    const f = fixture();
    f.win.history.pushState({}, '', url);
    assert.equal(f.win.location.pathname, '/');
    assert.equal(f.navigations.length, 1);
  }
});
test('private anchor is stopped before the React click handler', () => {
  const f = fixture();
  let bubbled = false;
  f.win.document.addEventListener('click', () => { bubbled = true; });
  f.win.document.querySelector('a').dispatchEvent(new f.win.MouseEvent('click', { button: 0, bubbles: true, cancelable: true }));
  assert.equal(bubbled, false);
  assert.equal(f.stopped, 1);
});
test('popstate restores the safe URL before unloading and stops later listeners', () => {
  const f = fixture(false);
  f.uninstall();
  f.win.history.replaceState({}, '', '/dashboard?fixture=private');
  const results = [];
  const stop = installAnalyticsNavigationBoundary({ window: f.win, document: f.win.document,
    isLoaded: () => true, isPublicPage: () => false, stop: () => {}, navigate: (url) => results.push(url) });
  // Initial private documents do not load GA. Test a browser back into a prior
  // excluded entry after a safe document has loaded it instead.
  stop();
  f.win.history.replaceState({}, '', '/');
  const original = f.win.history.replaceState;
  installAnalyticsNavigationBoundary({ window: f.win, document: f.win.document,
    isLoaded: () => true, isPublicPage: (path) => path === '/', stop: () => {}, navigate: (url) => results.push(url) });
  original.call(f.win.history, {}, '', '/dashboard?fixture=private');
  let observed = false;
  f.win.addEventListener('popstate', () => { observed = true; });
  f.win.dispatchEvent(new f.win.PopStateEvent('popstate'));
  assert.equal(observed, false);
  assert.equal(f.win.location.href, 'https://formaprompt.com/');
  assert.deepEqual(results, ['https://formaprompt.com/dashboard?fixture=private']);
});
test('cross-tab session stops the current audience document', () => {
  const f = fixture();
  f.win.dispatchEvent(new f.win.StorageEvent('storage', { key: 'sb-example-auth-token', newValue: 'fixture' }));
  assert.equal(f.stopped, 1);
  assert.equal(f.navigations.length, 1);
});
test('cleanup restores history and event handlers', () => {
  const f = fixture();
  f.uninstall();
  f.win.history.pushState({}, '', '/dashboard');
  assert.equal(f.win.location.pathname, '/dashboard');
  assert.equal(f.stopped, 0);
});
test('a cached audience document is replaced before reuse', () => {
  const f = fixture();
  f.win.dispatchEvent(new f.win.PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(f.stopped, 1);
  assert.equal(f.navigations.length, 1);
});
