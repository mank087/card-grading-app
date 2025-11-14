import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  // Trim environment variables to remove any accidental whitespace/newlines
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  return createClient(
    supabaseUrl,
    serviceRoleKey // use the service role key for server-side
  );
}
