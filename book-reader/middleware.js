import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const KEY_ = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Routes that require a signed-in reader.
const PROTECTED = ['/read']

export async function middleware(request) {
  // Without Supabase configured there is no auth at all — the reader stays
  // open so local preview and the no-backend demo keep working.
  if (!URL_ || !KEY_) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(URL_, KEY_, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Refreshes the session cookie as a side effect — must run on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except static assets — the session refresh needs to run broadly.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}
