import { NextRequest, NextResponse } from 'next/server';
import {
  claimPosition,
  recordClaim,
  hasClaimWithRef,
  getMinRequiredBid,
  withCaptureLock,
  isValidPosition,
  saveCompanyVaultId,
  triggerAutoDefend,
} from '@/lib/bids';
import { capturePayPalOrder, refundPayPalCapture } from '@/lib/paypal';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * POST /api/[locale]/positions/capture
 *
 * Captures the approved PayPal Order and claims the position. Idempotent:
 * a per-captureId lock plus hasClaimWithRef prevent the capture endpoint and
 * the PayPal webhook from both processing the same capture (audit §2).
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`capture:${ip}`, { windowMs: 60_000, max: 10 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const { captureId, meta, vaultId } = await capturePayPalOrder(orderId);

    const companyId = meta.companyId;
    const categoryId = meta.categoryId;
    const position = parseInt(meta.position, 10);
    const amountCents = parseInt(meta.amountCents, 10);

    if (!companyId || !categoryId || !isValidPosition(position)) {
      return NextResponse.json(
        { success: false, error: 'Order metadata is invalid' },
        { status: 400 }
      );
    }

    // Serialize processing of this specific capture across both code paths.
    return await withCaptureLock(captureId, async () => {
      if (await hasClaimWithRef(captureId)) {
        return NextResponse.json({ success: true, alreadyClaimed: true, captureId });
      }

      const currentQuote = await getMinRequiredBid(categoryId, position);
      if (amountCents < currentQuote.minRequiredCents) {
        try {
          const { refundId } = await refundPayPalCapture(captureId, amountCents);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'refunded',
          });
          return NextResponse.json(
            {
              success: false,
              error: `The minimum rose to $${(currentQuote.minRequiredCents / 100).toFixed(
                2
              )} while your payment was processing. An automatic refund was issued.`,
              refunded: true,
              refundId,
              minRequiredCents: currentQuote.minRequiredCents,
            },
            { status: 409 }
          );
        } catch (refundErr: any) {
          console.error('Automatic refund failed:', refundErr);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'failed_needs_refund',
          });
          return NextResponse.json(
            {
              success: false,
              error: 'The price changed and an automatic refund could not be issued. Contact support.',
              needsManualRefund: true,
            },
            { status: 500 }
          );
        }
      }

      try {
        const claimResult = await claimPosition(companyId, categoryId, position, amountCents);
        await recordClaim({
          companyId,
          categoryId,
          amountCents,
          position,
          paymentRefId: captureId,
          paymentProvider: 'paypal',
          status: 'confirmed',
        });

        // Best-effort side effects — never let these turn an already-confirmed
        // payment into an error response for the paying buyer.
        if (vaultId) {
          saveCompanyVaultId(companyId, vaultId).catch((err) =>
            console.error('saveCompanyVaultId failed:', err)
          );
        }
        if (claimResult.displacedCompanyId) {
          triggerAutoDefend(categoryId, position, claimResult.displacedCompanyId).catch((err) =>
            console.error('triggerAutoDefend failed:', err)
          );
        }

        return NextResponse.json({ success: true, captureId });
      } catch (claimErr: any) {
        console.error('claimPosition failed after capture:', claimErr);
        try {
          const { refundId } = await refundPayPalCapture(captureId, amountCents);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'refunded',
          });
          return NextResponse.json(
            {
              success: false,
              error: 'The position could not be claimed. An automatic refund was issued.',
              refunded: true,
              refundId,
            },
            { status: 409 }
          );
        } catch (refundErr: any) {
          console.error('Automatic refund failed:', refundErr);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'failed_needs_refund',
          });
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to claim the position and to issue a refund. Contact support.',
              needsManualRefund: true,
            },
            { status: 500 }
          );
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
