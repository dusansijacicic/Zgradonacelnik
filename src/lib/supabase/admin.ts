import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const pub = getPublicEnv();
  const srv = getServerEnv();
  if (!pub.NEXT_PUBLIC_SUPABASE_URL || !srv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY (server-only) ili NEXT_PUBLIC_SUPABASE_URL.",
    );
  }
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

