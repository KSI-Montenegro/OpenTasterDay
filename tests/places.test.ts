import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPS, PLACES, capsWith, availability } from '../lib/places.ts';
import { decideStatus, templateFor } from '../lib/server/booking.ts';
import { agesForGroup, yearGroupFor } from '../lib/yearGroup.ts';

test('caps come from the places line on the page and add up to 50', () => {
  assert.equal(PLACES.length, 10);
  assert.equal(CAPS['Early Years'], 3);
  assert.equal(CAPS['Year 7/8'], 4);
  assert.equal(CAPS['Year 10'], 6);
  assert.equal(Object.values(CAPS).reduce((a, b) => a + b, 0), 50);
  // Every Taster group the date of birth can map to has a cap and an age band.
  for (const dob of ['2022-10-10', '2021-12-01', '2019-01-01', '2016-03-05', '2014-10-01', '2013-05-01', '2011-09-01']) {
    const g = yearGroupFor(dob)!.tasterGroup;
    assert.ok(g in CAPS, `${dob} -> ${g}`);
    assert.ok(agesForGroup(g));
  }
});

test('cap override for testing', () => {
  assert.equal(capsWith('{"Year 6":1}')['Year 6'], 1);
  assert.equal(capsWith('{"Year 6":1}')['Year 5'], 6);
  assert.equal(capsWith('{"Nope":1,"Year 6":-2}')['Year 6'], 6, 'bad values ignored');
  assert.equal(capsWith('not json'), CAPS);
  assert.equal(capsWith(undefined), CAPS);
});

test('availability: left never below zero, unknown counts are zero', () => {
  const a = availability({ 'Year 6': 6, 'Year 4': 6, 'Early Years': 3 }, { 'Year 6': 2, 'Early Years': 5 });
  assert.deepEqual(a['Year 6'], { cap: 6, taken: 2, left: 4 });
  assert.deepEqual(a['Year 4'], { cap: 6, taken: 0, left: 6 });
  assert.deepEqual(a['Early Years'], { cap: 3, taken: 5, left: 0 });
});

test('status: the sheet decides; without it, the page hint', () => {
  assert.equal(decideStatus({ ok: true, status: 200, bookingStatus: 'Waitlist' }, 'confirmed'), 'Waitlist');
  assert.equal(decideStatus({ ok: true, status: 200, bookingStatus: 'Confirmed' }, 'waitlist'), 'Confirmed');
  assert.equal(decideStatus({ ok: false, status: 500 }, 'waitlist'), 'Waitlist');
  assert.equal(decideStatus(null, 'confirmed'), 'Confirmed');
  assert.equal(decideStatus(null, undefined), 'Confirmed');
});

test('email template by language and status', () => {
  const env = { BREVO_TEMPLATE_EN: '23', BREVO_TEMPLATE_MNE: '24', BREVO_WAITLIST_TEMPLATE_EN: '25', BREVO_WAITLIST_TEMPLATE_MNE: '26' };
  assert.equal(templateFor('en', 'Confirmed', env), 23);
  assert.equal(templateFor('mne', 'Confirmed', env), 24);
  assert.equal(templateFor('en', 'Waitlist', env), 25);
  assert.equal(templateFor('mne', 'Waitlist', env), 26);
  assert.equal(templateFor('en', 'Waitlist', {}), 0);
});
