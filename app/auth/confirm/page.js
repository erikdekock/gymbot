'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    // Handle implicit flow where token is in URL hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/')
      } else {
        // Listen for auth state change (triggered by hash fragment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            subscription.unsubscribe()
            router.push('/')
          }
        })
        // Timeout fallback
        setTimeout(() => {
          subscription.unsubscribe()
          router.push('/link-expired')
        }, 5000)
      }
    })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#888'
    }}>
      <p style={{ fontSize: 15 }}>Signing you in…</p>
    </div>
  )
}
