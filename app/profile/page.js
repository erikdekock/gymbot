'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export default function Profile() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/welcome'); return }
    setUser(user)
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
  }

  function getInitials(name, email) {
    if (name) {
      const parts = name.trim().split(' ')
      return parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0][0].toUpperCase()
    }
    return email ? email[0].toUpperCase() : '?'
  }

  async function handleDelete() {
    if (deleteInput !== 'DELETE') { setDeleteError('Type DELETE exactly as shown to confirm.'); return }
    setDeleting(true)
    await supabase.from('exercises').delete().eq('session_id',
      (await supabase.from('sessions').select('id').eq('user_id', user.id)).data?.map(s => s.id) || []
    )
    await supabase.from('sessions').delete().eq('user_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/account-deleted')
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || ''
  const initials = getInitials(profile?.display_name, user?.email)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>
          ← Back
        </button>
        <span className="topbar-title">Profile</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Identity block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px 24px' }}>
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

      {/* Training section */}
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
        <div className="list-row">
          <span className="list-row-label">Tester profile</span>
          <span className="list-row-value">{profile?.tester_profile || 'Experienced'}</span>
        </div>
      </div>

      {/* Account section */}
      <p className="section-label">ACCOUNT</p>
      <div className="grouped-card">
        <button
          className="list-row"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={async () => { await supabase.auth.signOut(); router.push('/welcome') }}
        >
          <span className="list-row-label">Sign out</span>
          <span className="list-row-value">›</span>
        </button>
        <div className="list-row">
          <span className="list-row-label">Terms & privacy</span>
          <span className="list-row-value">›</span>
        </div>
        <div className="list-row">
          <span className="list-row-label">Export my data</span>
          <span className="list-row-value">›</span>
        </div>
      </div>

      {/* Destructive delete — not in a card, isolated */}
      <div style={{ padding: '32px 20px 48px' }}>
        <button
          onClick={() => setShowDelete(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ fontSize: 15, color: 'var(--gb-destructive)' }}>Delete account</span>
        </button>
      </div>

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
              <button
                className="auth-btn"
                onClick={() => setShowDelete(false)}
              >
                Cancel
              </button>
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
