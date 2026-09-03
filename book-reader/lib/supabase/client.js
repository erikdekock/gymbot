'use client'

// Browser Supabase client. Uses @supabase/ssr so the session lives in cookies
// and is therefore visible to middleware, route handlers and server components
// — that's what lets sendBeacon() posts to /api/events carry the user's session.

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config'

let client = null

export function getSupabaseBrowser() {
  if (!isSupabaseConfigured()) return null
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}
