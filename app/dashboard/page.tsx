'use client'
import { DASHBOARD_CSS, DASHBOARD_BODY, DASHBOARD_SCRIPT } from './content'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login')
      } else {
        setUser(user)
        setLoading(false)
      }
    })
  }, [])

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg,#4361ee 0%,#3a0ca3 60%,#7b2ff7 100%)',
      fontFamily: 'system-ui,sans-serif'
    }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💰</div>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Loading your dashboard...</div>
      </div>
    </div>
  )

  return <DashboardApp user={user} supabase={supabase} />
}

function DashboardApp({ user, supabase }: { user: any, supabase: any }) {
  const scriptInjected = useRef(false)

  useEffect(() => {
    if (scriptInjected.current) return
    scriptInjected.current = true

    // Execute the dashboard script by creating a proper script element
    const script = document.createElement('script')
    script.textContent = DASHBOARD_SCRIPT
    document.body.appendChild(script)

    // After script runs, inject user info into the dashboard
    setTimeout(() => {
      const w = window as any
      if (w.S) {
        w.S._loggedInEmail = user.email
        w.S._loggedInName = user.user_metadata?.full_name || user.email
      }
      // Show user info + sign out button in topbar
      const nameEl = document.getElementById('user-display-name')
      if (nameEl) nameEl.textContent = user.user_metadata?.full_name?.split(' ')[0] || 'You'
      const signOutBtn = document.getElementById('signout-btn')
      if (signOutBtn) signOutBtn.style.display = 'flex'
      const avatarEl = document.getElementById('user-avatar') as HTMLImageElement
      if (avatarEl && user.user_metadata?.avatar_url) {
        avatarEl.src = user.user_metadata.avatar_url
        avatarEl.style.display = 'block'
      }
    }, 300)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DASHBOARD_BODY }} />

      {/* Sign out button — fixed bottom right */}
      <div
        id="signout-btn"
        style={{
          display: 'none', position: 'fixed', bottom: '80px', right: '28px',
          zIndex: 200, alignItems: 'center', gap: '10px',
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)'
        }}
      >
        <img
          id="user-avatar"
          width={28} height={28}
          style={{ borderRadius: '50%', display: 'none' }}
          alt=""
        />
        <span id="user-display-name" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }} />
        <button
          onClick={handleSignOut}
          style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--red)',
            background: 'var(--red-bg)', border: '1.5px solid var(--red)',
            borderRadius: '8px', padding: '4px 12px', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          Sign Out
        </button>
      </div>
    </>
  )
}
