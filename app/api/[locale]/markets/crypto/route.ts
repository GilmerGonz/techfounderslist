import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const COIN_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin'] as const;
const CACHE_TTL_MS = 60_000;

export interface CryptoQuote {
  id: string;
  usd: number;
  usd24hChange: number;
}

let cryptoCache: { data: CryptoQuote[]; expiresAt: number } | null = null;

export async function GET(request: NextRequest, { params }: { params: { locale: string } }) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`markets-crypto:${ip}`, { windowMs: 60_000, max: 30 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  if (cryptoCache && cryptoCache.expiresAt > Date.now()) {
    return NextResponse.json({ success: true, quotes: cryptoCache.data });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const data = await res.json();

    const quotes: CryptoQuote[] = COIN_IDS.filter((id) => data[id]).map((id) => ({
      id,
      usd: data[id].usd,
      usd24hChange: data[id].usd_24h_change ?? 0,
    }));

    if (quotes.length === 0) throw new Error('No quotes returned');

    cryptoCache = { data: quotes, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json({ success: true, quotes });
  } catch (error: any) {
    if (cryptoCache) {
      return NextResponse.json({ success: true, quotes: cryptoCache.data, stale: true });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
