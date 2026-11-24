import { NextResponse } from 'next/server';
import { cronAuthorized, nowMs } from '@/lib/server/cron';
import { fbContacts, processContact } from '@/lib/server/fb-followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Hourly (vercel.json): reminders at 2 and 5 days, and texts held overnight.
// Stops for families who booked or joined the waitlist, and after registration closes.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const env = process.env;
  if (!env.BREVO_FB_LIST_ID) return NextResponse.json({ ok: true, skipped: 'BREVO_FB_LIST_ID not set' });
  const now = nowMs();
  try {
    const results = [];
    for (const c of await fbContacts(env)) {
      const r = await processContact(env, c, now);
      if (r.action !== 'none') results.push(r);
    }
    const errors = results.filter((r) => r.error || String(r.email || '').startsWith('failed') || String(r.sms || '').startsWith('failed'));
    if (errors.length) console.error('FB follow-up errors', JSON.stringify(errors));
    console.log('FB follow-up run', JSON.stringify({ sent: results.length }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error('FB follow-up run failed', String(e));
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
