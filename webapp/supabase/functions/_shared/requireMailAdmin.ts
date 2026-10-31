import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { InputError } from './httpInput.js';

export async function requireMailAdmin(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new InputError('Connexion administrative requise.',401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const authClient = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{ auth:{persistSession:false,autoRefreshToken:false} });
  const { data: auth, error: authError } = await authClient.auth.getUser(token);
  if (authError || !auth.user?.id) throw new InputError('Session invalide ou expirée.',401);
  const database = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{ auth:{persistSession:false,autoRefreshToken:false} });
  const { data: actor, error } = await database.from('profiles').select('id,role').eq('id',auth.user.id).maybeSingle();
  if (error || actor?.role !== 'admin') throw new InputError('Action réservée aux administrateurs.',403);
  return { database, actor };
}
