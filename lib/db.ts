// Database layer — all reads/writes go through here
import { createClient } from './supabase'

// ── SETTINGS ─────────────────────────────────────────────────────────────────
export async function loadSettings(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function saveSettings(userId: string, settings: any) {
  const supabase = createClient()
  await supabase.from('settings').upsert({
    user_id: userId,
    theme: settings.theme,
    usd_sgd: settings.usdSgd,
    prices_ts: settings.pricesTs,
    include_cpf_in_nw: settings.includeCPFinNW,
    income_untagged_only: settings.incomeUntaggedOnly,
    active_profile_id: settings.activeProfileId,
    api_key: settings.apiKey,
    peer_data: settings.peerData,
    cpf_credit_keys: settings.cpfCreditKeys || {},
    updated_at: new Date().toISOString()
  })
}

// ── ASSETS ───────────────────────────────────────────────────────────────────
export async function loadAssets(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  return data || []
}

export async function saveAsset(userId: string, asset: any) {
  const supabase = createClient()
  await supabase.from('assets').upsert({
    id: asset.id,
    user_id: userId,
    type: asset.type,
    name: asset.name,
    owner: asset.owner,
    value: asset.value || 0,
    ticker: asset.ticker,
    market: asset.market,
    shares: asset.shares,
    cost: asset.cost,
    current_price: asset.currentPrice,
    prices_ts: asset.pricesTs,
    cpf_oa: asset.cpfOA || 0,
    cpf_sa: asset.cpfSA || 0,
    cpf_ma: asset.cpfMA || 0,
    subtype: asset.subtype,
    my_share: asset.myShare,
    include_in_nw: asset.includeInNW !== false,
    desc_text: asset.desc,
    locked: asset.locked || false,
    updated_at: new Date().toISOString()
  })
}

export async function deleteAsset(assetId: string, userId: string) {
  const supabase = createClient()
  await supabase.from('assets').delete()
    .eq('id', assetId).eq('user_id', userId)
}

// ── LIABILITIES ───────────────────────────────────────────────────────────────
export async function loadLiabilities(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('liabilities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  return data || []
}

export async function saveLiability(userId: string, liab: any) {
  const supabase = createClient()
  await supabase.from('liabilities').upsert({
    id: liab.id,
    user_id: userId,
    name: liab.name,
    type: liab.type,
    amount: liab.amount,
    full_amount: liab.fullAmount,
    my_share: liab.myShare,
    freq: liab.freq,
    owner: liab.owner,
    notes: liab.notes,
    debit: liab.debit,
    updated_at: new Date().toISOString()
  })
}

export async function deleteLiability(liabId: string, userId: string) {
  const supabase = createClient()
  await supabase.from('liabilities').delete()
    .eq('id', liabId).eq('user_id', userId)
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
export async function loadCatOverrides(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('cat_overrides')
    .select('*')
    .eq('user_id', userId)
  const overrides: Record<number, string> = {}
  data?.forEach((r: any) => { overrides[r.tx_id] = r.category })
  return overrides
}

export async function saveCatOverride(userId: string, txId: number, category: string) {
  const supabase = createClient()
  await supabase.from('cat_overrides').upsert({
    user_id: userId, tx_id: txId, category
  })
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
export async function loadCategories(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .order('name')
  return data?.map((r: any) => r.name) || []
}

export async function saveCategories(userId: string, categories: string[]) {
  const supabase = createClient()
  // Delete all and re-insert
  await supabase.from('categories').delete().eq('user_id', userId)
  if (categories.length) {
    await supabase.from('categories').insert(
      categories.map(name => ({ user_id: userId, name }))
    )
  }
}

// ── BUDGETS ───────────────────────────────────────────────────────────────────
export async function loadBudgets(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  return data?.map((b: any) => ({ category: b.category, limit: b.limit_amount, id: b.id })) || []
}

export async function saveBudgets(userId: string, budgets: any[]) {
  const supabase = createClient()
  await supabase.from('budgets').delete().eq('user_id', userId)
  if (budgets.length) {
    await supabase.from('budgets').insert(
      budgets.map(b => ({ user_id: userId, category: b.category, limit_amount: b.limit }))
    )
  }
}

// ── CPF TRANSACTIONS ──────────────────────────────────────────────────────────
export async function loadCPFTransactions(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('cpf_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  return data?.map((t: any) => ({
    id: t.id, date: t.date, desc: t.desc, amount: t.amount,
    account: t.account, type: t.type, detail: t.detail, editable: t.editable
  })) || []
}

export async function saveCPFTransaction(userId: string, tx: any) {
  const supabase = createClient()
  await supabase.from('cpf_transactions').upsert({
    id: tx.id, user_id: userId, date: tx.date, desc: tx.desc,
    amount: tx.amount, account: tx.account, type: tx.type,
    detail: tx.detail, editable: tx.editable
  })
}

export async function deleteCPFTransaction(txId: string, userId: string) {
  const supabase = createClient()
  await supabase.from('cpf_transactions').delete()
    .eq('id', txId).eq('user_id', userId)
}

// ── FULL STATE LOAD ───────────────────────────────────────────────────────────
export async function loadAllUserData(userId: string) {
  const [settings, assets, liabilities, catOverrides, categories, budgets, cpfTxs] =
    await Promise.all([
      loadSettings(userId),
      loadAssets(userId),
      loadLiabilities(userId),
      loadCatOverrides(userId),
      loadCategories(userId),
      loadBudgets(userId),
      loadCPFTransactions(userId),
    ])
  return { settings, assets, liabilities, catOverrides, categories, budgets, cpfTxs }
}
