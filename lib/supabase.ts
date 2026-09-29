import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aiiideoxiuzoizujkiui.supabase.co";
const supabasePublishableKey = "sb_publishable_uuSIOLsrpfoymU7ZJ8w32A_uOWufi9s";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
