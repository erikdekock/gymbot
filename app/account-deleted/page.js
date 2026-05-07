'use client'
import { useRouter } from 'next/navigation'

export default function AccountDeleted() {
  const router = useRouter()

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <h1 className="auth-tagline" style={{ textAlign: 'center' }}>
            Your account has been deleted.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12 }}>
            All your training data has been removed.
          </p>
        </div>
      </div>

      <button className="auth-btn" onClick={() => router.push('/welcome')}>
        Return to start
      </button>
    </div>
  )
}
