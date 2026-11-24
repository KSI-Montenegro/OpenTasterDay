import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAction, linkCode, parseLinkCode, smsText, sendingHours, type FollowupState } from '../lib/server/followup.ts';

const H = 60 * 60 * 1000;
const D = 24 * H;
// 2026-11-24 in Montenegro (UTC+1): 10:00 local = 09:00Z, 23:00 local = 22:00Z
const day10 = Date.parse('2026-11-24T09:00:00Z');
const night = Date.parse('2026-11-24T22:00:00Z');
const base: FollowupState = { start: day10, step: 0, smsStep: 0, booked: false, hasEmail: true, hasPhone: true };

test('sending hours are Montenegro time', () => {
  assert.equal(sendingHours(day10), true);
  assert.equal(sendingHours(night), false);
  assert.equal(sendingHours(Date.parse('2026-11-24T07:59:00Z')), false); // 08:59 local
  assert.equal(sendingHours(Date.parse('2026-11-24T08:00:00Z')), true); // 09:00 local
});

test('step 1: email and SMS straight away in the daytime', () => {
  assert.deepEqual(nextAction(base, day10), { step: 1, email: 1, sms: 1 });
});

test('step 1 at night: email now, SMS held until the morning', () => {
  const s = { ...base, start: night };
  assert.deepEqual(nextAction(s, night), { step: 1, email: 1 });
  const after = { ...s, step: 1 };
  assert.deepEqual(nextAction(after, night + 2 * H), {}, 'still night');
  assert.deepEqual(nextAction(after, night + 11 * H), { sms: 1 }, 'next morning 10:00');
});

test('reminders at 2 and 5 days, one step per run, daytime only', () => {
  const s1 = { ...base, step: 1, smsStep: 1 };
  assert.deepEqual(nextAction(s1, day10 + 1 * D), {});
  assert.deepEqual(nextAction(s1, day10 + 2 * D), { step: 2, email: 2, sms: 2 });
  assert.deepEqual(nextAction(s1, day10 + 2 * D + 13 * H), {}, 'night: wait');
  const s2 = { ...base, step: 2, smsStep: 2 };
  assert.deepEqual(nextAction(s2, day10 + 4 * D), {});
  assert.deepEqual(nextAction(s2, day10 + 5 * D), { step: 3, email: 3, sms: 3 });
  assert.deepEqual(nextAction({ ...base, step: 3, smsStep: 3 }, day10 + 9 * D), {}, 'done after 3');
  // A late run never skips a step: at day 6 with only step 1 done, step 2 comes first.
  assert.deepEqual(nextAction(s1, day10 + 6 * D), { step: 2, email: 2, sms: 2 });
});

test('held SMS goes out for the latest step only', () => {
  assert.deepEqual(nextAction({ ...base, step: 2, smsStep: 0 }, day10 + 3 * D), { sms: 2 });
});

test('booked, closed, or no channel: nothing', () => {
  assert.deepEqual(nextAction({ ...base, booked: true }, day10), {});
  assert.deepEqual(nextAction(base, Date.parse('2026-12-07T09:00:00Z')), {});
  assert.deepEqual(nextAction({ ...base, hasEmail: false, hasPhone: false }, day10), {});
});

test('phone only: steps advance by SMS, never at night', () => {
  const s = { ...base, hasEmail: false };
  assert.deepEqual(nextAction(s, day10), { step: 1, sms: 1 });
  assert.deepEqual(nextAction({ ...s, start: night }, night), {});
});

test('email only: no SMS', () => {
  assert.deepEqual(nextAction({ ...base, hasPhone: false }, day10), { step: 1, email: 1 });
});

test('short link codes and SMS length', () => {
  assert.equal(linkCode('sms', 2, 'mne'), 's2m');
  assert.deepEqual(parseLinkCode('e3e'), { channel: 'email', step: 3, lang: 'en' });
  assert.equal(parseLinkCode('x9z'), null);
  const link = 'https://opentasterday.vercel.app/r/s3m';
  for (const lang of ['en', 'mne'] as const)
    for (const step of [1, 2, 3]) {
      const t = smsText(lang, step, link);
      assert.ok(t.length <= 160, `${lang} ${step}: ${t.length}`);
      assert.match(t, /^[\x20-\x7e]+$/, 'plain GSM characters only');
    }
});
