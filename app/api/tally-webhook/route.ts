import { NextResponse } from 'next/server';
import { languageOf, parseSubmission, verifySignature } from '@/lib/server/tally';
import { sendConfirmation, upsertContact } from '@/lib/server/brevo';
import { buildLeadEvent, sendLead } from '@/lib/server/meta';
import { appendToSheet } from '@/lib/server/sheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tally calls this when a parent submits the booking form.
// 1. Verify the Tally signature.
// 2. Create or update the Brevo contact and add it to the event list.
// 3. Send the confirmation email from the template for the visitor's language.
// 4. Send the Meta Conversions API Lead (same event_id as the browser Pixel event).
// 5. Add a row to the shared applicant sheet (logged on failure, never retried).
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

  // Brevo contact + list. A failure here returns 500 so Tally retries the webhook.
  const brevoKey = process.env.BREVO_API_KEY || '';
  const listId = parseInt(process.env.BREVO_LIST_ID || '', 10);
  if (brevoKey && listId) {
    const contact = await upsertContact(brevoKey, listId, s);
    result.contact = contact.status;
    if (!contact.ok) {
      console.error('Brevo contact failed', contact.status, contact.detail);
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    const templateId = parseInt((lang === 'mne' ? process.env.BREVO_TEMPLATE_MNE : process.env.BREVO_TEMPLATE_EN) || '', 10);
    if (templateId) {
      // Not retried on failure, so a parent never gets the email twice.
      const mail = await sendConfirmation(brevoKey, templateId, s);
      result.email = mail.status;
      if (!mail.ok) console.error('Brevo confirmation email failed', mail.status, mail.detail);
    } else {
      result.email = 'skipped: no template id';
    }
  } else {
    result.contact = 'skipped: BREVO_API_KEY or BREVO_LIST_ID missing';
  }

  // Meta Conversions API, only with the visitor's ad consent.
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
      buildLeadEvent(s, process.env.SITE_URL || '')
    );
    result.capi = capi.status;
    if (!capi.ok) console.error('Meta CAPI failed', capi.status, capi.detail);
  } else {
    result.capi = pixelId && token ? 'skipped: no ad consent' : 'skipped: not configured';
  }

  // Shared applicant sheet. After the email on purpose: a sheet problem must not block or repeat it.
  const sheetUrl = process.env.SHEET_WEBHOOK_URL || '';
  if (sheetUrl) {
    const sheet = await appendToSheet(sheetUrl, process.env.SHEET_WEBHOOK_TOKEN || '', s);
    result.sheet = sheet.ok ? 'ok' : sheet.status;
    if (!sheet.ok) console.error('Sheet append failed', sheet.status, sheet.detail);
  } else {
    result.sheet = 'skipped: SHEET_WEBHOOK_URL missing';
  }

  console.log('Taster booking', JSON.stringify({ response: s.responseId, ...result }));
  return NextResponse.json({ ok: true, ...result });
}

export function GET() {
  return NextResponse.json({ ok: true, info: 'POST Tally webhooks here.' });
}
