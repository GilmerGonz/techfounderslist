import { NextRequest, NextResponse } from 'next/server';
import { getRecentClaims } from '@/lib/bids';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`records:${ip}`, { windowMs: 60_000, max: 60 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const records = await getRecentClaims();
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
