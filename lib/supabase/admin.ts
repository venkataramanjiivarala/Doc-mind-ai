import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — only ever import this
 * inside server-only code (Route Handlers). This app has no login, so
 * there's no per-user scoping to worry about, but never import this
 * into a Client Component regardless.
 */
export function getSupabaseAdminClient() {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!rawUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

  return createClient(cleanUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
