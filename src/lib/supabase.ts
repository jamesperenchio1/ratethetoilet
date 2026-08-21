import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars"
  );
}

/** The anon key and Storage base URL, for callers that need to hand-build a
 * request outside the SDK (e.g. a raw XHR upload for progress events). */
export const SUPABASE_ANON_KEY = anonKey;
export const SUPABASE_STORAGE_URL = `${url.replace(/\/$/, "")}/storage/v1`;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
