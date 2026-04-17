'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROLE_COLORS: Record<string, string> = {
  owner: '#059669', admin: '#4361ee', guest: '#d97706', blocked: '#dc2626'
}
const ROLE_LABELS: Record<string, string> = {
  owner: '👑 Owner', admin: '⚡ Admin', guest: '👤 Guest', blocked: '🚫 Blocked'
}

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [myRole, setMyRole] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const res = await fetch('/api/roles?list=true')
    const data = await res.json()
    if (data.role !== 'owner') { router.push('/dashboard'); return }
    setMyRole(data.role)
    setUsers(data.users || [])
    setLoading(false)
  }

  async function changeRole(userId: string, newRole: string) {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, newRole })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error ? `${data.error}${data.details ? `: ${data.details}` : ''}` : 'Failed to update role')
      await loadUsers()
      return
    }
    setUsers(prev => prev.map(u => u.user_id === userId ? {...u, role: newRole} : u))
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f2f7'}}>
      <div style={{fontSize:'14px',color:'#7b82a8'}}>Loading...</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f0f2f7',fontFamily:'Outfit,system-ui,sans-serif',padding:'32px'}}>
      <div style={{maxWidth:'800px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
          <div>
            <h1 style={{fontSize:'28px',fontWeight:'800',color:'#0d0f1a',letterSpacing:'-.5px'}}>
              👑 User Management
            </h1>
            <p style={{color:'#7b82a8',fontSize:'14px',marginTop:'4px'}}>
              Control who can access the Family Finance dashboard
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            style={{padding:'8px 18px',background:'white',border:'1.5px solid #e3e6f0',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',color:'#3d4266'}}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Role legend */}
        <div style={{background:'white',borderRadius:'12px',padding:'20px',marginBottom:'20px',border:'1px solid #e3e6f0'}}>
          <div style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',color:'#7b82a8',marginBottom:'12px'}}>Role Permissions</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <div key={role} style={{padding:'12px',background:'#f7f8fc',borderRadius:'8px',border:'1px solid #e3e6f0'}}>
                <div style={{fontSize:'14px',fontWeight:'700',color:ROLE_COLORS[role],marginBottom:'4px'}}>{label}</div>
                <div style={{fontSize:'11px',color:'#7b82a8',lineHeight:'1.5'}}>
                  {role==='owner'&&'Full access. Manage all users. See everything.'}
                  {role==='admin'&&'Own dashboard + can join family groups. Full control of own data.'}
                  {role==='guest'&&'Own dashboard only. Cannot see others. Default for new signups.'}
                  {role==='blocked'&&'Cannot access anything. Redirected to blocked page.'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User list */}
        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e3e6f0',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e3e6f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'15px',fontWeight:'700',color:'#0d0f1a'}}>{users.length} Users</div>
          </div>
          {users.map(u => (
            <div key={u.user_id} style={{padding:'16px 20px',borderBottom:'1px solid #e3e6f0',display:'flex',alignItems:'center',gap:'16px'}}>
              {u.avatar_url
                ? <img src={u.avatar_url} width={40} height={40} style={{borderRadius:'50%',border:'2px solid #e3e6f0'}} alt="" />
                : <div style={{width:40,height:40,borderRadius:'50%',background:'#e3e6f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>👤</div>
              }
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:'700',color:'#0d0f1a'}}>{u.full_name || u.email}</div>
                <div style={{fontSize:'12px',color:'#7b82a8'}}>{u.email}</div>
                <div style={{fontSize:'11px',color:'#a0a8b8',marginTop:'2px'}}>
                  Joined {new Date(u.created_at).toLocaleDateString('en-SG')} · Last seen {new Date(u.last_seen).toLocaleDateString('en-SG')}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{
                  padding:'4px 12px',borderRadius:'20px',fontSize:'12px',fontWeight:'700',
                  background: u.role==='owner'?'#dcfce7':u.role==='admin'?'#eef1fd':u.role==='blocked'?'#fdeef0':'#fff8e1',
                  color: ROLE_COLORS[u.role]
                }}>
                  {ROLE_LABELS[u.role]}
                </span>
                {u.role !== 'owner' && (
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.user_id, e.target.value)}
                    style={{
                      fontSize:'12px',fontWeight:'600',padding:'4px 10px',borderRadius:'6px',
                      border:'1.5px solid #e3e6f0',background:'white',color:'#3d4266',cursor:'pointer',
                      fontFamily:'Outfit,sans-serif'
                    }}
                  >
                    <option value="admin">Make Admin</option>
                    <option value="guest">Make Guest</option>
                    <option value="blocked">Block</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
