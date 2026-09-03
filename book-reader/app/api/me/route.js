import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// GET — who am I, where was I, and what have I agreed to.
export async function GET() {
  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ configured: false, user: null })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ configured: true, user: null })

  const { data } = await supabase
    .from('readers')
    .select(
      'id, first_name, last_name, email, current_chapter, current_paragraph, current_location, furthest_location, progress_pct, finished, analytics_consent, consent_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    configured: true,
    user: { id: user.id, email: user.email },
    reader: data || null,
  })
}

// PATCH — save the name captured after first login, record consent, and/or
// adopt a legacy localStorage reader id from before there were accounts.
export async function PATCH(request) {
  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: true, skipped: 'not configured' })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  let body = {}
  try {
    body = await request.json()
  } catch {
    /* empty patch is allowed */
  }

  const firstName = str(body.first_name, 80)
  const lastName = str(body.last_name, 80)
  const legacyId = str(body.legacy_reader_id, 64)

  // Ensure the reader row exists and is tied to the auth user.
  const { error: upsertError } = await supabase.rpc('ensure_reader', {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: user.email || null,
  })
  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 })
  }

  // Consent is explicit and never pre-ticked; only write it when told.
  if (typeof body.analytics_consent === 'boolean') {
    await supabase.rpc('set_analytics_consent', { p_consent: body.analytics_consent })
  }

  // Move any pre-account rows (keyed by the old localStorage id) onto this user.
  let claimed = null
  if (legacyId && legacyId !== user.id) {
    const { data, error } = await supabase.rpc('claim_legacy_reader', { p_legacy_id: legacyId })
    if (!error) claimed = data
  }

  return NextResponse.json({ ok: true, claimed })
}
