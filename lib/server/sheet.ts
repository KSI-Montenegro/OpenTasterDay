import { ENGLISH_LEVELS, languageOf, type Submission } from './tally.ts';
import { yearGroupFor, OUTSIDE_TASTER } from '../yearGroup.ts';
import type { Status } from '../places.ts';

// The shared applicant sheet. A Google Apps Script web app (scripts/sheet-apps-script.gs)
// appends each row and skips a Response ID it already has, so a re-send is harmless.

export const TASTER_DAY = '2026-12-11';

export const SHEET_COLUMNS = [
  'Submitted (Montenegro time)', 'Language', 'Parent name', 'Email', 'Phone', 'Child name', 'Date of birth',
  'Age on 11 Dec', 'KSI year group', 'Taster group', 'Current school', 'Current grade', 'English level (parent)',
  'Mother tongue', 'Medical / allergies', 'UTM source', 'UTM campaign', 'Response ID'
] as const;

// Whole years between a YYYY-MM-DD date of birth and the given day.
export function ageOn(dob: string, day = TASTER_DAY): string {
  const b = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!b || !d) return '';
  let age = +d[1] - +b[1];
  if (+d[2] < +b[2] || (+d[2] === +b[2] && +d[3] < +b[3])) age--;
  return age >= 0 ? String(age) : '';
}

// "2026-11-20 09:49" in Montenegro time.
export function localTime(iso: string): string {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return iso;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Podgorica', dateStyle: 'short', timeStyle: 'short' }).format(t);
}

// dd.MM.yyyy, as parents wrote it.
const localDate = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');

export function tasterGroupOf(s: Submission): string {
  return s.childDob ? yearGroupFor(s.childDob)?.tasterGroup || OUTSIDE_TASTER : '';
}

export function sheetRow(s: Submission): string[] {
  const g = s.childDob ? yearGroupFor(s.childDob) : null;
  return [
    localTime(s.submittedAt),
    languageOf(s).toUpperCase(),
    s.parentName,
    s.email,
    s.phone,
    s.childName,
    localDate(s.childDob),
    ageOn(s.childDob),
    g?.label || '',
    tasterGroupOf(s),
    s.currentSchool,
    s.currentGrade,
    ENGLISH_LEVELS[s.englishLevel] || '',
    s.motherTongue,
    s.medical,
    s.hidden.utm_source || '',
    s.hidden.utm_campaign || '',
    s.responseId
  ];
}

export type SheetResult = { ok: boolean; status: number; detail?: string; bookingStatus?: Status; duplicate?: boolean };

async function post(url: string, body: unknown): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  return { res, text: await res.text() };
}

// Adds the booking. The sheet decides Confirmed or Waitlist against the group's cap (under a lock).
export async function appendToSheet(url: string, token: string, s: Submission, cap: number): Promise<SheetResult> {
  try {
    const { res, text } = await post(url, { token, action: 'append', row: sheetRow(s), cap });
    let j: { ok?: boolean; status?: string; duplicate?: boolean } = {};
    try {
      j = JSON.parse(text);
    } catch {}
    // The script answers {"ok":true,...}; anything else (login page, error) is a failure.
    if (!res.ok || j.ok !== true) return { ok: false, status: res.status, detail: text.slice(0, 300) || undefined };
    const bookingStatus: Status = j.status === 'Waitlist' ? 'Waitlist' : 'Confirmed';
    return { ok: true, status: res.status, bookingStatus, duplicate: !!j.duplicate, detail: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e) };
  }
}

// Confirmed bookings per Taster group, or null if the sheet cannot be read.
export async function fetchCounts(url: string, token: string): Promise<Record<string, number> | null> {
  try {
    const { res, text } = await post(url, { token, action: 'counts' });
    const j = JSON.parse(text) as { ok?: boolean; counts?: Record<string, number> };
    return res.ok && j.ok === true && j.counts && typeof j.counts === 'object' ? j.counts : null;
  } catch {
    return null;
  }
}
