import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') ?? 'magiclink'
  const next = searchParams.get('next') ?? '/'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // PKCE flow (code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // OTP / magic link flow (token_hash)
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ 
      token_hash, 
      type: type === 'magiclink' ? 'magiclink' : type 
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Implicit flow — token is in the URL fragment, handle client-side
  // Redirect to a client page that reads the fragment
  return NextResponse.redirect(`${origin}/auth/confirm`)
}
