import { NextResponse } from 'next/server';
import { fetchCounts } from '@/lib/server/sheet';
import { availability, capsWith } from '@/lib/places';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Places left per Taster group, read from the applicant sheet.
// Kept for a minute in this server instance and at the CDN, so the sheet is read rarely.
// If the sheet cannot be read, every group shows as open: a Google problem never blocks bookings
// (the webhook still decides Confirmed or Waitlist when the form is sent).
const TTL = 60_000;
let cache: { at: number; counts: Record<string, number> } | null = null;

export async function GET() {
  const caps = capsWith(process.env.CAP_OVERRIDE);
  let counts = cache && Date.now() - cache.at < TTL ? cache.counts : null;
  let live = !!counts;
  const url = process.env.SHEET_WEBHOOK_URL || '';
  if (!counts && url) {
    counts = await fetchCounts(url, process.env.SHEET_WEBHOOK_TOKEN || '');
    if (counts) {
      cache = { at: Date.now(), counts };
      live = true;
    }
  }
  return NextResponse.json(
    { live, groups: availability(caps, counts || {}) },
    { headers: { 'cache-control': live ? 'public, s-maxage=60, stale-while-revalidate=60' : 'no-store' } }
  );
}
