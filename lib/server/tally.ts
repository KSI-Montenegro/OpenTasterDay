import crypto from 'node:crypto';

// Tally signs each webhook: header "Tally-Signature: <base64 HMAC-SHA256 of the raw body>",
// using the signing secret set on the webhook.
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(header.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type Submission = {
  responseId: string;
  submittedAt: string;
  parentName: string;
  email: string;
  phone: string;
  childName: string;
  childDob: string; // YYYY-MM-DD
  currentSchool: string;
  currentGrade: string;
  englishLevel: string; // "1", "2" or "3" ('' if not answered)
  motherTongue: string;
  medical: string;
  hidden: Record<string, string>;
};

type Field = { key?: string; label?: string; type?: string; value?: unknown; options?: { id?: string; text?: string }[] };

const str = (v: unknown): string => (v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v)).trim();

// Tally dates arrive as YYYY-MM-DD; also accept dd.MM.yyyy and dd/MM/yyyy.
export function isoDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (d) return `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
  return '';
}

const PARENT = /parent|roditelj/i;
const CHILD = /child|djete|dijete/i;
const SCHOOL = /school|škol|skol/i;
const GRADE = /grade|razred/i;
const LEVEL = /english|englesk/i;
const TONGUE = /tongue|maternji/i;
const MEDICAL = /medical|allerg|alergij|zdravstv/i;

// English level, the same 1-3 scale teachers use after the lesson. Stored in English for both forms.
export const ENGLISH_LEVELS: Record<string, string> = {
  '1': '1 - Little or no English',
  '2': '2 - Follows simple instructions and talks about everyday things',
  '3': '3 - Learns comfortably in English'
};

// Dropdown answers arrive as option ids plus the option list; return the chosen texts.
function choiceText(f: Field | undefined): string {
  if (!f) return '';
  const ids = Array.isArray(f.value) ? f.value.map(String) : [str(f.value)];
  const texts = ids.map((v) => f.options?.find((o) => o.id === v)?.text || v);
  return str(texts);
}

// Field mapping for the KSI Taster Morning forms (EN and MNE):
//   email, phone, date: by field type
//   parent and child names: by label (EN or MNE), else the 1st and 2nd text field
//   hidden fields (lang, UTMs, fbclid, gclid, fbp, fbc, event_id, ...): HIDDEN_FIELDS entries, by label
export function parseSubmission(payload: unknown): Submission | null {
  const p = payload as { eventType?: string; createdAt?: string; data?: { responseId?: string; submissionId?: string; createdAt?: string; fields?: Field[] } };
  const data = p?.data;
  if (!data || !Array.isArray(data.fields)) return null;
  const fields = data.fields;
  const ofType = (t: string) => fields.find((f) => f.type === t);
  // Name candidates: text fields that are not one of the school questions ("Child's current school" mentions the child).
  const texts = fields.filter((f) => f.type === 'INPUT_TEXT' && ![SCHOOL, GRADE, TONGUE].some((re) => re.test(f.label || '')));
  const parent = texts.find((f) => PARENT.test(f.label || '')) || texts[0];
  const child = texts.find((f) => CHILD.test(f.label || '') && f !== parent) || texts.find((f) => f !== parent);
  const byLabel = (re: RegExp, types: string[]) => fields.find((f) => types.includes(f.type || '') && re.test(f.label || ''));
  const level = choiceText(byLabel(LEVEL, ['DROPDOWN', 'MULTIPLE_CHOICE'])).match(/^\s*([123])\b/)?.[1] || '';
  const hidden: Record<string, string> = {};
  for (const f of fields) if (f.type === 'HIDDEN_FIELDS' && f.label) hidden[f.label] = str(f.value);
  return {
    responseId: str(data.responseId || data.submissionId),
    submittedAt: str(data.createdAt || p.createdAt) || new Date().toISOString(),
    parentName: str(parent?.value),
    email: str(ofType('INPUT_EMAIL')?.value).toLowerCase(),
    phone: str(ofType('INPUT_PHONE_NUMBER')?.value),
    childName: str(child?.value),
    childDob: isoDate(str(ofType('INPUT_DATE')?.value)),
    currentSchool: str(byLabel(SCHOOL, ['INPUT_TEXT'])?.value),
    currentGrade: str(byLabel(GRADE, ['INPUT_TEXT'])?.value),
    englishLevel: level,
    motherTongue: str(byLabel(TONGUE, ['INPUT_TEXT'])?.value),
    medical: str(byLabel(MEDICAL, ['TEXTAREA', 'INPUT_TEXT'])?.value),
    hidden
  };
}

export const languageOf = (s: Submission): 'en' | 'mne' => (s.hidden.lang === 'mne' ? 'mne' : 'en');

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}
