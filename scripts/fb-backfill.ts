// Past Facebook lead form leads: list them (dry run), then, with --send, start the follow-up
// for each (step 1 now; reminders 2 and 5 days later). Families who already booked get nothing.
//
//   FB_PAGE_ID=... FB_PAGE_TOKEN=... BREVO_API_KEY=... BREVO_LIST_ID=17 BREVO_FB_LIST_ID=... \
//   BREVO_FB_TEMPLATES='{...}' [INFOBIP_*] npm run fb-backfill -- [--days 30] [--send]
import { leadsSince, pageToken, tasterForms, type FbLead } from '../lib/server/meta-leads.ts';
import { ingestLead } from '../lib/server/fb-followup.ts';

const env = process.env;
const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 30;
const send = args.includes('--send');
if (!env.FB_PAGE_ID || !env.FB_PAGE_TOKEN || !env.BREVO_API_KEY) throw new Error('Set FB_PAGE_ID, FB_PAGE_TOKEN, BREVO_API_KEY');
const version = env.META_API_VERSION || 'v23.0';

const token = await pageToken(env.FB_PAGE_ID, env.FB_PAGE_TOKEN, version);
const forms = await tasterForms(env.FB_PAGE_ID, token, version, env);
console.log(`Taster forms: ${forms.map((f) => `${f.name} (${f.id})`).join(', ') || 'none'}`);
const since = Date.now() - days * 24 * 60 * 60 * 1000;
const leads: FbLead[] = [];
for (const f of forms) leads.push(...(await leadsSince(f, since, token, version, env.FB_FORM_LANG)));

// Who already booked on the website (same email on the booking list, or a STATUS).
const booked = new Set<string>();
for (const l of leads) {
  if (!l.email) continue;
  const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(l.email)}`, { headers: { 'api-key': env.BREVO_API_KEY } });
  if (!r.ok) continue;
  const c = (await r.json()) as { listIds?: number[]; attributes?: Record<string, unknown> };
  if (c.attributes?.STATUS || (c.listIds || []).includes(Number(env.BREVO_LIST_ID || 17)) || c.attributes?.FB_LEAD_ID) booked.add(l.id);
}
const todo = leads.filter((l) => !booked.has(l.id) && l.email);
const byLang = (xs: FbLead[], lang: string) => xs.filter((l) => l.lang === lang).length;
console.log(`Leads in the last ${days} days: ${leads.length}. Already booked or already followed up: ${booked.size}. No email: ${leads.filter((l) => !l.email).length}.`);
console.log(`To message: ${todo.length} (EN ${byLang(todo, 'en')}, MNE ${byLang(todo, 'mne')})`);

if (!send) {
  console.log('Dry run. Add --send to start the follow-up for these.');
} else {
  const now = Date.now();
  for (const l of todo) console.log(JSON.stringify(await ingestLead(env, l, now, now)));
}
