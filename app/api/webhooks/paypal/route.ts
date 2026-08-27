import { NextRequest, NextResponse } from 'next/server';
import {
  claimPosition,
  recordClaim,
  hasClaimWithRef,
  withCaptureLock,
  isValidPosition,
  triggerAutoDefend,
} from '@/lib/bids';
import {
  verifyPayPalWebhook,
  refundPayPalCapture,
  getPayPalCaptureDetails,
} from '@/lib/paypal';

/**
 * POST /api/webhooks/paypal
 *
 * Idempotent backup: if the client-side capture does not arrive, this webhook
 * claims the position on PAYMENT.CAPTURE.COMPLETED. Deduplicated by capture id.
 *
 * Security (audit §2):
 * - Always verifies the webhook signature in production.
 * - Re-verifies the captured amount against PayPal before mutating the index.
 * - Serializes processing of a given capture via withCaptureLock.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const isProduction = process.env.PAYPAL_MODE === 'live';
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    if (isProduction) {
      console.error('PAYPAL_WEBHOOK_ID not set in production — webhook rejected');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    console.warn('⚠️ PAYPAL_WEBHOOK_ID not set — accepting webhook without signature (dev only)');
  } else {
    const verifyHeaders: Record<string, string | null> = {
      'paypal-transmission-id': request.headers.get('paypal-transmission-id'),
      'paypal-transmission-time': request.headers.get('paypal-transmission-time'),
      'paypal-cert-url': request.headers.get('paypal-cert-url'),
      'paypal-transmission-sig': request.headers.get('paypal-transmission-sig'),
      'paypal-auth-algo': request.headers.get('paypal-auth-algo'),
    };

    if (!Object.values(verifyHeaders).every((v) => v)) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 });
    }

    const isValid = await verifyPayPalWebhook(verifyHeaders, rawBody);
    if (!isValid) {
      console.error('Invalid PayPal webhook signature — rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ received: true });
  }

  const resource = event.resource ?? {};
  const captureId: string = resource.id ?? '';
  let meta: { companyId?: string; categoryId?: string; position?: string; amountCents?: string } = {};
  try {
    if (resource.custom_id) meta = JSON.parse(resource.custom_id);
  } catch {
    /* no-op */
  }

  const companyId = meta.companyId;
  const categoryId = meta.categoryId;
  const position = parseInt(meta.position ?? '0', 10);
  const amountCents = parseInt(meta.amountCents ?? '0', 10);

  if (!captureId || !companyId || !categoryId || !isValidPosition(position)) {
    return NextResponse.json({ received: true });
  }

  try {
    return await withCaptureLock(captureId, async () => {
      if (await hasClaimWithRef(captureId)) {
        return NextResponse.json({ received: true, alreadyClaimed: true });
      }

      // Re-verify the captured amount directly with PayPal (audit §2).
      let verified: { status: string; amountCents: number };
      try {
        verified = await getPayPalCaptureDetails(captureId);
      } catch (verifyErr: any) {
        console.error('Webhook: capture verification failed:', verifyErr.message);
        return NextResponse.json(
          { error: 'Capture verification failed' },
          { status: 502 }
        );
      }

      if (verified.status !== 'COMPLETED' || verified.amountCents !== amountCents) {
        console.error(
          `Webhook: amount/status mismatch (got ${verified.amountCents}/${verified.status}, expected ${amountCents}/COMPLETED)`
        );
        try {
          await refundPayPalCapture(captureId, amountCents);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'refunded',
          });
        } catch (refundErr: any) {
          console.error('Webhook: refund failed:', refundErr.message);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'failed_needs_refund',
          });
        }
        return NextResponse.json({ received: true, refunded: true });
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
        if (claimResult.displacedCompanyId) {
          triggerAutoDefend(categoryId, position, claimResult.displacedCompanyId).catch((autoErr) =>
            console.error('triggerAutoDefend failed:', autoErr)
          );
        }
        return NextResponse.json({ received: true });
      } catch (err: any) {
        console.error('Webhook: claimPosition failed, refunding:', err.message);
        try {
          await refundPayPalCapture(captureId, amountCents);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'refunded',
          });
        } catch (refundErr: any) {
          console.error('Webhook: refund failed:', refundErr.message);
          await recordClaim({
            companyId,
            categoryId,
            amountCents,
            position,
            paymentRefId: captureId,
            paymentProvider: 'paypal',
            status: 'failed_needs_refund',
          });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
