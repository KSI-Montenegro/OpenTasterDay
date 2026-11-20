import { languageOf, splitName, type Submission } from './tally.ts';
import { yearGroupFor, OUTSIDE_TASTER } from '../yearGroup.ts';

const API = 'https://api.brevo.com/v3';

type Result = { ok: boolean; status: number; detail?: string };

async function call(key: string, path: string, body: unknown): Promise<Result> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, detail: ok ? undefined : (await res.text()).slice(0, 500) };
}

// Phone in E.164 for Brevo's SMS/WHATSAPP attributes, or '' if it cannot be.
export function e164(phone: string): string {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (/^0\d{7,10}$/.test(d)) d = '+382' + d.slice(1); // local Montenegrin number
  return /^\+\d{8,15}$/.test(d) ? d : '';
}

export function contactAttributes(s: Submission): Record<string, string> {
  const { first, last } = splitName(s.parentName);
  const phone = e164(s.phone);
  const h = s.hidden;
  const attrs: Record<string, string> = {
    FIRSTNAME: first,
    LASTNAME: last,
    SMS: phone,
    WHATSAPP: phone,
    STUDENT_NAME: s.childName,
    CHILD_DOB: s.childDob,
    // Worked out from the date of birth (school placement sheet, 2026-27), for internal sorting.
    YEAR_GROUP: yearGroupFor(s.childDob)?.label || '',
    TASTER_GROUP: s.childDob ? yearGroupFor(s.childDob)?.tasterGroup || OUTSIDE_TASTER : '',
    CURRENT_SCHOOL: s.currentSchool,
    CURRENT_GRADE: s.currentGrade,
    ENGLISH_LEVEL: s.englishLevel,
    MOTHER_TONGUE: s.motherTongue,
    // Medical information is health data: it goes to the staff sheet only, never to Brevo.
    LANGUAGE: languageOf(s).toUpperCase(),
    UTM_SOURCE: h.utm_source || '',
    UTM_MEDIUM: h.utm_medium || '',
    UTM_CAMPAIGN: h.utm_campaign || '',
    UTM_CONTENT: h.utm_content || '',
    UTM_TERM: h.utm_term || '',
    FBCLID: h.fbclid || '',
    GCLID: h.gclid || ''
  };
  // Empty values would wipe what an existing contact already has.
  return Object.fromEntries(Object.entries(attrs).filter(([, v]) => v));
}

// Create or update the contact and add it to the event list.
export async function upsertContact(key: string, listId: number, s: Submission): Promise<Result> {
  const attributes = contactAttributes(s);
  const body = (a: Record<string, string>) => ({ email: s.email, attributes: a, listIds: [listId], updateEnabled: true });
  let r = await call(key, '/contacts', body(attributes));
  if (!r.ok && r.status === 400) {
    // A phone already used by another contact, or not accepted by Brevo: keep it out and save the rest.
    const { SMS, WHATSAPP, ...rest } = attributes;
    void SMS; void WHATSAPP;
    r = await call(key, '/contacts', body(rest));
    if (!r.ok && r.status === 400) {
      // Last resort: an attribute missing in Brevo (e.g. CHILD_DOB not created yet). Save the essentials.
      const essentials = Object.fromEntries(
        Object.entries(rest).filter(([k]) => ['FIRSTNAME', 'LASTNAME', 'LANGUAGE', 'STUDENT_NAME', 'YEAR_GROUP', 'TASTER_GROUP'].includes(k))
      );
      r = await call(key, '/contacts', body(essentials));
    }
  }
  return r;
}

// Confirmation email from the Brevo template for the visitor's language.
export async function sendConfirmation(key: string, templateId: number, s: Submission): Promise<Result> {
  return call(key, '/smtp/email', {
    templateId,
    to: [{ email: s.email, name: s.parentName || undefined }],
    params: {
      PARENT_NAME: s.parentName,
      FIRSTNAME: splitName(s.parentName).first,
      CHILD_NAME: s.childName,
      CHILD_DOB: s.childDob
    },
    tags: ['taster-morning']
  });
}
