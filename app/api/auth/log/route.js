import { NextResponse } from 'next/server'

// OTP failure-mode logging (ticket §4 + AC5). The OTP send/verify calls happen
// on the browser Supabase client, so the real Supabase errors only exist
// client-side. This route is where the client ships them so they land in the
// server (Vercel function) logs — distinguished per failure mode, never
// papered over.
export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { phase, mode, code, status, message } = payload || {}
  console.error(
    `[otp] ${phase ?? 'unknown'} failed — mode=${mode ?? 'unknown'} ` +
      `code=${code ?? 'n/a'} status=${status ?? 'n/a'} message=${message ?? 'n/a'}`
  )

  return NextResponse.json({ ok: true })
}
