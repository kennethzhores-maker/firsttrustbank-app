import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase config. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const EDGE_FUNCTION_NAME =
  import.meta.env.VITE_SUPABASE_EDGE_FUNCTION ?? "super-worker";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
