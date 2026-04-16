'use client'
import { DASHBOARD_CSS, DASHBOARD_BODY } from './content'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      // Check user role
      const roleRes = await fetch('/api/roles')
      const roleData = roleRes.ok ? await roleRes.json() : { role: 'guest' }
      if (roleData.role === 'blocked') {
        router.push('/blocked')
        return
      }
      setUser({ ...user, role: roleData.role })
      setLoading(false)
    }
    checkAuth()
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

    // Step 1: Pre-set user info so script can access it immediately
    w._userId = user.id
    w._userEmail = user.email
    w._userRole = user.role || 'guest'

    // Load dashboard JS as external static file (avoids CSP/inline script issues)
    await new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if (w.S) { resolve(); return; }
      const script = document.createElement('script')
      script.src = '/dashboard.js'
      script.onload = () => resolve()
      script.onerror = (e) => reject(new Error('Failed to load dashboard.js: ' + e))
      document.body.appendChild(script)
    })

    // Step 2: Wait for script to initialise, then load Supabase data on top
    // Retry up to 10 times with 200ms intervals (2 seconds total)
    // Wait for dashboard.js to set window.S
    let retries = 0
    while (!w.S && retries < 15) {
      await new Promise(r => setTimeout(r, 200))
      retries++
    }

    if (!w.S) {
      console.error('Dashboard script failed to initialise after', retries, 'retries')
      document.body.innerHTML += '<div style="padding:40px;font-family:system-ui;color:red;background:white">Dashboard failed to load. <button onclick="location.reload()">Refresh</button></div>'
      return
    }
    console.log('✅ Dashboard initialised, S exists:', !!w.S, 'after', retries * 200, 'ms')

    // Step 3: Confirm user info (already set in step 1)
    if (w.S) {
      w.S._loggedInEmail = user.email
      w.S._userId = user.id
      w.S._userRole = user.role || 'guest'
    }

    // Step 4: Load from Supabase (overrides localStorage with server truth)
    try {
      const res = await fetch('/api/data?userId=' + user.id)
      if (res.ok) {
        const d = await res.json()
        let hasServerData = false

        // Apply assets if server has any
        if (d.assets && d.assets.length > 0) {
          w.S.assets = d.assets
          hasServerData = true
        }
        if (d.liabilities && d.liabilities.length > 0) {
          w.S.liabilities = d.liabilities
          hasServerData = true
        }
        if (d.categories && d.categories.length > 0) {
          w.S.categories = d.categories
        }
        if (d.budgets && d.budgets.length > 0) {
          w.S.budgets = d.budgets
        }
        if (d.cpfTxs && d.cpfTxs.length > 0) {
          w.S.cpfTransactions = d.cpfTxs
        }
        if (d.catOverrides && Object.keys(d.catOverrides).length > 0) {
          w.S.catOverrides = d.catOverrides
        }
        if (d.settings) {
          const s = d.settings
          if (s.theme) w.S.theme = s.theme
          if (s.usd_sgd) w.S.usdSgd = s.usd_sgd
          if (s.api_key) w.S.apiKey = s.api_key
          if (s.alpha_vantage_key) w.S.alphaVantageKey = s.alpha_vantage_key
          if (s.share_api_key !== null) w.S.shareApiKey = s.share_api_key
          if (s.include_cpf_in_nw !== null) w.S.includeCPFinNW = s.include_cpf_in_nw
          if (s.peer_data) w.S.peerData = s.peer_data
          hasServerData = true
        }
        if (d.sharedApiKey) w._sharedApiKey = d.sharedApiKey
        if (d.sharedAlphaKey) w._sharedAlphaKey = d.sharedAlphaKey

        // Re-render with server data
        if (hasServerData) {
          if (w.renderNW) w.renderNW()
          if (w.calcSummary) w.calcSummary()
          if (w.applyTheme) w.applyTheme()
          if (w.loadApiKeyDisplay) w.loadApiKeyDisplay()
          if (w.loadAlphaKeyDisplay) w.loadAlphaKeyDisplay()
          if (w.syncShareKeyUI) w.syncShareKeyUI()
        }
      }
    } catch (e) {
      console.warn('Supabase load failed, using localStorage:', e)
    }

    // Step 5: Patch saveS to sync to Supabase on every save
    const originalSaveS = w.saveS
    w.saveS = function() {
      originalSaveS() // Save to localStorage first (instant)
      // Then sync to Supabase in background (non-blocking)
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, state: w.S })
      }).catch(e => console.warn('Supabase sync failed:', e))
    }

    // Step 6: UI polish
    const nameEl = document.getElementById('user-display-name')
    if (nameEl) nameEl.textContent = user.user_metadata?.full_name?.split(' ')[0] || 'You'
    const signOutBtn = document.getElementById('signout-btn')
    if (signOutBtn) signOutBtn.style.display = 'flex'
    const avatarEl = document.getElementById('user-avatar') as HTMLImageElement
    if (avatarEl && user.user_metadata?.avatar_url) {
      avatarEl.src = user.user_metadata.avatar_url
      avatarEl.style.display = 'block'
    }

    // Warn guests they need their own API key
    if (user.role === 'guest' && !w.S.apiKey) {
      setTimeout(() => {
        if (w.showToast) w.showToast('👋 Welcome! Go to Settings to add your Anthropic API key for AI features.', 6000)
      }, 1500)
    }

    // Check for pending family invites
    fetch('/api/family').then(r => r.json()).then(familyData => {
      if (familyData?.pending?.length > 0) {
        const groupName = familyData.pending[0].family_groups?.name || 'a family group'
        setTimeout(() => {
          if (w.showToast) w.showToast('📨 Pending invite to "' + groupName + '". Check Settings → Family.', 8000)
        }, 1000)
      }
      if (familyData) w._familyData = familyData
    }).catch(() => {})

    setDbReady(true)

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
        {user?.role === 'owner' && (
          <a href="/admin" style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
            background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
            borderRadius: '8px', padding: '4px 12px', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', textDecoration: 'none'
          }}>
            👑 Users
          </a>
        )}
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
