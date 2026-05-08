'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const supabase = createClient()

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    // Supabase automatically picks up the hash fragment and sets the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        router.replace('/')
      }
    })

    // Also check if session already exists (e.g. page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/')
      }
    })

    // Fallback: if nothing happens in 6 seconds, link has expired
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      router.replace('/link-expired')
    }, 6000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <p style={{ fontSize: 15, color: '#888' }}>Signing you in…</p>
    </div>
  )
}
