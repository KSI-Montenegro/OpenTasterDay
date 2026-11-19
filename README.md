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

Fields (all required): parent's first and last name, email, phone, child's first and last name, child's date of birth.
The webhook finds email, phone and date by field type, and the two names by their labels
(parent/roditelj, child/djete), so keep those words in the labels if you edit them.

Hidden fields: `lang, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, fbp, fbc, event_id, ad_consent, user_agent`

Webhook on each form: `https://<your domain>/api/tally-webhook`, event "Form response", signing secret = `TALLY_SIGNING_SECRET`.

## Brevo

- List: "Taster Morning 11 Dec 2026"
- Contact attributes: FIRSTNAME, LASTNAME, SMS, WHATSAPP, STUDENT_NAME, CHILD_DOB (date), LANGUAGE, UTM_*, FBCLID, GCLID
- Templates: "Taster Morning confirmation (EN)" and "(MNE)", params PARENT_NAME, FIRSTNAME, CHILD_NAME, CHILD_DOB

## Develop

```
npm install
npm run dev        # http://localhost:3000/#en
npm test           # webhook signature, parsing, Brevo and Meta payloads
npm run lint:copy  # no em or en dashes in the copy
```
