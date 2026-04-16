import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const OWNER_EMAIL = 'jasontayzh@gmail.com'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const listAll = searchParams.get('list') === 'true'

  // Auto-assign role on first login
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!existingRole) {
    const role = user.email === OWNER_EMAIL ? 'owner' : 'guest'
    await supabase.from('user_roles').insert({
      user_id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url,
      role,
      approved_by: role === 'owner' ? user.id : null,
      approved_at: role === 'owner' ? new Date().toISOString() : null,
    })
    return NextResponse.json({ role, isNew: true })
  }

  await supabase.from('user_roles')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', user.id)

  if (listAll && existingRole.role === 'owner') {
    const { data: allUsers } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false })
    return NextResponse.json({ role: existingRole.role, users: allUsers })
  }

  // For partner role, also return the owner's userId so they can fetch owner data
  if (existingRole.role === 'partner') {
    const { data: ownerData } = await supabase
      .from('user_roles')
      .select('user_id, full_name, email')
      .eq('role', 'owner')
      .single()
    return NextResponse.json({ 
      role: existingRole.role,
      ownerUserId: ownerData?.user_id,
      ownerName: ownerData?.full_name 
    })
  }

  return NextResponse.json({ role: existingRole.role })
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerRole } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (callerRole?.role !== 'owner')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetUserId, newRole } = await request.json()
  if (!targetUserId || !['owner','partner','guest','blocked'].includes(newRole))
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  await supabase.from('user_roles')
    .update({ role: newRole, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('user_id', targetUserId)

  return NextResponse.json({ ok: true })
}
