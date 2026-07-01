import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

let supabaseClient: SupabaseClient | null = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  const { createClient } = await import("@supabase/supabase-js");
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}
