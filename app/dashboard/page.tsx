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
      if (!user) { router.push('/auth/login'); return }
      const roleRes = await fetch('/api/roles')
      const roleData = roleRes.ok ? await roleRes.json() : { role: 'guest' }
      if (roleData.role === 'blocked') { router.push('/blocked'); return }
      setUser({ ...user, role: roleData.role })
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'linear-gradient(135deg,#4361ee 0%,#3a0ca3 60%,#7b2ff7 100%)',fontFamily:'system-ui'}}>
      <div style={{color:'white',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>💰</div>
        <div style={{fontSize:'16px',fontWeight:'600'}}>Loading...</div>
      </div>
    </div>
  )

  return <DashboardApp user={user} supabase={supabase} />
}

function DashboardApp({ user, supabase }: { user: any, supabase: any }) {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    const w = window as any
    w._userId = user.id
    w._userEmail = user.email
    w._userName = user.user_metadata?.full_name || user.email
    w.__dashboardHydrated = false

    // Ensure no stale in-memory dashboard state survives user switches.
    delete w.S
    delete w.TRANSACTIONS
    const oldScript = document.getElementById('dashboard-script')
    if (oldScript) oldScript.remove()

    // 1. Load dashboard.js (sets window.S from localStorage)
    const script = document.createElement('script')
    script.id = 'dashboard-script'
    script.src = '/dashboard.js'
    script.onload = () => {
      // 2. Now patch saveS to also sync to Supabase
      const orig = w.saveS
      if (orig) {
        w.saveS = function() {
          orig()
          // Prevent destructive early writes before initial server hydration completes.
          if (!w.__dashboardHydrated) return
          // Include transactions in save (they live in window.TRANSACTIONS not window.S)
        const stateWithTx = { ...w.S, transactions: w.TRANSACTIONS || [] }
        fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, state: stateWithTx })
          }).catch(() => {})
        }
      }

      // 3. Load from Supabase and apply on top of localStorage
      fetch('/api/data?userId=' + user.id)
        .then(r => r.json())
        .then(d => {
          if (!w.S) return
          let changed = false
          // Always set arrays/objects from server response (including empty),
          // so one user's data can never leak into another session.
          w.S.assets = d.assets || []
          w.S.liabilities = d.liabilities || []
          w.S.categories = d.categories || []
          w.S.budgets = d.budgets || []
          w.S.cpfTransactions = d.cpfTxs || []
          w.S.catOverrides = d.catOverrides || {}
          w.TRANSACTIONS = d.transactions || []
          changed = true
          if (d.settings) {
            const s = d.settings
            if (s.theme)                  w.S.theme = s.theme
            if (s.usd_sgd)               w.S.usdSgd = s.usd_sgd
            if (s.api_key)               w.S.apiKey = s.api_key
            if (s.alpha_vantage_key)     w.S.alphaVantageKey = s.alpha_vantage_key
            if (s.share_api_key != null) w.S.shareApiKey = s.share_api_key
            if (s.include_cpf_in_nw != null) w.S.includeCPFinNW = s.include_cpf_in_nw
            if (s.peer_data) {
              w.S.peerData = s.peer_data
              if (s.peer_data.theme) {
                w.S.theme = s.peer_data.theme
              }
              if (s.peer_data.palette) {
                w.S.palette = s.peer_data.palette
              }
              if (Array.isArray(s.peer_data.forexHoldings)) {
                w.S.forexHoldings = s.peer_data.forexHoldings
              }
            }
            changed = true
          }
          if (d.sharedApiKey)   w._sharedApiKey = d.sharedApiKey
          if (d.sharedAlphaKey) w._sharedAlphaKey = d.sharedAlphaKey
          if (changed) {
            if (w.renderNW)    w.renderNW()
            if (w.calcSummary) w.calcSummary()
            if (w.filterTx)    w.filterTx()
            if (w.applyTheme)  w.applyTheme()
            if (w.loadApiKeyDisplay)  w.loadApiKeyDisplay()
            if (w.loadAlphaKeyDisplay) w.loadAlphaKeyDisplay()
          }
          w.__dashboardHydrated = true
        })
        .catch(() => {
          // If fetch fails, keep sync disabled to avoid wiping server state.
          w.__dashboardHydrated = false
        })

      // 4. Show user info
      const nameEl = document.getElementById('user-display-name')
      if (nameEl) nameEl.textContent = user.user_metadata?.full_name?.split(' ')[0] || 'You'
      const btn = document.getElementById('signout-btn')
      if (btn) btn.style.display = 'flex'
      const avatar = document.getElementById('user-avatar') as HTMLImageElement
      if (avatar && user.user_metadata?.avatar_url) {
        avatar.src = user.user_metadata.avatar_url
        avatar.style.display = 'block'
      }
    }
    document.body.appendChild(script)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DASHBOARD_BODY }} />
      <div id="signout-btn" style={{display:'none',position:'fixed',top:'11px',right:'16px',
        zIndex:200,alignItems:'center',gap:'8px',maxWidth:'340px'}}>
        <img id="user-avatar" width={32} height={32}
          style={{borderRadius:'50%',display:'none',border:'2px solid var(--border)'}} alt="" />
        <span id="user-display-name" style={{fontSize:'13px',fontWeight:600,
          color:'var(--text2)',background:'var(--surface2)',padding:'4px 10px',
          borderRadius:'20px',border:'1px solid var(--border)',maxWidth:'110px',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} />
        {user?.role === 'owner' && (
          <a href="/admin" style={{fontSize:'12px',fontWeight:600,color:'var(--accent)',
            background:'var(--accent-light)',border:'1.5px solid var(--accent)',
            borderRadius:'8px',padding:'4px 12px',cursor:'pointer',
            fontFamily:'Outfit,sans-serif',textDecoration:'none'}}>
            👑 Users
          </a>
        )}
        <button onClick={handleSignOut} style={{fontSize:'12px',fontWeight:600,
          color:'var(--text3)',background:'transparent',border:'none',
          cursor:'pointer',fontFamily:'Outfit,sans-serif',padding:'4px 8px',
          textDecoration:'underline'}}>
          Sign out
        </button>
      </div>
    </>
  )
}
