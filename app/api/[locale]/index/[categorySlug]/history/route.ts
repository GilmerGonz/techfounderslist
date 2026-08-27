import { NextRequest, NextResponse } from 'next/server';
import { getRecentClaims } from '@/lib/bids';

// GET /api/[locale]/index/:categorySlug/history — chronological activity log
export async function GET(
  _request: NextRequest,
  { params }: { params: { categorySlug: string } }
) {
  try {
    const claims = await getRecentClaims(params.categorySlug);
    return NextResponse.json({ success: true, claims });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
