import { NextRequest, NextResponse } from 'next/server';
import { createCompany } from '@/lib/bids';
import { rateLimit, getClientIp, isValidEmail, isValidLogoUrl } from '@/lib/rateLimit';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const ip = getClientIp(request.headers);

  if (!(await rateLimit(`companies:${ip}`, { windowMs: 60_000, max: 5 }, response))) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { categoryId, name, url, logoUrl, description, ownerEmail, billingCountry, billingTaxId, turnstileToken } = body;

    // Anti-bot: only enforced when Turnstile is configured (no-op otherwise).
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return NextResponse.json(
        { success: false, error: 'Captcha verification failed. Please try again.' },
        { status: 403 }
      );
    }

    if (!categoryId || !name || !url || !ownerEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (categoryId, name, url, ownerEmail)' },
        { status: 400 }
      );
    }

    if (!isValidEmail(ownerEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (logoUrl && !isValidLogoUrl(logoUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid logo URL. Only public http/https URLs are allowed.' },
        { status: 400 }
      );
    }

    const company = await createCompany({
      categoryId,
      name,
      url,
      logoUrl,
      description,
      ownerEmail,
      billingCountry: typeof billingCountry === 'string' ? billingCountry : undefined,
      billingTaxId: typeof billingTaxId === 'string' ? billingTaxId : undefined,
    });

    // Do NOT leak the owner email back to the client.
    const { ownerEmail: _ownerEmail, ...safeCompany } = company as any;
    return NextResponse.json({
      success: true,
      company: safeCompany,
      token: company.token,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
