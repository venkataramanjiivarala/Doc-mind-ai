"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient: ReturnType<typeof createClient> | null = null;

/**
 * Client-component Supabase client (anon key). Reads/writes the
 * shared document library directly from the browser — this app has
 * no login, so RLS policies are wide open ("using (true)").
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

    browserClient = createClient(
      cleanUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
  }
  return browserClient;
}
