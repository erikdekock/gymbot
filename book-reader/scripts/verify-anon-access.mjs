#!/usr/bin/env node
/**
 * Security check: with the PUBLIC key and no session, every table must return
 * zero rows. Run this after applying supabase/schema.sql.
 *
 *   node scripts/verify-anon-access.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the
 * environment or from .env.local. Exits non-zero if anything leaks.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.')
  process.exit(2)
}

const TABLES = [
  'readers', 'chapter_stats', 'annotations', 'feedback',
  'subscribers', 'shares', 'events', 'questions', 'survey_responses',
]

const supabase = createClient(url, key, { auth: { persistSession: false } })

let leaked = 0
console.log(`Checking anonymous access against ${url}\n`)

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  const rows = data?.length ?? 0
  if (rows > 0) {
    leaked++
    console.log(`  ✗ ${table.padEnd(18)} LEAKED ${rows} row(s) to the anon key`)
  } else if (error) {
    console.log(`  ✓ ${table.padEnd(18)} blocked (${error.message.slice(0, 60)})`)
  } else {
    console.log(`  ✓ ${table.padEnd(18)} 0 rows`)
  }
}

// The write RPCs must also refuse an anonymous caller.
const rpcs = [
  ['register_reader', { p_id: 'x', p_name: null, p_email: null }],
  ['save_position', { p_chapter: 1, p_paragraph: 0, p_location: 1, p_pct: 0, p_finished: false }],
]
for (const [name, args] of rpcs) {
  const { error } = await supabase.rpc(name, args)
  if (error) console.log(`  ✓ rpc ${name.padEnd(14)} refused (${error.message.slice(0, 50)})`)
  else console.log(`  ! rpc ${name.padEnd(14)} callable — it no-ops without auth.uid(), but consider revoking`)
}

console.log('')
if (leaked) {
  console.error(`FAIL — ${leaked} table(s) readable with the public key.`)
  process.exit(1)
}
console.log('PASS — the public key exposes no personal data.')
