'use client'
import { useRouter } from 'next/navigation'

export default function FirstLogin() {
  const router = useRouter()

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48 }}>
          <h1 className="auth-tagline">Welcome to GymBot.</h1>
          <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12 }}>
            Let's set things up.
          </p>
        </div>
      </div>

      <button className="auth-btn" onClick={() => router.push('/')}>
        Get started
      </button>
    </div>
  )
}
