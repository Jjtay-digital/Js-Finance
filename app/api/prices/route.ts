import { NextRequest, NextResponse } from 'next/server'

// Server-side Yahoo Finance fetch - no CORS issues on server!
async function fetchYahooPrice(ticker: string, market: string): Promise<number | null> {
  try {
    const sym = market === 'SG' ? ticker + '.SI' : ticker
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour on Vercel
    })
    if (!res.ok) return null
    const data = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch (e) {
    return null
  }
}

// GET /api/prices?tickers=AVGO,UNH,QQQM,VOO&markets=US,US,US,US
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickersParam = searchParams.get('tickers') || ''
  const marketsParam = searchParams.get('markets') || ''

  if (!tickersParam) {
    return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean)
  const markets = marketsParam.split(',').map(m => m.trim())

  // Fetch all prices in parallel
  const results = await Promise.all(
    tickers.map(async (ticker, i) => {
      const market = markets[i] || 'US'
      const price = await fetchYahooPrice(ticker, market)
      return { ticker, market, price }
    })
  )

  const priceMap: Record<string, number | null> = {}
  results.forEach(r => {
    priceMap[r.ticker] = r.price
  })

  return NextResponse.json({
    prices: priceMap,
    timestamp: Date.now(),
    source: 'yahoo'
  }, {
    headers: {
      // Cache response for 1 hour on Vercel edge
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    }
  })
}
