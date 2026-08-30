import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT'] as const;
const CACHE_TTL_MS = 60_000;

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

let stocksCache: { data: StockQuote[]; expiresAt: number } | null = null;

async function fetchQuote(symbol: string, apiKey: string): Promise<StockQuote | null> {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data.c !== 'number' || data.c === 0) return null;
  return { symbol, price: data.c, change: data.d, changePercent: data.dp };
}

export async function GET(request: NextRequest, { params }: { params: { locale: string } }) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`markets-stocks:${ip}`, { windowMs: 60_000, max: 30 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, configured: false, quotes: [] });
  }

  if (stocksCache && stocksCache.expiresAt > Date.now()) {
    return NextResponse.json({ success: true, configured: true, quotes: stocksCache.data });
  }

  try {
    const results = await Promise.allSettled(TICKERS.map((symbol) => fetchQuote(symbol, apiKey)));
    const quotes = results
      .filter((r): r is PromiseFulfilledResult<StockQuote | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((q): q is StockQuote => q !== null);

    if (quotes.length === 0) throw new Error('No quotes returned');

    stocksCache = { data: quotes, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json({ success: true, configured: true, quotes });
  } catch (error: any) {
    // Prefer a stale cache over a broken section.
    if (stocksCache) {
      return NextResponse.json({ success: true, configured: true, quotes: stocksCache.data, stale: true });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
