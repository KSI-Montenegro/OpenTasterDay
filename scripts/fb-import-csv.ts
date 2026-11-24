// Start the follow-up for leads from Meta's lead CSV exports (when the API cannot list them).
// Dry run by default; --send starts step 1 now (reminders follow 2 and 5 days later).
//
//   BREVO_API_KEY=... BREVO_LIST_ID=17 BREVO_FB_LIST_ID=18 BREVO_FB_TEMPLATES='{...}' \
//   FB_FORM_LANG='{"<form id>":"mne"}' npm run fb-import -- leads1.csv leads2.csv [--send]
import { readFileSync } from 'node:fs';
import { parseLeadsCsv, type FbLead } from '../lib/server/meta-leads.ts';
import { spamReason } from '../lib/server/spam.ts';
import { ingestLead } from '../lib/server/fb-followup.ts';

const env = process.env;
const args = process.argv.slice(2);
const send = args.includes('--send');
const files = args.filter((a) => !a.startsWith('--'));
const byId = new Map<string, FbLead>();
// Meta exports UTF-16 (with a byte order mark); other tools save UTF-8.
const read = (f: string) => {
  const b = readFileSync(f);
  return b[0] === 0xff && b[1] === 0xfe ? b.toString('utf16le') : b.toString('utf8');
};
for (const f of files) for (const l of parseLeadsCsv(read(f), env.FB_FORM_LANG)) byId.set(l.id, l);
const leads = [...byId.values()];
console.log(`${leads.length} unique leads from ${files.length} files`);
for (const l of leads) {
  const spam = spamReason(l);
  console.log(`${l.id} ${l.lang} ${l.firstName} ${l.lastName} <${l.email}> ${l.phone} ${spam ? `SPAM: ${spam}` : 'ok'}`);
}
if (!send) console.log('Dry run. Add --send to start the follow-up.');
else {
  const now = Date.now();
  for (const l of leads) console.log(JSON.stringify(await ingestLead(env, l, now, now)));
}
