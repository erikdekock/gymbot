import { redirect } from 'next/navigation'
import SignIn from '../components/SignIn'
import { COPY } from '../lib/book-config'
import { getCurrentUser } from '../lib/supabase/server'
import { isAuthEnabled } from '../lib/supabase/config'

export const dynamic = 'force-dynamic'

// Landing page: the cover, and one field. Already signed in? Go straight to
// the book — the reader resumes at the last saved position by itself.
export default async function Home() {
  const authOn = isAuthEnabled()
  if (authOn) {
    const user = await getCurrentUser()
    if (user) redirect('/read')
  }

  const c = COPY.landing

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="mb-5 text-[11px] uppercase tracking-[0.32em]" style={{ color: 'var(--accent)' }}>
            {c.eyebrow}
          </p>
          <h1 className="font-display text-5xl leading-tight" style={{ color: 'var(--ink)' }}>
            {c.title}
          </h1>
          <div className="mx-auto my-6 h-px w-12" style={{ background: 'var(--rule)' }} aria-hidden="true" />
          <p className="font-display text-sm italic" style={{ color: 'var(--ink-soft)' }}>
            {c.author}
          </p>

          <p
            className="mx-auto mb-9 mt-10 max-w-sm text-sm leading-relaxed"
            style={{ color: 'var(--ink-soft)' }}
          >
            {c.intro}
          </p>
        </div>

        <SignIn authEnabled={authOn} />
      </div>
    </main>
  )
}
