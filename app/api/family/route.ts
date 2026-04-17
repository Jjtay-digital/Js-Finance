import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeEmail(rawEmail: string) {
  return String(rawEmail || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

async function findUserByEmail(supabase: any, rawEmail: string) {
  const email = String(rawEmail || '').trim()
  if (!email) return null
  const normalized = normalizeEmail(email)

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

  if (fallback.data) return fallback.data

  // Last fallback: contains match (helps recover rows with accidental whitespace).
  const contains = await supabase
    .from('user_roles')
    .select('user_id, full_name, email')
    .ilike('email', `%${normalized}%`)
    .limit(1)

  if (contains.data && contains.data.length) return contains.data[0]
  return null
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
  const admin = getAdminSupabase()
  const db = admin || supabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    // Create a new family group
    const { data: group, error: groupErr } = await db
      .from('family_groups')
      .insert({ name: body.name || 'Our Family', created_by: user.id })
      .select().single()
    if (groupErr || !group) {
      return NextResponse.json({ error: 'Unable to create group', details: groupErr?.message }, { status: 500 })
    }

    // Add creator as owner member
    const { error: ownerErr } = await db.from('family_group_members').insert({
      group_id: group!.id,
      user_id: user.id,
      role: 'owner',
      status: 'accepted',
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    if (ownerErr) {
      return NextResponse.json({ error: 'Unable to add owner to group', details: ownerErr.message }, { status: 500 })
    }

    return NextResponse.json({ group })
  }

  if (action === 'invite') {
    // Invite someone by email
    const { groupId, email } = body
    const normalizedEmail = normalizeEmail(String(email || ''))
    if (!groupId || !normalizedEmail) {
      return NextResponse.json({ error: 'Group and email are required' }, { status: 400 })
    }

    // Find user by email in user_roles
    const invitee = await findUserByEmail(db, normalizedEmail)

    if (!invitee) {
      return NextResponse.json({ error: 'User not found. They need to sign up first.' }, { status: 404 })
    }

    // Check not already in group
    const { data: existing } = await db
      .from('family_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', invitee.user_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already in group' }, { status: 400 })
    }

    const { error: inviteErr } = await db.from('family_group_members').insert({
      group_id: groupId,
      user_id: invitee.user_id,
      role: 'member',
      status: 'pending',
      invited_by: user.id,
    })
    if (inviteErr) {
      return NextResponse.json({ error: 'Unable to send invite', details: inviteErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'pair') {
    const email = normalizeEmail(String(body.email || ''))
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (normalizeEmail(user.email || '') === email) {
      return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
    }

    const invitee = await findUserByEmail(db, email)

    if (!invitee) {
      return NextResponse.json({ error: 'User not found. They need to sign in first.' }, { status: 404 })
    }

    const { data: existingOwnedMembership } = await db
      .from('family_group_members')
      .select('group_id, role, status')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle()

    let groupId = existingOwnedMembership?.group_id as string | undefined

    if (!groupId) {
      const { data: newGroup, error: newGroupErr } = await db
        .from('family_groups')
        .insert({ name: body.name ? `${body.name}'s Family` : 'Our Family', created_by: user.id })
        .select('id')
        .single()
      if (newGroupErr || !newGroup) {
        return NextResponse.json({ error: 'Could not create family group', details: newGroupErr?.message }, { status: 500 })
      }

      groupId = newGroup?.id
      if (!groupId) {
        return NextResponse.json({ error: 'Could not create family group' }, { status: 500 })
      }

      const { error: ownerErr } = await db.from('family_group_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'owner',
        status: 'accepted',
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      if (ownerErr) {
        return NextResponse.json({ error: 'Could not create owner membership', details: ownerErr.message }, { status: 500 })
      }
    }

    const { data: existing } = await db
      .from('family_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', invitee.user_id)
      .maybeSingle()

    if (existing) {
      const { error: updateErr } = await db
        .from('family_group_members')
        .update({ status: 'accepted', accepted_at: new Date().toISOString(), role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', invitee.user_id)
      if (updateErr) {
        return NextResponse.json({ error: 'Could not update existing family membership', details: updateErr.message }, { status: 500 })
      }
    } else {
      const { error: memberErr } = await db.from('family_group_members').insert({
        group_id: groupId,
        user_id: invitee.user_id,
        role: 'member',
        status: 'accepted',
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      if (memberErr) {
        return NextResponse.json({ error: 'Could not create family membership', details: memberErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, groupId, targetUserId: invitee.user_id })
  }

  if (action === 'respond') {
    // Accept or decline invite
    const { groupId, accept } = body
    const { error: respondErr } = await db.from('family_group_members')
      .update({
        status: accept ? 'accepted' : 'declined',
        accepted_at: accept ? new Date().toISOString() : null,
      })
      .eq('group_id', groupId)
      .eq('user_id', user.id)
    if (respondErr) {
      return NextResponse.json({ error: 'Unable to update invite response', details: respondErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'remove') {
    // Remove a member (owner only)
    const { groupId, targetUserId } = body
    const { data: ownerMembership } = await db
      .from('family_group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ownerMembership || ownerMembership.role !== 'owner' || ownerMembership.status !== 'accepted') {
      return NextResponse.json({ error: 'Only family owner can remove members' }, { status: 403 })
    }

    const { error: removeErr } = await db.from('family_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
    if (removeErr) {
      return NextResponse.json({ error: 'Unable to remove member', details: removeErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
