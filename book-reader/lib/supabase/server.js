import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config'

// Server-side client bound to the request's cookies — respects RLS and acts as
// the signed-in reader. Use this in route handlers and server components.
export function getSupabaseServer() {
  if (!isSupabaseConfigured()) return null
  const store = cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Called from a Server Component — middleware refreshes the session
          // instead, so this is safe to ignore.
        }
      },
    },
  })
}

// The currently signed-in user, or null. Never throws.
export async function getCurrentUser() {
  const supabase = getSupabaseServer()
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data?.user || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
//  Service-role client. Bypasses RLS — SERVER ONLY, never import from a
//  client component. Used by the dashboard route handlers (behind the
//  dashboard password) and by the "forget me" deletion.
// ---------------------------------------------------------------------------
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) return null
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const isAdminConfigured = () =>
  Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
