'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    const supabase = createClient()
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <div style={{
      minHeight:'100vh', background:'linear-gradient(135deg,#4361ee 0%,#3a0ca3 60%,#7b2ff7 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif'
    }}>
      <div style={{
        background:'white', borderRadius:'20px', padding:'48px 40px', width:'380px',
        boxShadow:'0 20px 60px rgba(0,0,0,.2)', textAlign:'center'
      }}>
        <div style={{fontSize:'36px', marginBottom:'8px'}}>💰</div>
        <h1 style={{fontSize:'24px', fontWeight:'800', color:'#0d0f1a', marginBottom:'6px', letterSpacing:'-.5px'}}>
          Family Finance
        </h1>
        <p style={{fontSize:'14px', color:'#7b82a8', marginBottom:'32px', fontWeight:'500'}}>
          Secure sign-in to your dashboard
        </p>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width:'100%', padding:'14px', borderRadius:'12px', border:'1.5px solid #e3e6f0',
            background:'white', cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', gap:'12px', fontSize:'15px', fontWeight:'600',
            color:'#0d0f1a', transition:'all .15s', opacity: loading ? .6 : 1
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>
        <p style={{fontSize:'12px', color:'#a0a8b8', marginTop:'24px', lineHeight:'1.6'}}>
          Sign in with your authorized Google account.
        </p>
      </div>
    </div>
  )
}
