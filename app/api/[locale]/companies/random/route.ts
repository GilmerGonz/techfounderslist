import { NextRequest, NextResponse } from 'next/server';
import { getRandomHeldCompany } from '@/lib/bids';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`companies-random:${ip}`, { windowMs: 60_000, max: 30 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const company = await getRandomHeldCompany();
    return NextResponse.json({ success: true, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
