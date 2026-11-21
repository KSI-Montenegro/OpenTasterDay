import { NextResponse } from 'next/server';
import { languageOf, parseSubmission, verifySignature } from '@/lib/server/tally';
import { sendConfirmation, upsertContact } from '@/lib/server/brevo';
import { buildLeadEvent, sendLead } from '@/lib/server/meta';
import { appendToSheet, tasterGroupOf, type SheetResult } from '@/lib/server/sheet';
import { decideStatus, templateFor } from '@/lib/server/booking';
import { capsWith } from '@/lib/places';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tally calls this when a parent submits the booking form.
// 1. Verify the Tally signature.
// 2. Add the booking to the shared applicant sheet. The sheet decides Confirmed or Waitlist
//    against the places for the child's group (under a lock, so the last place goes to one parent).
// 3. Create or update the Brevo contact (with STATUS) and add it to the event list.
// 4. Email the parent: the confirmation, or the waitlist message.
// 5. Send the Meta Conversions API Lead (same event_id as the browser Pixel event).
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.TALLY_SIGNING_SECRET || '';
  if (!verifySignature(raw, req.headers.get('tally-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if ((payload as { eventType?: string }).eventType !== 'FORM_RESPONSE') {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const s = parseSubmission(payload);
  if (!s || !s.email) {
    console.error('Taster webhook: no email in submission');
    return NextResponse.json({ ok: false, error: 'No email in submission' }, { status: 200 });
  }
  const lang = languageOf(s);
  const result: Record<string, unknown> = { lang };

  // Sheet first: it holds the places count. A sheet problem is logged and never blocks the email.
  // A Tally retry is safe: the sheet returns the stored status for a Response ID it already has.
  const sheetUrl = process.env.SHEET_WEBHOOK_URL || '';
  let sheet: SheetResult | null = null;
  if (sheetUrl) {
    const caps = capsWith(process.env.CAP_OVERRIDE);
    sheet = await appendToSheet(sheetUrl, process.env.SHEET_WEBHOOK_TOKEN || '', s, caps[tasterGroupOf(s)] ?? 0);
    result.sheet = sheet.ok ? (sheet.duplicate ? 'duplicate' : 'ok') : sheet.status;
    if (!sheet.ok) console.error('Sheet append failed', sheet.status, sheet.detail);
  } else {
    result.sheet = 'skipped: SHEET_WEBHOOK_URL missing';
  }
  const status = decideStatus(sheet, s.hidden.status);
  result.status = status;

  // Brevo contact + list. A failure here returns 500 so Tally retries the webhook.
  const brevoKey = process.env.BREVO_API_KEY || '';
  const listId = parseInt(process.env.BREVO_LIST_ID || '', 10);
  if (brevoKey && listId) {
    const contact = await upsertContact(brevoKey, listId, s, status);
    result.contact = contact.status;
    if (!contact.ok) {
      console.error('Brevo contact failed', contact.status, contact.detail);
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    const templateId = templateFor(lang, status, process.env);
    if (templateId) {
      // Not retried on failure, so a parent never gets the email twice.
      const mail = await sendConfirmation(brevoKey, templateId, s);
      result.email = mail.status;
      if (!mail.ok) console.error('Brevo email failed', status, mail.status, mail.detail);
    } else {
      result.email = `skipped: no ${status} template id`;
      console.error('No Brevo template for', lang, status);
    }
  } else {
    result.contact = 'skipped: BREVO_API_KEY or BREVO_LIST_ID missing';
  }

  // Meta Conversions API, only with the visitor's ad consent. Waitlist sign-ups are leads too.
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
  const token = process.env.META_CAPI_TOKEN || '';
  if (pixelId && token && s.hidden.ad_consent === 'granted') {
    const capi = await sendLead(
      {
        pixelId,
        token,
        version: process.env.META_API_VERSION || 'v23.0',
        testCode: process.env.META_TEST_EVENT_CODE || undefined
      },
      buildLeadEvent(s, process.env.SITE_URL || '', status)
    );
    result.capi = capi.status;
    if (!capi.ok) console.error('Meta CAPI failed', capi.status, capi.detail);
  } else {
    result.capi = pixelId && token ? 'skipped: no ad consent' : 'skipped: not configured';
  }

  console.log('Taster booking', JSON.stringify({ response: s.responseId, ...result }));
  return NextResponse.json({ ok: true, ...result });
}

export function GET() {
  return NextResponse.json({ ok: true, info: 'POST Tally webhooks here.' });
}
