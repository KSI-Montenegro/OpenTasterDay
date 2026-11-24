# KSI Montenegro Taster Morning landing page

One page, two languages (`#en`, `#mne`), Next.js on Vercel.

- `lib/content.ts`: all page copy (EN and MNE), exactly as supplied.
- `app/page.tsx`: the page, server-rendered with both languages; CSS shows the one in the hash.
- `components/`: client island (language switch, buttons, sticky bar), Tally form embed, cookie consent banner.
- `app/layout.tsx`: Google Consent Mode v2 defaults, GA4 and Google Ads tag, Meta Pixel (loaded only after consent).
- `app/api/tally-webhook/route.ts`: Tally webhook. Verifies the signature, creates or updates the Brevo contact, adds it to the list, sends the confirmation email, sends the Meta Conversions API Lead.

No keys or IDs are in the code. All of them are Vercel environment variables; see `.env.example`.

## Tally forms

Two forms, "KSI Taster Morning (EN)" and "(MNE)", in the KSI Tally workspace.

Fields (all required): parent's first and last name, email, phone, child's first and last name, child's date of birth,
child's current school, current grade, English level (dropdown 1-3), mother tongue, medical information or allergies.
The webhook finds email, phone and date by field type, and the rest by words in their labels (EN or MNE):
parent/roditelj, child/djete, school/škol, grade/razred, english/englesk, tongue/maternji, medical/allerg/zdravstv.
Keep those words in the labels if you edit them. English level options must start with 1, 2 or 3.

Hidden fields: `lang, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, fbp, fbc, event_id, ad_consent, user_agent`

Webhook on each form: `https://<your domain>/api/tally-webhook`, event "Form response", signing secret = `TALLY_SIGNING_SECRET`.

## Brevo

- List: "Taster Morning 11 Dec 2026"
- Contact attributes: FIRSTNAME, LASTNAME, SMS, WHATSAPP, STUDENT_NAME, CHILD_DOB (date), YEAR_GROUP, TASTER_GROUP,
  CURRENT_SCHOOL, CURRENT_GRADE, ENGLISH_LEVEL, MOTHER_TONGUE, LANGUAGE, UTM_*, FBCLID, GCLID
- Medical information is never sent to Brevo. It is only in the applicant sheet.
- Templates: "Taster Morning confirmation (EN)" and "(MNE)", params PARENT_NAME, FIRSTNAME, CHILD_NAME, CHILD_DOB

## Applicant sheet

Google Sheet "Taster Morning 11 Dec 2026 applicants", tab "Applicants". Each booking adds a row (EN and MNE together),
with the KSI year group and Taster group worked out from the date of birth. Columns S and T (English level (teacher),
Teacher note) are for staff after the lesson and are never overwritten.

How it is fed: the webhook POSTs the row to a Google Apps Script web app in the sheet (`scripts/sheet-apps-script.gs`).
The script checks a token and skips a Response ID it already has. A sheet failure is logged and does not affect the
Brevo contact or the confirmation email.

Set-up, once: in the sheet, Extensions > Apps Script, paste `scripts/sheet-apps-script.gs`; Project Settings >
Script properties, add `TOKEN` (= `SHEET_WEBHOOK_TOKEN` in Vercel); Deploy > New deployment > Web app, execute as Me,
access Anyone; put the /exec URL in Vercel as `SHEET_WEBHOOK_URL` and redeploy.

Missed rows: `TALLY_API_KEY=... SHEET_WEBHOOK_URL=... SHEET_WEBHOOK_TOKEN=... npm run sync-sheet` re-sends every
booking from Tally; rows already in the sheet are skipped.

The sheet has medical information: share it with named staff only, not "anyone with the link".

## Facebook lead form follow-up

People who fill in a Taster Morning Facebook lead form (Meta Lead Ads) get up to 3 nudges to finish the booking
on this page: right away, after 2 days and after 5 days (email always; SMS 09:00 to 20:00 Montenegro time).
It stops as soon as the family books or joins the waitlist (matched by email or phone), and after registration
closes (Sunday 6 December).

- `/api/fb-leads/poll` (cron, every 5 minutes): reads new leads from the Page's lead forms whose name matches
  `FB_FORM_MATCH` (default `taster|probno`) or `FB_FORM_IDS`, adds them to the Brevo list "Taster Morning FB leads"
  and sends step 1. Form language: "EN"/"English" in the form name means English, otherwise Montenegrin
  (`FB_FORM_LANG` overrides per form id).
- `/api/fb-leads/remind` (cron, hourly): steps 2 and 3, and texts held overnight.
- State lives on the Brevo contact: FB_LEAD_ID, FB_FOLLOWUP_START, FB_STEP, FB_SMS_STEP, FB_PHONE, FB_BOOKED, LEAD_SOURCE.
- Emails: Brevo templates "Taster FB follow-up 1/2/3 (EN/MNE)", ids in `BREVO_FB_TEMPLATES` (JSON, keys `1en` ... `3mne`),
  param LINK.
- SMS: Brevo (`BREVO_SMS_SENDER`, needs SMS credits), falling back to Infobip (`INFOBIP_BASE_URL`, `INFOBIP_API_KEY`,
  `INFOBIP_SENDER`). Texts are in `lib/server/followup.ts`.
- Links: `/r/<code>` (e.g. `/r/s2m` = SMS, step 2, Montenegrin) redirect to the page with
  `utm_source=facebook&utm_medium=lead_form_followup&utm_content=sms2`.
- Texts: WhatsApp first when `INFOBIP_WHATSAPP_SENDER` and `INFOBIP_WA_TEMPLATES` (approved template names, keys
  `1en` ... `3mne`, one placeholder: the link) are set, with Infobip's automatic SMS failover; otherwise SMS.
  No texts at all until `SMS_ENABLED=1` (set it once Infobip or Brevo SMS has credit).
- Spam (`lib/server/spam.ts`): invalid or disposable email, no real name, test/junk names, links in the name,
  fake phones. Logged, never messaged.
- Past leads: `npm run fb-backfill -- --days 30` lists them (dry run); add `--send` to start their follow-up.
  This needs the Meta token to have `pages_manage_ads`. Without it, import Meta's CSV exports instead:
  `npm run fb-import -- leads.csv [--send]` (UTF-16 or UTF-8, duplicates across files removed).

## Develop

```
npm install
npm run dev        # http://localhost:3000/#en
npm test           # webhook signature, parsing, Brevo and Meta payloads
npm run lint:copy  # no em or en dashes in the copy
```
