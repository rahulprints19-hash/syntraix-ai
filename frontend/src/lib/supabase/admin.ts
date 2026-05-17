import { createClient } from "@supabase/supabase-js";

import { env, requireEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    requireEnv(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
