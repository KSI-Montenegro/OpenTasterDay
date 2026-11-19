import crypto from 'node:crypto';

// Typeform signs each webhook: header "Typeform-Signature: sha256=<base64 HMAC-SHA256 of the raw body>".
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(header);
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
  hidden: Record<string, string>;
};

type Answer = {
  type: string;
  field?: { ref?: string; type?: string };
  text?: string;
  email?: string;
  phone_number?: string;
  date?: string;
  number?: number;
};

const valueOf = (a: Answer): string =>
  String(a.text ?? a.email ?? a.phone_number ?? a.date ?? (a.number != null ? a.number : '') ?? '').trim();

// Answers are matched by the question "ref" set in Typeform:
//   parent_name (or parent_first_name + parent_last_name), email, phone, child_name, child_dob.
// Email, phone and date questions are also found by type if their ref differs.
export function parseSubmission(payload: unknown): Submission | null {
  const fr = (payload as { form_response?: Record<string, unknown> })?.form_response;
  if (!fr) return null;
  const answers = (Array.isArray(fr.answers) ? fr.answers : []) as Answer[];
  const byRef = new Map<string, string>();
  for (const a of answers) if (a.field?.ref) byRef.set(a.field.ref, valueOf(a));
  const firstOfType = (t: string) => {
    const a = answers.find((x) => x.type === t);
    return a ? valueOf(a) : '';
  };
  const parentName =
    byRef.get('parent_name') ||
    [byRef.get('parent_first_name'), byRef.get('parent_last_name')].filter(Boolean).join(' ');
  const hiddenRaw = (fr.hidden || {}) as Record<string, unknown>;
  const hidden = Object.fromEntries(Object.entries(hiddenRaw).map(([k, v]) => [k, v == null ? '' : String(v)]));
  return {
    responseId: String(fr.token || ''),
    submittedAt: String(fr.submitted_at || new Date().toISOString()),
    parentName: parentName.trim(),
    email: (byRef.get('email') || firstOfType('email')).toLowerCase(),
    phone: byRef.get('phone') || firstOfType('phone_number'),
    childName: byRef.get('child_name') || '',
    childDob: (byRef.get('child_dob') || firstOfType('date')).slice(0, 10),
    hidden
  };
}

export const languageOf = (s: Submission): 'en' | 'mne' => (s.hidden.lang === 'mne' ? 'mne' : 'en');

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}
