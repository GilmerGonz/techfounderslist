import { NextRequest, NextResponse } from 'next/server';
import { getLongestHeld } from '@/lib/bids';

// GET /api/[locale]/index/longest-held — historical index of longest-held positions
export async function GET(_request: NextRequest) {
  try {
    const holdings = await getLongestHeld();
    return NextResponse.json({ success: true, holdings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
