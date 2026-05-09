'use client'
import { useRouter } from 'next/navigation'

export default function TermsPrivacyAbout() {
  const router = useRouter()

  return (
    <div className="screen" style={{ overflowY: 'auto' }}>
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Terms, privacy & about</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 20px 64px' }}>

        {/* TERMS */}
        <p className="section-label" style={{ paddingLeft: 0, marginBottom: 12 }}>TERMS</p>
        <div style={{ fontSize: 14, color: 'var(--gb-text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>
          <p>GymBot is alpha software. By using it you agree that:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
            <li>The app may have bugs, break, or change without notice.</li>
            <li>You won't hold GymBot liable for data loss, downtime, or any other issues.</li>
            <li>You'll give feedback when something isn't working — that's the deal.</li>
          </ul>
          <p style={{ marginTop: 12 }}>The alpha will end at some point. You'll get advance notice and a final chance to export your data.</p>
        </div>

        {/* PRIVACY */}
        <p className="section-label" style={{ paddingLeft: 0, marginBottom: 12 }}>PRIVACY</p>
        <div style={{ fontSize: 14, color: 'var(--gb-text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>
          <p><strong style={{ color: 'var(--gb-text-primary)' }}>What we store:</strong> your email (for login), your training data (sessions, sets, weights, RPE, notes), and basic metadata (sign-up date, login times).</p>
          <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--gb-text-primary)' }}>What we don't do:</strong> track you across other apps, share your data with third parties, or use it to train external AI.</p>
          <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--gb-text-primary)' }}>Where it lives:</strong> Supabase (hosted database). The GymBot admin can technically see all data — used only to improve the product.</p>
          <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--gb-text-primary)' }}>Your rights:</strong> delete your account and all data any time from the Profile screen. Export all your data as JSON any time. Weekly backups purge your data within ~7 days of account deletion.</p>
          <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--gb-text-primary)' }}>Login:</strong> magic link via email. Anyone with access to your email can access your account. Use a personal email you control.</p>
        </div>

        {/* ABOUT */}
        <p className="section-label" style={{ paddingLeft: 0, marginBottom: 12 }}>ABOUT</p>
        <div style={{ fontSize: 14, color: 'var(--gb-text-secondary)', lineHeight: 1.7 }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--gb-text-primary)', letterSpacing: '0.1em', marginBottom: 8 }}>GYMBOT</p>
          <p>Version {process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-alpha'}</p>
          <p style={{ marginTop: 4 }}>Built by the GymBot team.</p>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--gb-text-quiet)' }}>Last updated: May 2026</p>
        </div>
      </div>
    </div>
  )
}
