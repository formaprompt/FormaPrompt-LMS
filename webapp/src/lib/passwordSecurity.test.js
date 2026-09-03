import assert from 'node:assert/strict';
import test from 'node:test';
import { securePasswordUpdate, secureSignup } from './passwordSecurity.js';

test('transmet le mot de passe uniquement à l Edge Function dédiée', async () => {
  const calls = [];
  const supabase = {
    functions: {
      invoke: async (...args) => {
        calls.push(args);
        return { data: { success: true, warning: null }, error: null };
      },
    },
  };
  await secureSignup(supabase, 'personne@example.test', 'MotDePasseUniqueEtLong!');
  await securePasswordUpdate(supabase, 'AutreMotDePasseUnique!');
  assert.deepEqual(calls, [
    ['secure-password-auth', { body: { action: 'signup', email: 'personne@example.test', password: 'MotDePasseUniqueEtLong!' } }],
    ['secure-password-auth', { body: { action: 'update_password', password: 'AutreMotDePasseUnique!' } }],
  ]);
});

test('transmet un retour d inscription interne sans donnée Stripe', async () => {
  const calls = [];
  const supabase = {
    functions: {
      invoke: async (...args) => {
        calls.push(args);
        return { data: { success: true }, error: null };
      },
    },
  };
  await secureSignup(supabase, 'personne@example.test', 'MotDePasseUniqueEtLong!', '/diagnostic-ia#reserver');
  assert.deepEqual(calls[0], [
    'secure-password-auth',
    { body: {
      action: 'signup',
      email: 'personne@example.test',
      password: 'MotDePasseUniqueEtLong!',
      redirect_path: '/diagnostic-ia#reserver',
    } },
  ]);
});

test('restitue le message serveur sans exposer de détail technique', async () => {
  const supabase = {
    functions: {
      invoke: async () => ({ data: { error: 'Ce mot de passe est compromis.' }, error: new Error('FunctionsHttpError') }),
    },
  };
  await assert.rejects(() => securePasswordUpdate(supabase, 'MotDePasseCompromis!'), /mot de passe est compromis/);
});
