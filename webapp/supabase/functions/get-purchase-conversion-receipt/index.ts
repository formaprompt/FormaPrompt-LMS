import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { createPurchaseConversionReceiptHandler } from '../_shared/purchaseConversionReceipt.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error('Configuration indisponible.');
  return value;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(createPurchaseConversionReceiptHandler({
  createAuthClient: () => createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), options),
  createReadClient: () => createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), options),
}));
