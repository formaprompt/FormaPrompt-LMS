import assert from 'node:assert/strict'
import test from 'node:test'
import { createDiagnosticCheckout } from './diagnosticCheckout.js'

test('appelle uniquement le checkout Diagnostic sans montant frontend', async () => {
  const calls = []
  const supabase = {
    functions: {
      invoke: async (...args) => {
        calls.push(args)
        return { data: { url: 'https://checkout.stripe.com/c/pay/cs_test_safe' }, error: null }
      },
    },
  }
  const body = {
    sales_context: 'personal',
    cgv_accepted: true,
    cgv_version: 'CGV-B2C-2026-08-26',
  }
  const result = await createDiagnosticCheckout(supabase, body)
  assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_test_safe')
  assert.deepEqual(calls, [['create-diagnostic-checkout', { body }]])
  assert.equal('amount' in calls[0][1].body, false)
  assert.equal('user_id' in calls[0][1].body, false)
});

test('refuse une URL de redirection extérieure à Stripe', async () => {
  const supabase = {
    functions: { invoke: async () => ({ data: { url: 'https://example.test/faux-checkout' }, error: null }) },
  }
  await assert.rejects(() => createDiagnosticCheckout(supabase, {}), /adresse du paiement sécurisé/)
});

test('restitue une erreur serveur contrôlée', async () => {
  const supabase = {
    functions: {
      invoke: async () => ({
        data: null,
        error: { context: { json: async () => ({ error: 'Connexion requise avant le paiement.' }) } },
      }),
    },
  }
  await assert.rejects(() => createDiagnosticCheckout(supabase, {}), /Connexion requise/)
});
