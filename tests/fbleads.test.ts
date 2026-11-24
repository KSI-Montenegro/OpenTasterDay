import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formLang, isTasterForm, mapLead } from '../lib/server/meta-leads.ts';
import { sendSms } from '../lib/server/sms.ts';
import { stateOf, templateId, shortLink, isBooked } from '../lib/server/fb-followup.ts';
import { followupUrl } from '../lib/server/followup.ts';

test('Taster forms and their language', () => {
  const mne = { id: '1', name: 'Probno jutro 11.12 MNE' };
  const en = { id: '2', name: 'Taster Morning EN' };
  assert.equal(isTasterForm(mne), true);
  assert.equal(isTasterForm(en), true);
  assert.equal(isTasterForm({ id: '3', name: 'Upis 2027 MYP' }), false);
  assert.equal(isTasterForm({ id: '3', name: 'Upis 2027 MYP' }, '3,4'), true, 'explicit ids win');
  assert.equal(formLang(mne), 'mne');
  assert.equal(formLang(en), 'en');
  assert.equal(formLang({ id: '5', name: 'Taster', locale: 'en_GB' }), 'en');
  assert.equal(formLang(en, '{"2":"mne"}'), 'mne');
});

test('lead fields from Meta', () => {
  const l = mapLead(
    {
      id: 'L1',
      created_time: '2026-11-24T09:15:00+0000',
      field_data: [
        { name: 'full_name', values: ['Ana Marija Petrović'] },
        { name: 'email', values: ['Ana@Example.com '] },
        { name: 'phone_number', values: ['+38267123456'] }
      ]
    },
    { id: 'F', name: 'Probno' },
    'mne'
  );
  assert.deepEqual(
    { first: l.firstName, last: l.lastName, email: l.email, phone: l.phone, at: new Date(l.createdAt).toISOString() },
    { first: 'Ana Marija', last: 'Petrović', email: 'ana@example.com', phone: '+38267123456', at: '2026-11-24T09:15:00.000Z' }
  );
  const l2 = mapLead({ id: 'L2', created_time: 'x', field_data: [{ name: 'first_name', values: ['Ivan'] }, { name: 'last_name', values: ['K'] }] }, { id: 'F', name: 'x' }, 'en');
  assert.equal(l2.firstName, 'Ivan');
  assert.equal(l2.email, '');
});

test('SMS: Brevo first, Infobip when Brevo fails', async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes('brevo')) return new Response('{"message":"Not enough credits"}', { status: 402 });
    assert.equal((init.headers as Record<string, string>).authorization, 'App IBKEY');
    const body = JSON.parse(String(init.body));
    assert.equal(body.messages[0].destinations[0].to, '38267123456');
    return new Response('{"messages":[{"status":{"groupName":"PENDING"}}]}', { status: 200 });
  }) as typeof fetch;
  try {
    const env = { BREVO_API_KEY: 'k', BREVO_SMS_SENDER: 'KSI', INFOBIP_API_KEY: 'IBKEY', INFOBIP_BASE_URL: 'https://abc.api.infobip.com/', INFOBIP_SENDER: 'KSI' };
    const r = await sendSms('+382 67 123 456', 'hello', env);
    assert.equal(r.ok, true);
    assert.equal(r.provider, 'infobip');
    assert.deepEqual(calls, ['https://api.brevo.com/v3/transactionalSMS/sms', 'https://abc.api.infobip.com/sms/2/text/advanced']);
    const none = await sendSms('+38267123456', 'x', {});
    assert.equal(none.ok, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Brevo state: booked by status, list or flag; templates and links', () => {
  const env = { BREVO_LIST_ID: '17', BREVO_FB_TEMPLATES: '{"1en":31,"2mne":34}', SITE_URL: 'https://x.app/' };
  const c = { id: 9, email: 'a@b.c', listIds: [30], attributes: { FB_FOLLOWUP_START: '2026-11-24T09:00:00.000Z', FB_STEP: 1, FB_SMS_STEP: 0, FB_PHONE: '+38267123456' } };
  const s = stateOf(c, env);
  assert.deepEqual([s.step, s.smsStep, s.booked, s.hasEmail, s.hasPhone], [1, 0, false, true, true]);
  assert.equal(isBooked({ ...c, attributes: { ...c.attributes, STATUS: 'Waitlist' } }, env), true);
  assert.equal(isBooked({ ...c, listIds: [30, 17] }, env), true);
  assert.equal(isBooked({ ...c, attributes: { ...c.attributes, FB_BOOKED: 'yes' } }, env), true);
  assert.equal(templateId(env, 1, 'en'), 31);
  assert.equal(templateId(env, 2, 'mne'), 34);
  assert.equal(templateId(env, 3, 'en'), 0);
  assert.equal(shortLink(env, 'sms', 2, 'mne'), 'https://x.app/r/s2m');
});

test('short link target has UTMs and language', () => {
  assert.equal(
    followupUrl('https://x.app/r/s2m', 's2m'),
    'https://x.app/?utm_source=facebook&utm_medium=lead_form_followup&utm_campaign=taster_fb_followup&utm_content=sms2#mne'
  );
  assert.equal(followupUrl('https://x.app/r/zz', 'zz'), 'https://x.app/');
});
