import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
}

async function findUserByEmail(supabase: any, rawEmail: string) {
  const email = String(rawEmail || '').trim()
  if (!email) return null
  const normalized = email.toLowerCase()

  // Try exact normalized match first.
  let { data } = await supabase
    .from('user_roles')
    .select('user_id, full_name, email')
    .eq('email', normalized)
    .maybeSingle()

  if (data) return data

  // Fallback to case-insensitive lookup for legacy rows.
  const fallback = await supabase
    .from('user_roles')
    .select('user_id, full_name, email')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()

  return fallback.data || null
}

// GET - get my family groups + pending invites + member data for combined view
export async function GET(request: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // Get combined family data for a group
  if (action === 'combined' && searchParams.get('groupId')) {
    const groupId = searchParams.get('groupId')!
    
    // Verify user is in this group
    const { data: membership } = await supabase
      .from('family_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()
    
    if (!membership || membership.status !== 'accepted') {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    // Get all accepted members
    const { data: members } = await supabase
      .from('family_group_members')
      .select('user_id, role')
      .eq('group_id', groupId)
      .eq('status', 'accepted')

    const memberIds = members?.map(m => m.user_id) || []

    // Get all members' assets, liabilities, transactions
    const [
      { data: allAssets },
      { data: allLiabilities },
      { data: allTransactions },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('assets').select('*').in('user_id', memberIds),
      supabase.from('liabilities').select('*').in('user_id', memberIds),
      supabase.from('transactions').select('*').in('user_id', memberIds).order('id'),
      supabase.from('user_roles').select('user_id, full_name, email, avatar_url').in('user_id', memberIds),
    ])

    return NextResponse.json({ 
      assets: allAssets || [],
      liabilities: allLiabilities || [],
      transactions: allTransactions || [],
      members: profiles || [],
    })
  }

  // Get my groups and pending invites
  const { data: myMemberships } = await supabase
    .from('family_group_members')
    .select('*, family_groups(*)')
    .eq('user_id', user.id)

  const { data: pendingInvites } = await supabase
    .from('family_group_members')
    .select('*, family_groups(*), inviter:invited_by(email)')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  // Get member details for accepted groups
  const groupIds = myMemberships
    ?.filter(m => m.status === 'accepted')
    .map(m => m.group_id) || []

  const { data: allMembers } = groupIds.length ? await supabase
    .from('family_group_members')
    .select('*, user_roles(full_name, email, avatar_url)')
    .in('group_id', groupIds)
    .eq('status', 'accepted') : { data: [] }

  return NextResponse.json({
    groups: myMemberships?.filter(m => m.status === 'accepted') || [],
    pending: pendingInvites || [],
    members: allMembers || [],
  })
}

// POST - create group, invite member, accept/decline invite
export async function POST(request: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    // Create a new family group
    const { data: group } = await supabase
      .from('family_groups')
      .insert({ name: body.name || 'Our Family', created_by: user.id })
      .select().single()

    // Add creator as owner member
    await supabase.from('family_group_members').insert({
      group_id: group!.id,
      user_id: user.id,
      role: 'owner',
      status: 'accepted',
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    })

    return NextResponse.json({ group })
  }

  if (action === 'invite') {
    // Invite someone by email
    const { groupId, email } = body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!groupId || !normalizedEmail) {
      return NextResponse.json({ error: 'Group and email are required' }, { status: 400 })
    }

    // Find user by email in user_roles
    const invitee = await findUserByEmail(supabase, normalizedEmail)

    if (!invitee) {
      return NextResponse.json({ error: 'User not found. They need to sign up first.' }, { status: 404 })
    }

    // Check not already in group
    const { data: existing } = await supabase
      .from('family_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', invitee.user_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already in group' }, { status: 400 })
    }

    await supabase.from('family_group_members').insert({
      group_id: groupId,
      user_id: invitee.user_id,
      role: 'member',
      status: 'pending',
      invited_by: user.id,
    })

    return NextResponse.json({ ok: true })
  }

  if (action === 'pair') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if ((user.email || '').toLowerCase() === email) {
      return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
    }

    const invitee = await findUserByEmail(supabase, email)

    if (!invitee) {
      return NextResponse.json({ error: 'User not found. They need to sign in first.' }, { status: 404 })
    }

    const { data: existingOwnedMembership } = await supabase
      .from('family_group_members')
      .select('group_id, role, status')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle()

    let groupId = existingOwnedMembership?.group_id as string | undefined

    if (!groupId) {
      const { data: newGroup } = await supabase
        .from('family_groups')
        .insert({ name: body.name ? `${body.name}'s Family` : 'Our Family', created_by: user.id })
        .select('id')
        .single()

      groupId = newGroup?.id
      if (!groupId) {
        return NextResponse.json({ error: 'Could not create family group' }, { status: 500 })
      }

      await supabase.from('family_group_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'owner',
        status: 'accepted',
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      })
    }

    const { data: existing } = await supabase
      .from('family_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', invitee.user_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('family_group_members')
        .update({ status: 'accepted', accepted_at: new Date().toISOString(), role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', invitee.user_id)
    } else {
      await supabase.from('family_group_members').insert({
        group_id: groupId,
        user_id: invitee.user_id,
        role: 'member',
        status: 'accepted',
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, groupId, targetUserId: invitee.user_id })
  }

  if (action === 'respond') {
    // Accept or decline invite
    const { groupId, accept } = body
    await supabase.from('family_group_members')
      .update({
        status: accept ? 'accepted' : 'declined',
        accepted_at: accept ? new Date().toISOString() : null,
      })
      .eq('group_id', groupId)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  }

  if (action === 'remove') {
    // Remove a member (owner only)
    const { groupId, targetUserId } = body
    const { data: ownerMembership } = await supabase
      .from('family_group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ownerMembership || ownerMembership.role !== 'owner' || ownerMembership.status !== 'accepted') {
      return NextResponse.json({ error: 'Only family owner can remove members' }, { status: 403 })
    }

    await supabase.from('family_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
