import { NextRequest, NextResponse } from 'next/server';
import {
  claimPosition,
  recordClaim,
  getMinRequiredBid,
  verifyCompanyToken,
  isValidPosition,
  MAX_POSITION,
} from '@/lib/bids';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * POST /api/[locale]/positions/demo-claim
 *
 * DEMO-ONLY fallback used when PayPal is not configured (local dev). It runs
 * the same atomic claim path as the real capture (token verification, minimum
 * check, claimPosition, immutable record) but without moving real money.
 *
 * SECURITY: hard-disabled in production (PAYPAL_MODE === 'live').
 */
export async function POST(request: NextRequest) {
  if (process.env.PAYPAL_MODE === 'live') {
    return NextResponse.json(
      { success: false, error: 'Demo claim is disabled in production.' },
      { status: 403 }
    );
  }

  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`demo-claim:${ip}`, { windowMs: 60_000, max: 10 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { companyId, companyToken, categoryId, position, amountCents } = body;

    if (
      !companyId ||
      !categoryId ||
      !isValidPosition(position) ||
      typeof amountCents !== 'number' ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return NextResponse.json(
        { success: false, error: `Missing/invalid parameters (position must be an integer between 1 and ${MAX_POSITION}).` },
        { status: 400 }
      );
    }

    if (!verifyCompanyToken(companyId, companyToken)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ownership token for this company.' },
        { status: 403 }
      );
    }

    const quote = await getMinRequiredBid(categoryId, position);
    if (amountCents < quote.minRequiredCents) {
      return NextResponse.json(
        {
          success: false,
          error: `The amount of $${(amountCents / 100).toFixed(
            2
          )} is too low. The minimum is $${(quote.minRequiredCents / 100).toFixed(2)}.`,
          minRequiredCents: quote.minRequiredCents,
        },
        { status: 400 }
      );
    }

    await claimPosition(companyId, categoryId, position, amountCents);
    const paymentRefId = `demo-${companyId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await recordClaim({
      companyId,
      categoryId,
      amountCents,
      position,
      paymentRefId,
      paymentProvider: 'demo',
      status: 'confirmed',
    });

    return NextResponse.json({ success: true, demo: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
