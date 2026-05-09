'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import FeedbackModal from '../../components/FeedbackModal'

const supabase = createClient()

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return email ? email[0].toUpperCase() : '?'
}

export default function Profile() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/welcome'); return }
    setUser(user)
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
  }

  async function handleDelete() {
    if (deleteInput !== 'DELETE') { setDeleteError('Type DELETE exactly as shown to confirm.'); return }
    setDeleting(true)
    const { data: sessions } = await supabase.from('sessions').select('id').eq('user_id', user.id)
    if (sessions?.length) {
      await supabase.from('exercises').delete().in('session_id', sessions.map(s => s.id))
    }
    await supabase.from('sessions').delete().eq('user_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/account-deleted')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/welcome')
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || ''
  const initials = getInitials(profile?.display_name, user?.email)
  const isAdmin = profile?.is_admin === true

  return (
    <div className="screen">
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {/* Topbar */}
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Profile</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Identity block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px 0' }}>
        <div className="avatar-circle">{initials}</div>
        <div>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--gb-text-primary)', margin: 0 }}>
            {displayName}
          </p>
          <p style={{ fontSize: 13, color: 'var(--gb-text-secondary)', margin: '2px 0 0' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Feedback hero */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => setShowFeedback(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 14px', display: 'block', width: '100%', textAlign: 'left', minHeight: 44 }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--gb-accent)' }}>
            Send us your feedback <span style={{ fontSize: 14 }}>→</span>
          </span>
        </button>
        <p style={{ fontSize: 12, color: 'var(--gb-text-secondary)', margin: '0 0 16px', lineHeight: 1.4 }}>
          Tell us what works and what doesn't. Every message is read.
        </p>
        <div style={{ height: 1, background: '#1c1c1c' }} />
      </div>

      {/* HELP */}
      <p className="section-label">HELP</p>
      <div className="grouped-card">
        <button
          className="list-row"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => router.push('/profile/get-help')}
        >
          <span className="list-row-label">Get help</span>
          <span className="list-row-value">›</span>
        </button>
      </div>

      {/* TRAINING */}
      <p className="section-label">TRAINING</p>
      <div className="grouped-card">
        <button
          className="list-row"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => router.push('/profile/target-weights')}
        >
          <span className="list-row-label">Target weights</span>
          <span className="list-row-value">›</span>
        </button>
      </div>

      {/* ACCOUNT */}
      <p className="section-label">ACCOUNT</p>
      <div className="grouped-card">
        <button
          className="list-row"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => {}}
        >
          <span className="list-row-label">Export my data</span>
          <span className="list-row-value">›</span>
        </button>
        <button
          className="list-row"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => router.push('/profile/terms')}
        >
          <span className="list-row-label">Terms, privacy & about</span>
          <span className="list-row-value">›</span>
        </button>
      </div>

      {/* Delete account */}
      <div style={{ padding: '24px 20px 0' }}>
        <button
          onClick={() => setShowDelete(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ fontSize: 15, color: 'var(--gb-destructive)' }}>Delete account</span>
        </button>
      </div>

      {/* Sign out — muted at very bottom */}
      <div style={{ marginTop: 12, padding: '14px 20px', textAlign: 'center', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={handleSignOut}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gb-text-secondary)', fontSize: 14 }}
        >
          Sign out
        </button>
      </div>

      {/* Admin — CEO only */}
      {isAdmin && (
        <>
          <div style={{ height: 1, background: 'var(--gb-border-row)', margin: '24px 20px 0' }} />
          <div className="grouped-card" style={{ marginTop: 12 }}>
            <button
              className="list-row"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => router.push('/admin')}
            >
              <span className="list-row-label">Admin invites</span>
              <span style={{ fontSize: 10, color: 'var(--gb-text-quiet)', letterSpacing: '0.1em', marginLeft: 8 }}>CEO</span>
              <span className="list-row-value" style={{ marginLeft: 'auto' }}>›</span>
            </button>
          </div>
        </>
      )}

      <div style={{ height: 48 }} />

      {/* Delete modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Delete your account?</p>
            <p className="modal-body">
              This permanently deletes your account and all training data. This cannot be undone.
            </p>
            <p style={{ fontSize: 13, color: 'var(--gb-text-secondary)', marginBottom: 8 }}>
              Type DELETE to confirm.
            </p>
            <input
              className="auth-input"
              style={{ marginBottom: 8 }}
              value={deleteInput}
              onChange={e => { setDeleteInput(e.target.value); setDeleteError('') }}
              placeholder="DELETE"
              autoCapitalize="characters"
            />
            {deleteError && <p className="auth-error" style={{ marginBottom: 8 }}>{deleteError}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button className="auth-btn" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                disabled={deleteInput !== 'DELETE' || deleting}
                onClick={handleDelete}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: deleteInput === 'DELETE' ? 'var(--gb-destructive)' : 'var(--gb-text-quiet)',
                  fontSize: 15, padding: '12px 0',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
