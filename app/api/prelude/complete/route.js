import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { convertPreludeToEngineInput } from '../../../../lib/prelude/converter.mjs'
import { buildFirstWeekProgram } from '../../../../lib/engine/index.mjs'

// 12.3b — Prelude completion endpoint.
//
// POST: authenticated user submits their Prelude OnboardingState; the route
// runs converter (12.3a) → engine (12.3a), upserts the engine output into
// public.user_program, and returns the program. No live-AI hop, no
// templated-fallback path, no served_templated flag.
//
// Errors fall into three buckets:
//   - 401 — unauthenticated.
//   - 400 — converter rejected the prelude (ContractError or unresolvable
//           goal_id). The body is malformed at the input contract; the
//           client should not retry without changing the payload.
//   - 500 — engine threw (per 12.3a: bugs throw at build time; treat as 500
//           rather than swallowing into a fallback program).
//
// GET: read the caller's persisted program back. Returns 404 if none.
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let prelude
  try {
    prelude = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  let engineInput
  try {
    engineInput = convertPreludeToEngineInput(prelude)
  } catch (e) {
    return NextResponse.json(
      { error: 'converter_rejected', message: e.message, path: e.path ?? null },
      { status: 400 }
    )
  }

  let program
  try {
    program = buildFirstWeekProgram(engineInput)
  } catch (e) {
    console.error('[prelude/complete] engine threw:', e)
    return NextResponse.json(
      { error: 'engine_error', message: e.message },
      { status: 500 }
    )
  }

  const row = {
    user_id: user.id,
    program,
    engine_version: program.meta?.engine_version ?? null,
    kb_l5_version: program.meta?.kb_l5_version ?? null,
    goal_id: program.goal?.goal_id ?? null,
    goal_phase: program.goal?.goal_phase ?? null,
  }

  const { error: upsertError } = await supabase
    .from('user_program')
    .upsert(row, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[prelude/complete] upsert failed:', upsertError)
    return NextResponse.json(
      { error: 'persist_failed', message: upsertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ program })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const { data, error } = await supabase
    .from('user_program')
    .select('program')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'read_failed', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ program: data.program })
}
