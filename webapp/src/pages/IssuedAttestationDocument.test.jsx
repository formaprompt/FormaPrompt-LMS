import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import IssuedAttestationDocument from './IssuedAttestationDocument';

const mocks = vi.hoisted(() => ({
  user: { id: 'A' }, role: 'user', issuanceId: '77',
  navigate: vi.fn(), from: vi.fn(), requests: [], paperProps: [],
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: mocks.from } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: mocks.user, role: mocks.role }) }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ issuanceId: mocks.issuanceId }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../components/AttestationPaper', () => ({ default: props => {
  mocks.paperProps.push(props);
  return <p data-testid="historical-document">{props.snapshot.learnerName}</p>;
} }));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function row(owner, type = 'realisation', id = '77') {
  return { id, reference: `FP-REA-2026-FICTIF${id}`, user_id: owner,
    course_id: 'formation-prompt-level-1', document_type: type,
    issued_at: '2026-07-01T15:00:00Z', content_snapshot: { learnerName: `FICTIF ${owner}` } };
}
async function success(index, value) {
  await act(async () => { mocks.requests[index].resolve({ data: value, error: null }); });
}
async function reject(index) {
  await act(async () => { mocks.requests[index].reject(new Error('fixture transport detail')); });
}
const printButton = () => screen.getByRole('button', { name: /Imprimer ou enregistrer en PDF/ });

describe('IssuedAttestationDocument — local mocked reads, no issuance or network', () => {
  beforeEach(() => {
    mocks.user = { id: 'A' }; mocks.role = 'user'; mocks.issuanceId = '77';
    mocks.requests.length = 0; mocks.paperProps.length = 0;
    mocks.navigate.mockReset(); mocks.from.mockReset();
    mocks.from.mockImplementation(() => {
      const query = { select: () => query, eq: () => query, maybeSingle: () => {
        const pending = deferred(); mocks.requests.push(pending); return pending.promise;
      } };
      return query;
    });
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('A response while B is pending cannot expose A or enable printing', async () => {
    const view = render(<IssuedAttestationDocument />);
    mocks.user = { id: 'B' }; view.rerender(<IssuedAttestationDocument />);
    await success(0, row('A'));
    expect(screen.queryByTestId('historical-document')).not.toBeInTheDocument();
    expect(printButton()).toBeDisabled();
    await act(async () => { mocks.requests[1].resolve({ data: null, error: null }); });
    expect(screen.getByRole('alert')).toHaveTextContent('introuvable');
    expect(screen.queryByText('FICTIF A')).not.toBeInTheDocument();
    expect(printButton()).toBeDisabled();
  });

  it('hides an already displayed old snapshot before passive effects on account replacement', async () => {
    const layoutSnapshots = [];
    function Probe() {
      useLayoutEffect(() => { layoutSnapshots.push(screen.queryByTestId('historical-document')?.textContent || null); });
      return <IssuedAttestationDocument />;
    }
    const view = render(<Probe />); await success(0, row('A'));
    expect(screen.getByText('FICTIF A')).toBeInTheDocument();
    mocks.user = { id: 'B' }; view.rerender(<Probe />);
    expect(layoutSnapshots.at(-1)).toBeNull();
    expect(printButton()).toBeDisabled();
  });

  it('rapid A -> B -> A accepts only the last request generation', async () => {
    const view = render(<IssuedAttestationDocument />);
    mocks.user = { id: 'B' }; view.rerender(<IssuedAttestationDocument />);
    mocks.user = { id: 'A' }; view.rerender(<IssuedAttestationDocument />);
    await success(0, row('OLD A')); await reject(1);
    expect(screen.queryByTestId('historical-document')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await success(2, row('CURRENT A'));
    expect(screen.getByText('FICTIF CURRENT A')).toBeInTheDocument();
    expect(printButton()).toBeEnabled();
  });

  it('document requests resolved out of order cannot replace the current snapshot', async () => {
    const view = render(<IssuedAttestationDocument />);
    mocks.issuanceId = '88'; view.rerender(<IssuedAttestationDocument />);
    mocks.issuanceId = '99'; view.rerender(<IssuedAttestationDocument />);
    await success(2, row('CURRENT', 'competences', '99'));
    await success(0, row('OLD 77')); await success(1, row('OLD 88', 'realisation', '88'));
    expect(screen.getByText('FICTIF CURRENT')).toBeInTheDocument();
    expect(mocks.paperProps.at(-1).reference).toBe('FP-REA-2026-FICTIF99');
    expect(screen.queryByText(/FICTIF OLD/)).not.toBeInTheDocument();
  });

  it('a late rejection cannot replace the current document with an error', async () => {
    const view = render(<IssuedAttestationDocument />);
    mocks.user = { id: 'B' }; view.rerender(<IssuedAttestationDocument />);
    await success(1, row('B')); await reject(0);
    expect(screen.getByText('FICTIF B')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(printButton()).toBeEnabled();
  });

  it('unmount cancels delivery and remount starts a fresh request', async () => {
    const old = render(<IssuedAttestationDocument />); old.unmount();
    mocks.user = { id: 'B' }; render(<IssuedAttestationDocument />);
    await success(0, row('A'));
    expect(screen.queryByTestId('historical-document')).not.toBeInTheDocument();
    await success(1, row('B'));
    expect(screen.getByText('FICTIF B')).toBeInTheDocument();
  });

  it('disconnect hides the snapshot, redirects and ignores the pending rejection', async () => {
    const view = render(<IssuedAttestationDocument />);
    mocks.user = null; view.rerender(<IssuedAttestationDocument />); await reject(0);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(mocks.requests).toHaveLength(1);
    expect(window.print).not.toHaveBeenCalled();
  });

  it('an anonymous initial visit redirects without querying or displaying a document', () => {
    mocks.user = null; const view = render(<IssuedAttestationDocument />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('a role downgrade for the same identity hides the staff document and requires a fresh authorized read', async () => {
    mocks.role = 'admin'; const view = render(<IssuedAttestationDocument />);
    await success(0, row('OTHER LEARNER'));
    mocks.role = 'user'; view.rerender(<IssuedAttestationDocument />);
    expect(screen.queryByTestId('historical-document')).not.toBeInTheDocument();
    expect(printButton()).toBeDisabled();
    await act(async () => { mocks.requests[1].resolve({ data: null, error: { message: 'fixture denial' } }); });
    expect(screen.getByRole('alert')).toHaveTextContent('introuvable');
    expect(printButton()).toBeDisabled();
  });

  it('a current rejected read terminates loading with a neutral error and disabled printing', async () => {
    render(<IssuedAttestationDocument />); await reject(0);
    expect(screen.getByRole('alert')).toHaveTextContent('introuvable');
    expect(screen.queryByText('fixture transport detail')).not.toBeInTheDocument();
    expect(printButton()).toBeDisabled();
  });

  it.each(['realisation', 'competences'])('preserves historical %s paper props and printing after a successful read', async type => {
    render(<IssuedAttestationDocument />);
    expect(printButton()).toBeDisabled(); fireEvent.click(printButton());
    expect(window.print).not.toHaveBeenCalled();
    const value = row('A', type); await success(0, value);
    expect(mocks.paperProps.at(-1)).toEqual({ documentType: type, reference: value.reference,
      issuedAt: value.issued_at, snapshot: value.content_snapshot });
    fireEvent.click(printButton()); expect(window.print).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['admin', 'Retour aux évaluations', '/admin?onglet=corrections'],
    ['employee', 'Retour aux évaluations', '/admin?onglet=corrections'],
    ['user', 'Retour à mon espace', '/dashboard'],
  ])('preserves the %s back action and server-authorized historical read', async (role, label, destination) => {
    mocks.role = role; render(<IssuedAttestationDocument />);
    await success(0, row(role === 'user' ? 'A' : 'OTHER AUTHORIZED LEARNER'));
    expect(screen.getByTestId('historical-document')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(mocks.navigate).toHaveBeenCalledWith(destination);
  });
});
