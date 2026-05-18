import { createClient } from "@supabase/supabase-js";
import type { DbClient, Env } from "../types.ts";

export function createSupabaseClient(env: Env): DbClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as DbClient;
}
