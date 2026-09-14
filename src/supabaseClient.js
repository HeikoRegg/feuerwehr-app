import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase-Zugangsdaten fehlen. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY als Umgebungsvariablen setzen (lokal in .env, bei Netlify in den Site-Einstellungen).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
