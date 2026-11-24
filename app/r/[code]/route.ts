import { NextResponse } from 'next/server';
import { followupUrl } from '@/lib/server/followup';

// Short links in the follow-up email and SMS, e.g. /r/s2m = SMS, step 2, Montenegrin.
// Redirects to the page with UTMs, so bookings from the follow-up are attributed.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return NextResponse.redirect(followupUrl(req.url, code), 302);
}
