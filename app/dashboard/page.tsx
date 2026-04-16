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
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    if (scriptInjected.current) return
    scriptInjected.current = true

    // Load all user data from Supabase first, then init dashboard
    loadAndInitDashboard()
  }, [])

  async function loadAndInitDashboard() {
    const w = window as any
    try {
      // Fetch all user data from Supabase
      const res = await fetch('/api/data?userId=' + user.id)
      const data = res.ok ? await res.json() : null

      // Build state from Supabase data or use defaults
      if (data && (data.assets?.length || data.settings)) {
        // Store loaded data in window for dashboard to pick up
        w._supabaseData = data
        w._userId = user.id
      }
    } catch (e) {
      console.warn('Could not load from Supabase, using localStorage fallback:', e)
    }

    // Execute the dashboard script
    const script = document.createElement('script')
    script.textContent = DASHBOARD_SCRIPT
    document.body.appendChild(script)

    // After script runs, apply Supabase data and set up sync
    setTimeout(() => {
      if (w.S && w._supabaseData) {
        const d = w._supabaseData
        // Apply loaded data to dashboard state
        if (d.assets?.length) w.S.assets = d.assets
        if (d.liabilities?.length) w.S.liabilities = d.liabilities
        if (d.categories?.length) w.S.categories = d.categories
        if (d.budgets?.length) w.S.budgets = d.budgets
        if (d.cpfTxs?.length) w.S.cpfTransactions = d.cpfTxs
        if (d.catOverrides) w.S.catOverrides = d.catOverrides
        if (d.settings) {
          const s = d.settings
          if (s.theme) w.S.theme = s.theme
          if (s.usd_sgd) w.S.usdSgd = s.usd_sgd
          if (s.api_key) w.S.apiKey = s.api_key
          if (s.include_cpf_in_nw !== null) w.S.includeCPFinNW = s.include_cpf_in_nw
          if (s.peer_data) w.S.peerData = s.peer_data
        }
        // Re-render with loaded data
        if (w.renderNW) w.renderNW()
        if (w.calcSummary) w.calcSummary()
        if (w.applyTheme) w.applyTheme()
        if (w.loadApiKeyDisplay) w.loadApiKeyDisplay()
      }

      // Set up auto-sync: patch saveS() to also save to Supabase
      const originalSaveS = w.saveS
      w.saveS = async function() {
        originalSaveS() // still save to localStorage as backup
        // Sync to Supabase in background
        try {
          await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, state: w.S })
          })
        } catch(e) {
          console.warn('Supabase sync failed, data saved locally:', e)
        }
      }

      w.S._loggedInEmail = user.email
      w.S._userId = user.id

      // Show user info
      const nameEl = document.getElementById('user-display-name')
      if (nameEl) nameEl.textContent = user.user_metadata?.full_name?.split(' ')[0] || 'You'
      const signOutBtn = document.getElementById('signout-btn')
      if (signOutBtn) signOutBtn.style.display = 'flex'
      const avatarEl = document.getElementById('user-avatar') as HTMLImageElement
      if (avatarEl && user.user_metadata?.avatar_url) {
        avatarEl.src = user.user_metadata.avatar_url
        avatarEl.style.display = 'block'
      }
      setDbReady(true)
    }, 400)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DASHBOARD_BODY }} />

      {/* Sign out — injected into topbar right side after render */}
      <div
        id="signout-btn"
        style={{
          display: 'none', position: 'fixed', top: '11px', right: '70px',
          zIndex: 200, alignItems: 'center', gap: '10px',
        }}
      >
        <img
          id="user-avatar"
          width={32} height={32}
          style={{ borderRadius: '50%', display: 'none', border: '2px solid var(--border)' }}
          alt=""
        />
        <span id="user-display-name" style={{
          fontSize: '13px', fontWeight: 600, color: 'var(--text2)',
          background: 'var(--surface2)', padding: '4px 10px',
          borderRadius: '20px', border: '1px solid var(--border)'
        }} />
        <button
          onClick={handleSignOut}
          style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--text3)',
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            padding: '4px 8px', borderRadius: '6px',
            textDecoration: 'underline'
          }}
        >
          Sign out
        </button>
      </div>
    </>
  )
}
