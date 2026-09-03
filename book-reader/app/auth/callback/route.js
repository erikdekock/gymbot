import { NextResponse } from 'next/server'
import { getSupabaseServer } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

// Magic-link landing point. Supabase sends the reader here with either a PKCE
// `code` or a `token_hash`; both are exchanged for a session cookie, after
// which the reader goes straight to /read (which resumes their position).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') || 'magiclink'
  const next = searchParams.get('next') || '/read'

  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.redirect(`${origin}/`)

  let error = null

  if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  } else if (tokenHash) {
    ;({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }))
  } else {
    error = new Error('no code')
  }

  if (error) {
    return NextResponse.redirect(`${origin}/?error=link`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
