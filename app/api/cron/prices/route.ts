import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const COMMON_TICKERS = [
  { ticker: 'QQQM', market: 'US' }, { ticker: 'VOO', market: 'US' },
  { ticker: 'VTI', market: 'US' },  { ticker: 'AVGO', market: 'US' },
  { ticker: 'UNH', market: 'US' },  { ticker: 'AAPL', market: 'US' },
  { ticker: 'MSFT', market: 'US' }, { ticker: 'NVDA', market: 'US' },
  { ticker: 'AMZN', market: 'US' }, { ticker: 'GOOGL', market: 'US' },
  { ticker: 'META', market: 'US' }, { ticker: 'TSLA', market: 'US' },
  { ticker: 'SPY', market: 'US' },  { ticker: 'QQQ', market: 'US' },
  { ticker: 'D05', market: 'SG' },  { ticker: 'O39', market: 'SG' },
  { ticker: 'U11', market: 'SG' },  { ticker: 'C6L', market: 'SG' },
  { ticker: 'Z74', market: 'SG' },  { ticker: 'A17U', market: 'SG' },
]

async function fetchPrice(ticker: string, market: string): Promise<number | null> {
  try {
    const sym = market === 'SG' ? ticker + '.SI' : ticker
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { ticker: string, market: string, price: number }> = {}
  for (const { ticker, market } of COMMON_TICKERS) {
    const price = await fetchPrice(ticker, market)
    if (price) results[`${ticker}:${market}`] = { ticker, market, price }
    await new Promise(r => setTimeout(r, 120))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
      }
    }
  )

  for (const item of Object.values(results)) {
    await supabase.from('price_cache').upsert({
      ticker: item.ticker, market: item.market,
      price: item.price, updated_at: new Date().toISOString()
    })
  }

  return NextResponse.json({ ok: true, updated: Object.keys(results).length })
}
