import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  'https://rmpilrdqjjznozafrwpv.supabase.co'

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  'sb_publishable_hZcLWier91MPw2ma0r0qIw_nCOuXGO4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export default supabase
