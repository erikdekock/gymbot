import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser, getSupabaseAdmin } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

// "Vergeet mij" — deletes the reader's application rows and then the auth user
// itself. Everything keyed to the user id cascades, so nothing is left behind.
export async function POST() {
  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  // Rows that don't cascade from auth.users (the text-keyed legacy tables).
  await supabase.rpc('forget_me')

  // Deleting the auth user needs the service role; it cascades events,
  // questions, surveys and feedback via their user_id foreign keys.
  const admin = getSupabaseAdmin()
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
