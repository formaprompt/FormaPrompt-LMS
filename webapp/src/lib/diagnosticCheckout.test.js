import assert from 'node:assert/strict'
import test from 'node:test'
import { createDiagnosticCheckout, validateDiagnosticPromotion } from './diagnosticCheckout.js'

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

test('valide un code sans envoyer identité ni montant frontend', async () => {
  const calls = []
  const supabase = {
    functions: {
      invoke: async (...args) => {
        calls.push(args)
        return {
          data: {
            valid: true,
            code: 'DIAG10',
            catalog_amount_cents: 14_900,
            discount_amount_cents: 1_490,
            final_amount_cents: 13_410,
            acceptance_statement: buildDiagnosticPromoEvidence({ original_amount_cents: 14900,
              discount_amount_cents: 1490, final_amount_cents: 13410 }),
            message: 'Code promotionnel appliqué.',
          },
          error: null,
        }
      },
    },
  }
  const quote = await validateDiagnosticPromotion(supabase, ' diag10 ')
  assert.equal(quote.final_amount_cents, 13_410)
  assert.deepEqual(calls, [['validate-diagnostic-promotion', { body: { promo_code: ' diag10 ' } }]])
  assert.equal('user_id' in calls[0][1].body, false)
  assert.equal('email' in calls[0][1].body, false)
  assert.equal('amount' in calls[0][1].body, false)
});

test('refuse une réponse promotionnelle monétaire incohérente', async () => {
  const supabase = {
    functions: {
      invoke: async () => ({
        data: {
          valid: true,
          catalog_amount_cents: 14_900,
          discount_amount_cents: 1,
          final_amount_cents: 1,
        },
        error: null,
      }),
    },
  }
  await assert.rejects(() => validateDiagnosticPromotion(supabase, 'DIAG10'), /réponse de vérification/)
});
test('refuse zero et ne diffuse aucun detail interne de validation', async () => {
  const base = { valid: true, code: 'LOCAL', catalog_amount_cents: 14900, discount_amount_cents: 14900, final_amount_cents: 0 }
  await assert.rejects(validateDiagnosticPromotion({ functions: { invoke: async () => ({ data: base }) } }, 'LOCAL'), /réponse de vérification/)
  const quote = await validateDiagnosticPromotion({ functions: { invoke: async () => ({ data: {
    ...base, valid: false, code: null, discount_amount_cents: 0, final_amount_cents: 14900, message: 'Internal quota email restriction',
  } }) } }, 'LOCAL')
  assert.equal(quote.message, "Ce code n'est pas valide ou n'est plus disponible.")
})
import { buildDiagnosticPromoEvidence } from '../../supabase/functions/_shared/diagnosticContractEvidence.js'
