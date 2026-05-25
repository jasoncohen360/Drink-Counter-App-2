import { createClient } from "@supabase/supabase-js";

// ============================================================
// YOUR TWO KEYS GO HERE (from Stage 1, Step 4)
// ============================================================
// The clean way (used automatically when you deploy to Vercel)
// is environment variables. But so you can also just run it
// locally or paste directly, you can fill the fallbacks below.
//
// EITHER set these in Vercel as:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// OR paste them directly into the two fallback strings below.
// ============================================================

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "PASTE_YOUR_SUPABASE_URL_HERE";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

if (SUPABASE_URL.includes("PASTE_") || SUPABASE_ANON_KEY.includes("PASTE_")) {
  console.warn(
    "Supabase keys not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, " +
      "or paste them into src/supabaseClient.js."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
