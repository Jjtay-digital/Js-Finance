'use client'
import { createClient } from '@/lib/supabase'

export default function BlockedPage() {
  const supabase = createClient()

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#f0f2f7', fontFamily:'system-ui,sans-serif'
    }}>
      <div style={{
        background:'white', borderRadius:'16px', padding:'48px 40px',
        width:'400px', textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,.1)'
      }}>
        <div style={{fontSize:'48px', marginBottom:'16px'}}>🔒</div>
        <h2 style={{fontSize:'22px', fontWeight:'800', marginBottom:'8px', color:'#0d0f1a'}}>
          Access Restricted
        </h2>
        <p style={{fontSize:'14px', color:'#7b82a8', marginBottom:'32px', lineHeight:'1.6'}}>
          Your account doesn't have permission to access this dashboard.
          Contact Jason if you believe this is a mistake.
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/auth/login')}
          style={{
            padding:'12px 24px', background:'#4361ee', color:'white',
            border:'none', borderRadius:'8px', cursor:'pointer',
            fontSize:'14px', fontWeight:'600'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
