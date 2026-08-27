import { NextRequest, NextResponse } from 'next/server';
import { getMinRequiredBid, isValidPosition, MAX_POSITION } from '@/lib/bids';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!(await rateLimit(`quote:${ip}`, { windowMs: 60_000, max: 60 }))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { categoryId, position } = body;

    if (!categoryId || !isValidPosition(position)) {
      return NextResponse.json(
        { success: false, error: `categoryId is required and position must be an integer between 1 and ${MAX_POSITION}` },
        { status: 400 }
      );
    }

    const quote = await getMinRequiredBid(categoryId, position);
    return NextResponse.json({ success: true, quote });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
