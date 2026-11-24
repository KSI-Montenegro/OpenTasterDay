// Facebook lead form follow-up, stored in Brevo (no database):
// each lead is a contact on the "Taster Morning FB leads" list with
//   FB_LEAD_ID, FB_FOLLOWUP_START (ISO time), FB_STEP, FB_SMS_STEP, FB_PHONE, FB_BOOKED, LEAD_SOURCE.
import { e164 } from './brevo.ts';
import { linkCode, nextAction, smsText, type FollowupState, type Lang } from './followup.ts';
import { sendText } from './messaging.ts';
import { spamReason } from './spam.ts';
import type { FbLead } from './meta-leads.ts';

const API = 'https://api.brevo.com/v3';
type Env = Record<string, string | undefined>;

export type BrevoContact = { id: number; email?: string; listIds?: number[]; attributes: Record<string, unknown> };

async function brevo(env: Env, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'api-key': env.BREVO_API_KEY || '', 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const text = res.status === 204 ? '' : await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

const str = (v: unknown) => (v == null ? '' : String(v));

export function isBooked(c: BrevoContact, env: Env): boolean {
  const bookingList = Number(env.BREVO_LIST_ID || 0);
  return !!str(c.attributes.STATUS) || str(c.attributes.FB_BOOKED) === 'yes' || (!!bookingList && (c.listIds || []).includes(bookingList));
}

export function stateOf(c: BrevoContact, env: Env): FollowupState {
  return {
    start: Date.parse(str(c.attributes.FB_FOLLOWUP_START)) || Date.now(),
    step: Number(c.attributes.FB_STEP || 0),
    smsStep: Number(c.attributes.FB_SMS_STEP || 0),
    booked: isBooked(c, env),
    hasEmail: !!c.email && !c.email.endsWith('@mailin-sms.com'),
    // Texts (WhatsApp/SMS) only once a channel is funded: SMS_ENABLED=1.
    hasPhone: env.SMS_ENABLED === '1' && !!e164(str(c.attributes.FB_PHONE))
  };
}

const langOf = (c: BrevoContact): Lang => (str(c.attributes.LANGUAGE).toUpperCase() === 'EN' ? 'en' : 'mne');

export function templateId(env: Env, step: number, lang: Lang): number {
  try {
    const map = JSON.parse(env.BREVO_FB_TEMPLATES || '{}') as Record<string, number>;
    return Number(map[`${step}${lang}`]) || 0;
  } catch {
    return 0;
  }
}

export const shortLink = (env: Env, channel: 'email' | 'sms', step: number, lang: Lang) =>
  `${(env.SITE_URL || 'https://opentasterday.vercel.app').replace(/\/$/, '')}/r/${linkCode(channel, step, lang)}`;

// Send whatever is due for one contact and save the new step. Returns what happened.
export async function processContact(env: Env, c: BrevoContact, now: number): Promise<Record<string, unknown>> {
  const a = nextAction(stateOf(c, env), now);
  if (a.email === undefined && a.sms === undefined && a.step === undefined) return { id: c.id, action: 'none' };
  const lang = langOf(c);
  const update: Record<string, number> = {};
  const out: Record<string, unknown> = { id: c.id, lang };
  if (a.email !== undefined) {
    const tid = templateId(env, a.email, lang);
    if (!tid) return { ...out, error: `no template for step ${a.email} ${lang}` };
    const r = await brevo(env, 'POST', '/smtp/email', {
      templateId: tid,
      to: [{ email: c.email, name: str(c.attributes.FIRSTNAME) || undefined }],
      params: { FIRSTNAME: str(c.attributes.FIRSTNAME), LINK: shortLink(env, 'email', a.email, lang) },
      tags: ['taster-fb-followup']
    });
    out.email = r.ok ? a.email : `failed ${r.status} ${r.text}`;
    if (!r.ok) return out; // try again next run; do not advance
    update.FB_STEP = a.email;
  } else if (a.step !== undefined) {
    update.FB_STEP = a.step; // SMS-only lead
  }
  if (a.sms !== undefined) {
    const link = shortLink(env, 'sms', a.sms, lang);
    const r = await sendText(e164(str(c.attributes.FB_PHONE)), { key: `${a.sms}${lang}`, lang, link, smsText: smsText(lang, a.sms, link) }, env);
    out.sms = r.ok ? `${a.sms} via ${r.provider}` : `failed ${r.provider} ${r.status} ${r.detail || ''}`;
    if (r.ok) update.FB_SMS_STEP = a.sms;
    else if (a.email === undefined) delete update.FB_STEP; // SMS-only step not delivered: retry later
  }
  if (Object.keys(update).length) {
    const r = await brevo(env, 'PUT', `/contacts/${c.id}?identifierType=contact_id`, { attributes: update });
    if (!r.ok) out.saveError = `${r.status} ${r.text}`;
  }
  return out;
}

async function getContact(env: Env, identifier: string, type: 'email_id' | 'contact_id'): Promise<BrevoContact | null> {
  const r = await brevo(env, 'GET', `/contacts/${encodeURIComponent(identifier)}?identifierType=${type}`);
  return r.ok && r.json ? (r.json as BrevoContact) : null;
}

// Add a new Facebook lead (once) and send step 1. start: when the follow-up clock starts
// (the lead time for new leads, the run time for the backfill).
export async function ingestLead(env: Env, lead: FbLead, now: number, start = lead.createdAt): Promise<Record<string, unknown>> {
  const listId = Number(env.BREVO_FB_LIST_ID || 0);
  const phone = e164(lead.phone);
  const spam = spamReason(lead);
  if (spam) return { lead: lead.id, skipped: `spam: ${spam}` };
  if (!lead.email) return { lead: lead.id, skipped: 'no email (phone-only leads are not stored)' };
  const existing = await getContact(env, lead.email, 'email_id');
  if (existing && str(existing.attributes.FB_LEAD_ID)) return { lead: lead.id, skipped: 'already following up' };
  const attributes: Record<string, string | number> = {
    FB_LEAD_ID: lead.id,
    FB_FOLLOWUP_START: new Date(start).toISOString(),
    FB_STEP: 0,
    FB_SMS_STEP: 0,
    FB_PHONE: phone,
    LEAD_SOURCE: 'facebook_form',
    LANGUAGE: lead.lang.toUpperCase()
  };
  // Keep names and language a family already gave on the website.
  if (!existing?.attributes.FIRSTNAME && lead.firstName) attributes.FIRSTNAME = lead.firstName;
  if (!existing?.attributes.LASTNAME && lead.lastName) attributes.LASTNAME = lead.lastName;
  if (existing?.attributes.LANGUAGE) delete attributes.LANGUAGE;
  const r = await brevo(env, 'POST', '/contacts', { email: lead.email, attributes, listIds: listId ? [listId] : [], updateEnabled: true });
  if (!r.ok) return { lead: lead.id, error: `contact ${r.status} ${r.text}` };
  const c = await getContact(env, lead.email, 'email_id');
  if (!c) return { lead: lead.id, error: 'contact not found after save' };
  return { lead: lead.id, ...(await processContact(env, c, now)) };
}

// All contacts on the FB leads list.
export async function fbContacts(env: Env): Promise<BrevoContact[]> {
  const listId = Number(env.BREVO_FB_LIST_ID || 0);
  if (!listId) return [];
  const out: BrevoContact[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const r = await brevo(env, 'GET', `/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
    if (!r.ok) throw new Error(`Brevo list ${r.status} ${r.text}`);
    const batch = (r.json?.contacts || []) as BrevoContact[];
    out.push(...batch);
    if (batch.length < 500) break;
  }
  return out;
}

// A booking on the website: stop the follow-up for any FB lead with the same phone or email
// (families often book with a different email than the one on Facebook).
export async function markBooked(env: Env, email: string, phone: string): Promise<number> {
  if (!env.BREVO_FB_LIST_ID) return 0;
  const p = e164(phone);
  const em = email.toLowerCase();
  let n = 0;
  for (const c of await fbContacts(env)) {
    if (str(c.attributes.FB_BOOKED) === 'yes') continue;
    if ((p && e164(str(c.attributes.FB_PHONE)) === p) || (em && (c.email || '').toLowerCase() === em)) {
      const r = await brevo(env, 'PUT', `/contacts/${c.id}?identifierType=contact_id`, { attributes: { FB_BOOKED: 'yes' } });
      if (r.ok) n++;
    }
  }
  return n;
}
