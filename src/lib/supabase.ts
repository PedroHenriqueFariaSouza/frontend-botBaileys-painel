import { createClient } from "@supabase/supabase-js";

// Lidas do .env (VITE_SUPABASE_URL e VITE_SUPABASE_KEY)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Singleton compartilhado por todas as páginas — não criar múltiplas instâncias
export const supabase = createClient(supabaseUrl, supabaseKey);
