'use client'
import { useRouter } from 'next/navigation'

export default function LinkExpired() {
  const router = useRouter()

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>⏱️</div>
          <h1 className="auth-tagline" style={{ textAlign: 'center' }}>This link has expired.</h1>
          <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
            Magic links work for one hour. Want a new one?
          </p>
        </div>
      </div>

      <button className="auth-btn" onClick={() => router.push('/login')}>
        Send me a new link
      </button>
    </div>
  )
}
