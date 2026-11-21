import crypto from 'node:crypto';
import { languageOf, splitName, type Submission } from './tally.ts';

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const norm = (v: string) => v.trim().toLowerCase();

// Meta Conversions API "Lead" with the same event_id as the browser Pixel event,
// so Meta keeps one of the two. Sent only when the visitor allowed ad cookies.
export function buildLeadEvent(s: Submission, siteUrl: string, status?: string) {
  const h = s.hidden;
  const { first, last } = splitName(s.parentName);
  const phoneDigits = s.phone.replace(/\D/g, '');
  const user_data: Record<string, unknown> = {};
  if (s.email) user_data.em = [sha(norm(s.email))];
  if (phoneDigits) user_data.ph = [sha(phoneDigits.startsWith('0') ? '382' + phoneDigits.slice(1) : phoneDigits)];
  if (first) user_data.fn = [sha(norm(first))];
  if (last) user_data.ln = [sha(norm(last))];
  if (h.fbp) user_data.fbp = h.fbp;
  if (h.fbc) user_data.fbc = h.fbc;
  if (h.user_agent) user_data.client_user_agent = h.user_agent;
  const lang = languageOf(s);
  return {
    event_name: 'Lead',
    event_time: Math.floor(new Date(s.submittedAt).getTime() / 1000) || Math.floor(Date.now() / 1000),
    event_id: h.event_id || s.responseId,
    action_source: 'website',
    event_source_url: siteUrl ? `${siteUrl.replace(/\/$/, '')}/#${lang}` : undefined,
    user_data,
    custom_data: status ? { language: lang, status: status.toLowerCase() } : { language: lang }
  };
}

export async function sendLead(
  opts: { pixelId: string; token: string; version: string; testCode?: string },
  event: ReturnType<typeof buildLeadEvent>
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const url = `https://graph.facebook.com/${opts.version}/${opts.pixelId}/events?access_token=${encodeURIComponent(opts.token)}`;
  const body: Record<string, unknown> = { data: [event] };
  if (opts.testCode) body.test_event_code = opts.testCode;
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ok = res.ok;
  return { ok, status: res.status, detail: ok ? undefined : (await res.text()).slice(0, 500) };
}
