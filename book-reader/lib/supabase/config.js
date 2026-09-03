// Shared Supabase configuration. Everything degrades gracefully: when the env
// vars are missing the app still runs — auth is bypassed, analytics become
// no-ops, and the dashboard shows empty states instead of crashing.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// Auth is only enforced when Supabase is actually configured, so local preview
// and the "no backend" demo mode keep working exactly as before.
export const isAuthEnabled = () => isSupabaseConfigured()
