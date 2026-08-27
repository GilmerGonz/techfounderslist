import { NextRequest, NextResponse } from 'next/server';
import { getIndex } from '@/lib/bids';

export async function GET(
  request: NextRequest,
  { params }: { params: { categorySlug: string } }
) {
  try {
    const data = await getIndex(params.categorySlug);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
