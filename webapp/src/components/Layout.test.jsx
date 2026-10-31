import { cleanup, render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Layout from './Layout';
import SEO from './SEO';

vi.mock('./Header', () => ({ default: () => <header /> }));
vi.mock('./Footer', () => ({ default: () => <footer /> }));
afterEach(cleanup);

it('le diagnostic garde un seul titre dédié sans le titre générique du Layout', async () => {
  render(<HelmetProvider><MemoryRouter initialEntries={['/diagnostic-ia']}><Routes>
    <Route path="/" element={<Layout />}>
      <Route path="diagnostic-ia" element={<SEO title="Diagnostic IA Express" description="Diagnostic" url="https://formaprompt.com/diagnostic-ia" />} />
    </Route>
  </Routes></MemoryRouter></HelmetProvider>);
  await waitFor(() => {
    expect(document.querySelectorAll('head > title')).toHaveLength(1);
    expect(document.title).toBe('Diagnostic IA Express');
  });
});

it('l’exception du diagnostic ne change pas le comportement de ses sous-routes', async () => {
  render(<HelmetProvider><MemoryRouter initialEntries={['/diagnostic-ia/confirmation']}><Routes>
    <Route path="/" element={<Layout />}>
      <Route path="diagnostic-ia/confirmation" element={<p>Confirmation</p>} />
    </Route>
  </Routes></MemoryRouter></HelmetProvider>);
  await waitFor(() => expect(document.title).toBe('FormaPrompt – Formations IA, Prompt Engineering, Bureautique'));
});
