// Follow-up for people who filled in the Taster Morning Facebook lead form:
// up to 3 nudges (email + SMS) to finish the booking on the website.
//   step 1: straight away (email any time; SMS only 09:00-20:00 Montenegro time)
//   step 2: 2 days after the follow-up started
//   step 3: 5 days after the follow-up started (last reminder)
// Nothing is sent once the family has booked or joined the waitlist on the site,
// or after registration closes.

export const REGISTRATION_CLOSES = Date.parse('2026-12-06T23:59:59+01:00');
const DAY = 24 * 60 * 60 * 1000;
const STEP_AFTER: Record<number, number> = { 1: 0, 2: 2 * DAY, 3: 5 * DAY };
export const LAST_STEP = 3;

export type Lang = 'en' | 'mne';

export type FollowupState = {
  start: number; // ms: when the follow-up started (lead time, or the backfill run)
  step: number; // last step done (0 = none)
  smsStep: number; // last step texted (0 = none)
  booked: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
};

// step: the new last step, if it moves. email / sms: the step to send on that channel now.
export type Action = { step?: number; email?: number; sms?: number };

export function montenegroHour(now: number): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Podgorica', hour: '2-digit', hourCycle: 'h23' }).format(now));
}

export const sendingHours = (now: number) => {
  const h = montenegroHour(now);
  return h >= 9 && h < 20;
};

// What to send now, if anything. One step per run. A text held overnight is sent for the
// latest step only, so nobody gets two texts at once.
export function nextAction(s: FollowupState, now: number): Action {
  if (s.booked || now > REGISTRATION_CLOSES) return {};
  const daytime = sendingHours(now);
  const out: Action = {};
  let step = s.step;
  const next = step + 1;
  // Step 1 email goes straight away; reminders only in sending hours.
  if (next <= LAST_STEP && now - s.start >= STEP_AFTER[next] && (next === 1 || daytime)) {
    if (s.hasEmail) {
      step = next;
      out.email = next;
    } else if (s.hasPhone && daytime) {
      step = next; // SMS-only lead: the text below carries the step
    }
  }
  if (step !== s.step) out.step = step;
  if (s.hasPhone && daytime && s.smsStep < step) out.sms = step;
  return out;
}

// Short link codes for /r/[code]: channel (e|s) + step + language (e|m).
export function linkCode(channel: 'email' | 'sms', step: number, lang: Lang): string {
  return `${channel === 'email' ? 'e' : 's'}${step}${lang === 'mne' ? 'm' : 'e'}`;
}

export function parseLinkCode(code: string): { channel: 'email' | 'sms'; step: number; lang: Lang } | null {
  const m = /^([es])([1-3])([em])$/.exec(code);
  if (!m) return null;
  return { channel: m[1] === 'e' ? 'email' : 'sms', step: Number(m[2]), lang: m[3] === 'm' ? 'mne' : 'en' };
}

// SMS texts: plain GSM characters (no diacritics) so each stays one 160-character segment.
const SMS: Record<Lang, Record<number, string>> = {
  en: {
    1: 'KSI Montenegro: finish your Taster Morning booking (Fri 11 Dec) here: {link}',
    2: 'KSI Montenegro: your Taster Morning registration is not finished yet. Places are limited: {link}',
    3: 'KSI Montenegro: last reminder. Finish your Taster Morning registration or your request will be deleted: {link}'
  },
  mne: {
    1: 'KSI Montenegro: zavrsite prijavu za Probno jutro (pet. 11.12.) ovdje: {link}',
    2: 'KSI Montenegro: Vasa prijava za Probno jutro jos nije zavrsena. Broj mjesta je ogranicen: {link}',
    3: 'KSI Montenegro: posljednji podsjetnik. Zavrsite prijavu za Probno jutro ili ce Vas zahtjev biti obrisan: {link}'
  }
};

export function smsText(lang: Lang, step: number, link: string): string {
  return SMS[lang][step].replace('{link}', link);
}

// Where a short link goes: the page with UTMs and the language, or the home page for an unknown code.
export function followupUrl(base: string, code: string): string {
  const c = parseLinkCode(code);
  const url = new URL('/', base);
  if (c) {
    url.searchParams.set('utm_source', 'facebook');
    url.searchParams.set('utm_medium', 'lead_form_followup');
    url.searchParams.set('utm_campaign', 'taster_fb_followup');
    url.searchParams.set('utm_content', `${c.channel}${c.step}`);
    url.hash = c.lang;
  }
  return url.toString();
}
