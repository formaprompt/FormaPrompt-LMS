// Installed before any audience SDK. A private document must start without it.
function navigateInFreshDocument(win, url, replace = false) {
  if (!url) { win.location.reload(); return; }
  const destination = new URL(url, win.location.href);
  const current = new URL(win.location.href);
  const sameDocument = destination.origin === current.origin && destination.pathname === current.pathname
    && destination.search === current.search;
  win.location[replace ? 'replace' : 'assign'](destination.href);
  // A fragment-only assign/replace does not unload a script. Force a new document.
  if (sameDocument) win.location.reload();
}

export function replaceAnalyticsDocument(url) {
  navigateInFreshDocument(window, url, true);
}

export function installAnalyticsNavigationBoundary({ window: win, document: doc,
  isLoaded, isPublicPage, stop, navigate = (url) => navigateInFreshDocument(win, url) }) {
  const originalPush = win.history.pushState;
  const originalReplace = win.history.replaceState;
  let lastSafeUrl = win.location.href;
  let leaving = false;
  const safe = (url) => url.origin === win.location.origin && !url.search && !url.hash
    && Boolean(isPublicPage(url.pathname));
  function leave(url) {
    if (leaving) return;
    leaving = true;
    stop();
    navigate(url.href);
  }
  function intercept(original) {
    return function (state, unused, suppliedUrl) {
      const destination = new URL(suppliedUrl ?? win.location.href, win.location.href);
      if (isLoaded() && !safe(destination)) { leave(destination); return; }
      const result = original.call(win.history, state, unused, suppliedUrl);
      if (safe(destination)) lastSafeUrl = destination.href;
      return result;
    };
  }
  const push = intercept(originalPush);
  const replace = intercept(originalReplace);
  win.history.pushState = push;
  win.history.replaceState = replace;
  function click(event) {
    if (!isLoaded() || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const destination = new URL(anchor.href, win.location.href);
    if (destination.origin !== win.location.origin || safe(destination)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    leave(destination);
  }
  function pop(event) {
    if (leaving) { event.stopImmediatePropagation(); return; }
    if (!isLoaded()) return;
    const destination = new URL(win.location.href);
    if (safe(destination)) { lastSafeUrl = destination.href; return; }
    // Back changes the URL before notifying listeners. Restore the safe address
    // before unloading, and prevent a later SDK history listener from observing it.
    event.stopImmediatePropagation();
    originalReplace.call(win.history, win.history.state, '', lastSafeUrl);
    leave(destination);
  }
  function storage(event) {
    if (isLoaded() && /^sb-.*-auth-token(?:\.|$)/.test(event.key || '') && event.newValue) {
      leave(new URL(win.location.href));
    }
  }
  function pageshow(event) {
    // A cached document may predate an account arrival or a withdrawal elsewhere.
    if (event.persisted && isLoaded()) leave(new URL(win.location.href));
  }
  doc.addEventListener('click', click, true);
  win.addEventListener('popstate', pop, true);
  win.addEventListener('hashchange', pop, true);
  win.addEventListener('storage', storage, true);
  win.addEventListener('pageshow', pageshow, true);
  return () => {
    if (win.history.pushState === push) win.history.pushState = originalPush;
    if (win.history.replaceState === replace) win.history.replaceState = originalReplace;
    doc.removeEventListener('click', click, true);
    win.removeEventListener('popstate', pop, true);
    win.removeEventListener('hashchange', pop, true);
    win.removeEventListener('storage', storage, true);
    win.removeEventListener('pageshow', pageshow, true);
  };
}
