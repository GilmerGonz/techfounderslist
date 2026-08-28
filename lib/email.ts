/**
 * Outbound email — claim receipts.
 *
 * Default provider: Resend (free tier, single REST call). Swap the body of
 * `sendEmail` if you prefer SendGrid/Postmark; the rest of the app only depends
 * on `sendClaimReceipt`.
 *
 * Safe to call unconditionally from payment paths: it is a no-op (logged) unless
 * RESEND_API_KEY is configured.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface ClaimReceiptInput {
  to: string;
  companyName: string;
  position: number;
  amountCents: number;
  currency?: string;
  captureId: string;
  locale?: string;
}

function buildReceiptHtml(r: ClaimReceiptInput): string {
  const amount = (r.amountCents / 100).toFixed(2);
  const cur = (r.currency || 'USD').toUpperCase();
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="margin:0 0 12px">Tech Founders List — Payment receipt</h2>
    <p>Hi ${escapeHtml(r.companyName)},</p>
    <p>Thanks for claiming <strong>position #${r.position}</strong> on The Tech Founders List.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#555">Amount paid</td><td style="padding:6px 0;text-align:right;font-weight:700">${cur} ${amount}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Payment reference</td><td style="padding:6px 0;text-align:right">${escapeHtml(r.captureId)}</td></tr>
    </table>
    <p style="color:#777;font-size:13px">This is an automated receipt. Keep it for your records.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

export async function sendClaimReceipt(input: ClaimReceiptInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECEIPT_FROM_EMAIL || 'onboarding@resend.dev';
  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — skipping receipt for', input.to);
    return;
  }
  const subject = `Your Tech Founders List receipt — position #${input.position}`;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject,
        html: buildReceiptHtml(input),
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend rejected receipt:', await res.text());
    }
  } catch (err) {
    console.error('[email] sendClaimReceipt failed:', err);
  }
}
