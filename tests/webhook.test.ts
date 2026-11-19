import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifySignature, parseSubmission, splitName } from '../lib/server/typeform.ts';
import { contactAttributes, e164 } from '../lib/server/brevo.ts';
import { buildLeadEvent } from '../lib/server/meta.ts';

const payload = {
  event_type: 'form_response',
  form_response: {
    token: 'resp123',
    submitted_at: '2026-11-20T09:00:00Z',
    hidden: { lang: 'mne', utm_source: 'facebook', utm_campaign: 'taster', fbclid: 'FB1', gclid: '', fbp: 'fb.1.1.2', fbc: 'fb.1.1.FB1', event_id: 'ev-1', ad_consent: 'granted', user_agent: 'UA' },
    answers: [
      { type: 'text', field: { ref: 'parent_name', type: 'short_text' }, text: 'Ana Marija Petrović' },
      { type: 'email', field: { ref: 'some_email_ref', type: 'email' }, email: 'Ana@Example.com' },
      { type: 'phone_number', field: { ref: 'phone', type: 'phone_number' }, phone_number: '+382 67 123 456' },
      { type: 'text', field: { ref: 'child_name', type: 'short_text' }, text: 'Luka' },
      { type: 'date', field: { ref: 'child_dob', type: 'date' }, date: '2016-03-05' }
    ]
  }
};

test('signature: valid, tampered, missing', () => {
  const raw = JSON.stringify(payload);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'sec').update(raw).digest('base64');
  assert.equal(verifySignature(raw, sig, 'sec'), true);
  assert.equal(verifySignature(raw + ' ', sig, 'sec'), false);
  assert.equal(verifySignature(raw, sig, 'other'), false);
  assert.equal(verifySignature(raw, null, 'sec'), false);
  assert.equal(verifySignature(raw, sig, ''), false);
});

test('parse answers by ref and type', () => {
  const s = parseSubmission(payload)!;
  assert.equal(s.parentName, 'Ana Marija Petrović');
  assert.equal(s.email, 'ana@example.com');
  assert.equal(s.phone, '+382 67 123 456');
  assert.equal(s.childName, 'Luka');
  assert.equal(s.childDob, '2016-03-05');
  assert.equal(s.hidden.event_id, 'ev-1');
  assert.deepEqual(splitName(s.parentName), { first: 'Ana Marija', last: 'Petrović' });
});

test('brevo attributes', () => {
  const a = contactAttributes(parseSubmission(payload)!);
  assert.equal(a.SMS, '+38267123456');
  assert.equal(a.LANGUAGE, 'MNE');
  assert.equal(a.CHILD_DOB, '2016-03-05');
  assert.equal(a.STUDENT_NAME, 'Luka');
  assert.equal(a.UTM_SOURCE, 'facebook');
  assert.equal('GCLID' in a, false, 'empty values are left out');
  assert.equal(e164('067 123 456'), '+38267123456');
  assert.equal(e164('0044 7700 900123'), '+447700900123');
  assert.equal(e164('123'), '');
});

test('meta lead event uses the browser event_id and hashes PII', () => {
  const ev = buildLeadEvent(parseSubmission(payload)!, 'https://taster.example.com');
  assert.equal(ev.event_id, 'ev-1');
  assert.equal(ev.event_name, 'Lead');
  assert.equal(ev.custom_data.language, 'mne');
  assert.equal(ev.event_source_url, 'https://taster.example.com/#mne');
  const em = crypto.createHash('sha256').update('ana@example.com').digest('hex');
  assert.deepEqual(ev.user_data.em, [em]);
  assert.equal(ev.user_data.fbp, 'fb.1.1.2');
  assert.equal(ev.user_data.client_user_agent, 'UA');
  assert.equal(JSON.stringify(ev).includes('ana@example.com'), false);
});
