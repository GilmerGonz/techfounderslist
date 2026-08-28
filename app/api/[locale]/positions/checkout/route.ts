import { NextRequest, NextResponse } from 'next/server';
import {
  getMinRequiredBid,
  verifyCompanyToken,
  isValidPosition,
  MAX_POSITION,
} from '@/lib/bids';
import { createPayPalOrder } from '@/lib/paypal';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyTurnstileToken } from '@/lib/turnstile';

/**
 * POST /api/[locale]/positions/checkout
 *
 * Payments run through PayPal exclusively. This endpoint NEVER changes the
 * index: it only creates a PayPal Order for the server-computed minimum.
 * The index is claimed solely after a successful capture
 * (capture endpoint or PAYMENT.CAPTURE.COMPLETED webhook -> claimPosition()).
 *
 * Security: the caller must present the ownership token returned at company
 * creation (audit §1) — this prevents claiming a position on behalf of an
 * arbitrary existing company.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`checkout:${ip}`, { windowMs: 60_000, max: 10 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();
    const { companyId, companyToken, categoryId, position, amountCents, turnstileToken } = body;

    // Anti-bot: only enforced when Turnstile is configured (no-op otherwise).
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return NextResponse.json(
        { success: false, error: 'Captcha verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (
      !companyId ||
      !categoryId ||
      !isValidPosition(position) ||
      typeof amountCents !== 'number' ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing/invalid required parameters (companyId, companyToken, categoryId, position [1-${MAX_POSITION}], amountCents)`,
        },
        { status: 400 }
      );
    }

    // Ownership verification (audit §1)
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
          error: `The amount of $${(amountCents / 100).toFixed(2)} is too low. The minimum is $${(
            quote.minRequiredCents / 100
          ).toFixed(2)}`,
          minRequiredCents: quote.minRequiredCents,
        },
        { status: 400 }
      );
    }

    const paypalConfigured = !!(
      process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
    );

    // DEMO mode: when PayPal is not configured and we're not in production,
    // skip real money movement and let the client simulate the capture.
    if (!paypalConfigured && process.env.PAYPAL_MODE !== 'live') {
      return NextResponse.json({ success: true, mode: 'demo' });
    }

    if (!paypalConfigured) {
      return NextResponse.json(
        {
          success: false,
          error:
            'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
        },
        { status: 503 }
      );
    }

    // PayPal requires return/cancel URLs whenever vaulting is requested (even
    // though the JS SDK popup flow never navigates the buyer to them). Origin
    // falls back to the request's own host if not explicitly configured.
    // pathname is /api/<locale>/positions/checkout — index 2 is the locale.
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || new URL(request.url).origin;
    const locale = request.nextUrl.pathname.split('/')[2] || 'en';
    const backUrl = `${origin}/${locale}`;

    const order = await createPayPalOrder(
      amountCents,
      'usd',
      {
        companyId,
        categoryId,
        position: position.toString(),
        amountCents: amountCents.toString(),
      },
      // Request vaulting on every real checkout so the owner can opt into
      // AutoDefend later without a separate "save your card" step. Silently
      // ignored by PayPal if the merchant account lacks Vault/Reference
      // Transactions — never blocks the actual claim payment either way.
      { vault: true, returnUrl: backUrl, cancelUrl: backUrl }
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      mode: 'paypal',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
