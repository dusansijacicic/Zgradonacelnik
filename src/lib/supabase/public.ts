import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";

/**
 * Anonimni klijent BEZ kolačića — za javne stranice koje se keširaju na CDN-u (ISR).
 * Čita samo ono što RLS dozvoljava svima (registar, objavljene recenzije, blog…).
 */
export function createSupabasePublicClient() {
  const env = requireSupabasePublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
