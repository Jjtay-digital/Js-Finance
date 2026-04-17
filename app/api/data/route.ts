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
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// GET — load all user data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'No userId' }, { status: 400 })

  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('GET auth check:', user?.id, 'requested:', userId, 'error:', authError?.message)
  if (!user || user.id !== userId) return NextResponse.json({ error: 'Unauthorized', debug: { hasUser: !!user, userId: user?.id } }, { status: 401 })

  const [
    { data: settings },
    { data: assets },
    { data: liabilities },
    { data: catOverrides },
    { data: categories },
    { data: budgets },
    { data: cpfTxs },
    { data: transactions },
  ] = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', userId).single(),
    supabase.from('assets').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('liabilities').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('cat_overrides').select('*').eq('user_id', userId),
    supabase.from('categories').select('name').eq('user_id', userId),
    supabase.from('budgets').select('*').eq('user_id', userId),
    supabase.from('cpf_transactions').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('transactions').select('*').eq('user_id', userId).order('id'),
  ])

  // Convert DB format back to dashboard format
  const mappedAssets = (assets || []).map((a: any) => ({
    id: a.id, type: a.type, name: a.name, owner: a.owner,
    value: a.value, ticker: a.ticker, market: a.market,
    shares: a.shares, cost: a.cost, currentPrice: a.current_price,
    cpfOA: a.cpf_oa, cpfSA: a.cpf_sa, cpfMA: a.cpf_ma,
    subtype: a.subtype, myShare: a.my_share,
    includeInNW: a.include_in_nw, desc: a.desc_text, locked: a.locked,
  }))

  const mappedLiabs = (liabilities || []).map((l: any) => ({
    id: l.id, name: l.name, type: l.type, amount: l.amount,
    fullAmount: l.full_amount, myShare: l.my_share,
    freq: l.freq, owner: l.owner, notes: l.notes, debit: l.debit,
  }))

  const overridesMap: Record<number, string> = {}
  ;(catOverrides || []).forEach((r: any) => { overridesMap[r.tx_id] = r.category })

  const mappedBudgets = (budgets || []).map((b: any) => ({
    category: b.category, limit: b.limit_amount
  }))

  const mappedCpfTxs = (cpfTxs || []).map((t: any) => ({
    id: t.id, date: t.date, desc: t.description, amount: t.amount,
    account: t.account, type: t.type, detail: t.detail, editable: t.editable,
  }))

  // If user is in a family group, check if family owner shares their key
  let sharedApiKey = null
  let sharedAlphaKey = null
  try {
    // Find family groups this user belongs to
    const { data: memberships } = await supabase
      .from('family_group_members')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'accepted')

    if (memberships?.length) {
      const groupIds = memberships.map((m: any) => m.group_id)

      // Source of truth for owner is membership role, not only family_groups.created_by.
      const { data: ownerMemberships } = await supabase
        .from('family_group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds)
        .eq('role', 'owner')
        .eq('status', 'accepted')

      for (const owner of (ownerMemberships || [])) {
        if (owner.user_id === userId) continue
        const { data: ownerSettings } = await supabase
          .from('settings')
          .select('api_key, share_api_key, alpha_vantage_key')
          .eq('user_id', owner.user_id)
          .maybeSingle()

        if (ownerSettings?.share_api_key) {
          sharedApiKey = ownerSettings.api_key
          sharedAlphaKey = ownerSettings.alpha_vantage_key
          break
        }
      }
    }
  } catch(e) {
    // Family groups may not exist yet, that's fine
  }

  const mappedTransactions = (transactions || []).map((t: any) => ({
    id: t.id,
    date: t.date,
    month: t.month,
    desc: t.description,
    source: t.source,
    type: t.type,
    amount: parseFloat(t.amount) || 0,
    defaultCat: t.default_cat,
    category: t.category,
  }))

  return NextResponse.json({
    settings,
    assets: mappedAssets,
    sharedApiKey,
    sharedAlphaKey,
    liabilities: mappedLiabs,
    catOverrides: overridesMap,
    categories: (categories || []).map((c: any) => c.name),
    budgets: mappedBudgets,
    cpfTxs: mappedCpfTxs,
    transactions: mappedTransactions,
  })
}

// POST — save full state
export async function POST(request: NextRequest) {
  const { userId, state } = await request.json()
  if (!userId || !state) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('GET auth check:', user?.id, 'requested:', userId, 'error:', authError?.message)
  if (!user || user.id !== userId) return NextResponse.json({ error: 'Unauthorized', debug: { hasUser: !!user, userId: user?.id } }, { status: 401 })

  const S = state
  const now = new Date().toISOString()
  console.log('POST saving: assets=', S.assets?.length, 'liabilities=', S.liabilities?.length, 'categories=', S.categories?.length)

  const fail = (stage: string, err: any) => {
    const msg = err?.message || String(err || 'Unknown error')
    console.error(`POST /api/data failed at ${stage}:`, msg)
    return NextResponse.json({ error: `Save failed at ${stage}`, details: msg }, { status: 500 })
  }

  // Save settings
  const { error: settingsErr } = await supabase.from('settings').upsert({
    user_id: userId,
    theme: S.theme,
    usd_sgd: S.usdSgd,
    prices_ts: S.pricesTs,
    include_cpf_in_nw: S.includeCPFinNW,
    income_untagged_only: S.incomeUntaggedOnly,
    api_key: S.apiKey,
    alpha_vantage_key: S.alphaVantageKey,
    share_api_key: S.shareApiKey || false,
    peer_data: {
      ...(S.peerData || {}),
      forexHoldings: S.forexHoldings || [],
    },
    updated_at: now,
  })
  if (settingsErr) return fail('settings', settingsErr)

  // Save assets
  if (S.assets?.length) {
    const { error: upsertErr } = await supabase.from('assets').upsert(S.assets.map((a: any) => ({
      id: a.id, user_id: userId, type: a.type, name: a.name, owner: a.owner,
      value: a.value || 0, ticker: a.ticker, market: a.market,
      shares: a.shares, cost: a.cost, current_price: a.currentPrice,
      cpf_oa: a.cpfOA || 0, cpf_sa: a.cpfSA || 0, cpf_ma: a.cpfMA || 0,
      subtype: a.subtype, my_share: a.myShare,
      include_in_nw: a.includeInNW !== false,
      desc_text: a.desc, locked: a.locked || false, updated_at: now,
    })), { onConflict: 'id' })
    if (upsertErr) return fail('assets.upsert', upsertErr)
  } else {
    const { error: delErr } = await supabase.from('assets').delete().eq('user_id', userId)
    if (delErr) return fail('assets.delete', delErr)
  }

  // Save liabilities
  if (S.liabilities?.length) {
    const { error: liabUpsertErr } = await supabase.from('liabilities').upsert(S.liabilities.map((l: any) => ({
      id: l.id, user_id: userId, name: l.name, type: l.type,
      amount: l.amount, full_amount: l.fullAmount, my_share: l.myShare,
      freq: l.freq, owner: l.owner, notes: l.notes, debit: l.debit,
      updated_at: now,
    })), { onConflict: 'id' })
    if (liabUpsertErr) return fail('liabilities.upsert', liabUpsertErr)
  } else {
    const { error: liabDelErr } = await supabase.from('liabilities').delete().eq('user_id', userId)
    if (liabDelErr) return fail('liabilities.delete', liabDelErr)
  }

  // Save categories
  const { error: catDelErr } = await supabase.from('categories').delete().eq('user_id', userId)
  if (catDelErr) return fail('categories.delete', catDelErr)
  if (S.categories?.length) {
    const cleanedCategories = Array.from(
      new Set(
        S.categories
          .map((name: any) => String(name || '').trim())
          .filter((name: string) => name.length > 0)
      )
    )
    const { error: catInsErr } = await supabase.from('categories').insert(
      cleanedCategories.map((name: string) => ({ user_id: userId, name }))
    )
    if (catInsErr) return fail('categories.insert', catInsErr)
  }

  // Save cat overrides
  const { error: ovDelErr } = await supabase.from('cat_overrides').delete().eq('user_id', userId)
  if (ovDelErr) return fail('cat_overrides.delete', ovDelErr)
  if (S.catOverrides && Object.keys(S.catOverrides).length) {
    const { error: ovInsErr } = await supabase.from('cat_overrides').insert(
      Object.entries(S.catOverrides).map(([txId, cat]) => ({
        user_id: userId, tx_id: parseInt(txId), category: cat
      }))
    )
    if (ovInsErr) return fail('cat_overrides.insert', ovInsErr)
  }

  // Save budgets
  const { error: budgetDelErr } = await supabase.from('budgets').delete().eq('user_id', userId)
  if (budgetDelErr) return fail('budgets.delete', budgetDelErr)
  if (S.budgets?.length) {
    const { error: budgetInsErr } = await supabase.from('budgets').insert(
      S.budgets.map((b: any) => ({
        user_id: userId, category: b.category, limit_amount: b.limit
      }))
    )
    if (budgetInsErr) return fail('budgets.insert', budgetInsErr)
  }

  // Save CPF transactions
  if (S.cpfTransactions?.length) {
    const { error: cpfUpsertErr } = await supabase.from('cpf_transactions').upsert(
      S.cpfTransactions.map((t: any) => ({
        id: t.id, user_id: userId, date: t.date, description: t.desc,
        amount: t.amount, account: t.account, type: t.type,
        detail: t.detail, editable: t.editable,
      })),
      { onConflict: 'id' }
    )
    if (cpfUpsertErr) return fail('cpf_transactions.upsert', cpfUpsertErr)
  } else {
    const { error: cpfDelErr } = await supabase.from('cpf_transactions').delete().eq('user_id', userId)
    if (cpfDelErr) return fail('cpf_transactions.delete', cpfDelErr)
  }

  // Save transactions (uploaded from PDF statements)
  if (S.transactions?.length) {
    const { error: txUpsertErr } = await supabase.from('transactions').upsert(
      S.transactions.map((t: any) => ({
        id: t.id,
        user_id: userId,
        date: t.date,
        month: t.month,
        description: t.desc,
        source: t.source,
        type: t.type,
        amount: t.amount || 0,
        default_cat: t.defaultCat,
        category: t.category,
      })),
      { onConflict: 'id' }
    )
    if (txUpsertErr) return fail('transactions.upsert', txUpsertErr)
  } else {
    const { error: txDelErr } = await supabase.from('transactions').delete().eq('user_id', userId)
    if (txDelErr) return fail('transactions.delete', txDelErr)
  }

  console.log('POST complete for userId:', userId, 'transactions:', S.transactions?.length || 0)
  return NextResponse.json({ ok: true })
}
