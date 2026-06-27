'use client'

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// A single browser client. If env vars are missing we return null so the app
// still renders (the reader works fine without analytics configured).
let client = null
if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: { persistSession: false },
  })
}

export const supabase = client

export function isAnalyticsEnabled() {
  return Boolean(client)
}
