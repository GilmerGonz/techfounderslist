import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCompanyToken,
  subscribeAutoDefend,
  cancelAutoDefend,
  getAutoDefendStatus,
  isValidPosition,
  MAX_POSITION,
  MIN_BID_CENTS,
  AutoDefendUnavailableError,
} from '@/lib/bids';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * AutoDefend management API.
 *
 * All three verbs require the company's ownership token (the same one
 * returned at company creation and used for checkout) — this is the only
 * "auth" this app has, so it is checked here exactly like on checkout.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') ?? '';
  const token = searchParams.get('token') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const position = Number(searchParams.get('position'));

  if (!companyId || !categoryId || !isValidPosition(position)) {
    return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
  }
  if (!verifyCompanyToken(companyId, token)) {
    return NextResponse.json({ success: false, error: 'Invalid ownership token.' }, { status: 403 });
  }

  try {
    const status = await getAutoDefendStatus({ companyId, categoryId, position });
    return NextResponse.json({
      success: true,
      subscription: status
        ? { active: status.active, maxAmountCents: status.maxAmountCents }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!(await rateLimit(`autodefend:${ip}`, { windowMs: 60_000, max: 10 }))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { companyId, companyToken, categoryId, position, maxAmountCents } = body;

    if (
      !companyId ||
      !categoryId ||
      !isValidPosition(position) ||
      typeof maxAmountCents !== 'number' ||
      !Number.isInteger(maxAmountCents) ||
      maxAmountCents < MIN_BID_CENTS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid parameters (position must be 1-${MAX_POSITION}, maxAmountCents must be an integer >= ${MIN_BID_CENTS}).`,
        },
        { status: 400 }
      );
    }

    if (!verifyCompanyToken(companyId, companyToken)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ownership token for this company.' },
        { status: 403 }
      );
    }

    const subscription = await subscribeAutoDefend({ companyId, categoryId, position, maxAmountCents });
    return NextResponse.json({
      success: true,
      subscription: { active: subscription.active, maxAmountCents: subscription.maxAmountCents },
    });
  } catch (error: any) {
    if (error instanceof AutoDefendUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, companyToken, categoryId, position } = body;

    if (!companyId || !categoryId || !isValidPosition(position)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }
    if (!verifyCompanyToken(companyId, companyToken)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ownership token for this company.' },
        { status: 403 }
      );
    }

    await cancelAutoDefend({ companyId, categoryId, position });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
