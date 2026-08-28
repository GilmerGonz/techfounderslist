/**
 * Cloudflare Turnstile verification (anti-bot).
 *
 * Disabled (returns `true`) unless TURNSTILE_SECRET_KEY is configured, so the
 * existing company-creation and checkout flows are unaffected until the operator
 * adds both TURNSTILE_SECRET_KEY (server) and NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * (client widget). When enabled, a missing/invalid token fails the request.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(
  token: string | undefined,
  ip: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Not configured → do not enforce.
  if (!secret) return true;
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') params.set('remoteip', ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data: any = await res.json();
    return !!data?.success;
  } catch (err) {
    console.error('[turnstile] verification error:', err);
    return false;
  }
}
