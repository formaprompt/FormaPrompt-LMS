const GENERIC_PASSWORD_SECURITY_ERROR = 'Le contrôle de sécurité du mot de passe ne peut pas être effectué.';

async function invokePasswordSecurity(supabase, body) {
  const { data, error } = await supabase.functions.invoke('secure-password-auth', { body });
  if (!error && data?.success) return data;

  let message = data?.error;
  if (!message && error?.context && typeof error.context.json === 'function') {
    const payload = await error.context.json().catch(() => null);
    message = payload?.error;
  }
  throw new Error(message || GENERIC_PASSWORD_SECURITY_ERROR);
}

export function secureSignup(supabase, email, password) {
  return invokePasswordSecurity(supabase, { action: 'signup', email, password });
}

export function securePasswordUpdate(supabase, password) {
  return invokePasswordSecurity(supabase, { action: 'update_password', password });
}
