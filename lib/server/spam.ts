// Spam check for Facebook lead form leads. A lead flagged here is logged and never messaged.
import { e164 } from './brevo.ts';

const DISPOSABLE = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
  'throwawaymail.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'tempmailo.com', 'example.com', 'test.com'
];
const JUNK_NAME = /^(test\w*|asdf\w*|qwer\w*|xxx+|aaa+|abc|n\/?a|none|null|undefined|fake|spam|\.+|-+)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function spamReason(lead: { firstName: string; lastName: string; email: string; phone: string }): string | null {
  const name = `${lead.firstName} ${lead.lastName}`.trim();
  const email = lead.email.trim().toLowerCase();
  const phone = e164(lead.phone);
  if (email && !EMAIL.test(email)) return 'invalid email';
  if (!email && !phone) return 'no email or phone';
  const domain = email.split('@')[1] || '';
  if (DISPOSABLE.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'disposable email';
  if (!/\p{L}/u.test(name)) return 'no name';
  if (/https?:|www\.|\.(com|net|ru|xyz)\b/i.test(name)) return 'link in name';
  if (name.split(/\s+/).every((w) => JUNK_NAME.test(w))) return 'test or junk name';
  if (lead.phone.trim() && !phone) return 'invalid phone';
  const digits = phone.replace(/\D/g, '').slice(3); // after the country code
  if (phone && (/^(\d)\1+$/.test(digits) || /^(0123456|1234567|7654321)/.test(digits))) return 'fake phone';
  return null;
}
