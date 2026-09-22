import { createClient } from "@supabase/supabase-js";

// Fallbacks keep production working when Vercel env vars are missing.
// The anon key is public by design (safe to ship in the frontend).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://pohxtjoqwcoctywvfnzq.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvaHh0am9xd2NvY3R5d3ZmbnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTc5NjcsImV4cCI6MjA5OTE3Mzk2N30.PZiGIyVE-Gox-MrSXaCY85Osikav_Dc6Xiz0Cjjr2ZE";

export const EDGE_FUNCTION_NAME =
  import.meta.env.VITE_SUPABASE_EDGE_FUNCTION || "super-worker";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
