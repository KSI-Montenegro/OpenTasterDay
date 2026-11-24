import { NextResponse } from 'next/server';
import { cronAuthorized, nowMs } from '@/lib/server/cron';
import { leadsSince, pageToken, tasterForms } from '@/lib/server/meta-leads';
import { ingestLead } from '@/lib/server/fb-followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Every 5 minutes (vercel.json): new leads from the Taster Morning Facebook lead forms get
// added to Brevo and receive step 1 (email now, SMS in sending hours). Looks back 2 hours,
// so a missed run is caught by the next; each lead is handled once (FB_LEAD_ID on the contact).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const env = process.env;
  if (!env.FB_PAGE_ID || !env.FB_PAGE_TOKEN || !env.BREVO_FB_LIST_ID) {
    return NextResponse.json({ ok: true, skipped: 'FB_PAGE_ID, FB_PAGE_TOKEN or BREVO_FB_LIST_ID not set' });
  }
  const version = env.META_API_VERSION || 'v23.0';
  const now = nowMs();
  const since = now - Number(env.FB_POLL_WINDOW_MIN || 120) * 60 * 1000;
  const results: Record<string, unknown>[] = [];
  try {
    const token = await pageToken(env.FB_PAGE_ID, env.FB_PAGE_TOKEN, version);
    const forms = await tasterForms(env.FB_PAGE_ID, token, version, env);
    for (const form of forms) {
      for (const lead of await leadsSince(form, since, token, version, env.FB_FORM_LANG)) {
        results.push(await ingestLead(env, lead, now));
      }
    }
    const errors = results.filter((r) => r.error);
    if (errors.length) console.error('FB lead follow-up errors', JSON.stringify(errors));
    console.log('FB leads poll', JSON.stringify({ forms: forms.length, leads: results.length }));
    return NextResponse.json({ ok: true, forms: forms.map((f) => f.name), results });
  } catch (e) {
    console.error('FB leads poll failed', String(e));
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
