# KSI Montenegro Taster Morning landing page

One page, two languages (`#en`, `#mne`), Next.js on Vercel.

- `lib/content.ts`: all page copy (EN and MNE), exactly as supplied.
- `components/`: page, Typeform embed, cookie consent banner.
- `app/layout.tsx`: Google Consent Mode v2 defaults, GA4 and Google Ads tag, Meta Pixel (loaded only after consent).
- `app/api/typeform-webhook/route.ts`: Typeform webhook. Verifies the signature, creates or updates the Brevo contact, adds it to the list, sends the confirmation email, sends the Meta Conversions API Lead.

No keys or IDs are in the code. All of them are Vercel environment variables; see `.env.example`.

## Typeform form setup

Hidden fields (both forms): `lang, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, fbp, fbc, event_id, ad_consent, user_agent`

Question refs (Question settings > ref):

| Question | ref | Type |
|---|---|---|
| Parent name | `parent_name` | Short text |
| Email | `email` | Email |
| Phone | `phone` | Phone number |
| Child name | `child_name` | Short text |
| Child date of birth | `child_dob` | Date |

Webhook: `https://<your domain>/api/typeform-webhook`, with a secret (same value as `TYPEFORM_WEBHOOK_SECRET`).

## Develop

```
npm install
npm run dev        # http://localhost:3000/#en
npm test           # webhook signature, parsing, Brevo and Meta payloads
npm run lint:copy  # no em or en dashes in the copy
```
