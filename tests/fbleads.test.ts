import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formLang, isTasterForm, mapLead, parseLeadsCsv } from '../lib/server/meta-leads.ts';
import { sendSms, sendText, whatsappRequest } from '../lib/server/messaging.ts';
import { spamReason } from '../lib/server/spam.ts';
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
    { first: 'Ana', last: 'Marija Petrović', email: 'ana@example.com', phone: '+38267123456', at: '2026-11-24T09:15:00.000Z' }
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
  const env = { SMS_ENABLED: '1', BREVO_LIST_ID: '17', BREVO_FB_TEMPLATES: '{"1en":31,"2mne":34}', SITE_URL: 'https://x.app/' };
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

test('spam check: the attached real leads pass, junk does not', () => {
  const real = [
    ['Samir', 'Z', 'samirz123456@gmail.com', '+38263434481'],
    ['Тања', 'Ш', 'tanja.s81@gmail.com', '+38268148177'],
    ['Milan', 'M', 'masanovicm9@gmail.com', '+38267347766'],
    ['Maja', 'S', 'ilicm15@yahoo.com', '+38267005877'],
    ['Tanja Preočanin Ex', 'Gaco', 'tanja9899@gmail.com', '+38268308349']
  ];
  for (const [firstName, lastName, email, phone] of real) assert.equal(spamReason({ firstName, lastName, email, phone }), null, firstName);
  const lead = (firstName: string, email = 'a@gmail.com', phone = '+38267123456', lastName = '') => ({ firstName, lastName, email, phone });
  assert.equal(spamReason(lead('Test', 'x@gmail.com', '+38267123456', 'Test')), 'test or junk name');
  assert.equal(spamReason(lead('asdf')), 'test or junk name');
  assert.equal(spamReason(lead('Ana', 'ana@mailinator.com')), 'disposable email');
  assert.equal(spamReason(lead('Ana', 'not-an-email')), 'invalid email');
  assert.equal(spamReason(lead('12345')), 'no name');
  assert.equal(spamReason(lead('Win money www.x.ru')), 'link in name');
  assert.equal(spamReason(lead('Ana', 'ana@gmail.com', '+38211111111')), 'fake phone');
  assert.equal(spamReason(lead('Ana', 'ana@gmail.com', '12')), 'invalid phone');
  assert.equal(spamReason(lead('Ana', '', '')), 'no email or phone');
});

test('WhatsApp first with SMS failover, SMS when WhatsApp is not set up', async () => {
  const env = { INFOBIP_API_KEY: 'K', INFOBIP_BASE_URL: 'x.api.infobip.com', INFOBIP_WHATSAPP_SENDER: '38267000000', INFOBIP_SENDER: 'KSI', INFOBIP_WA_TEMPLATES: '{"1mne":"taster_1_mne"}' };
  const req = whatsappRequest(env, '+382 67 123 456', 'taster_1_mne', 'sr', 'https://l/r/s1m', 'sms text');
  assert.equal(req.messages[0].channel, 'WHATSAPP');
  assert.equal(req.messages[0].destinations[0].to, '38267123456');
  assert.deepEqual(req.messages[0].content.templateData.body.placeholders, ['https://l/r/s1m']);
  assert.equal(req.messages[0].failover[0].channel, 'SMS');
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response('{"messages":[{"status":{"groupName":"PENDING"}}]}', { status: 200 });
  }) as typeof fetch;
  try {
    const wa = await sendText('+38267123456', { key: '1mne', lang: 'mne', link: 'L', smsText: 'S' }, env);
    assert.equal(wa.provider, 'whatsapp');
    const sms = await sendText('+38267123456', { key: '2mne', lang: 'mne', link: 'L', smsText: 'S' }, env); // no template for step 2
    assert.equal(sms.provider, 'infobip');
    assert.deepEqual(calls, ['https://x.api.infobip.com/messages-api/1/messages', 'https://x.api.infobip.com/sms/2/text/advanced']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('texts stay off until SMS_ENABLED=1', () => {
  const c = { id: 1, email: 'a@b.c', attributes: { FB_PHONE: '+38267123456' } };
  assert.equal(stateOf(c, {}).hasPhone, false);
  assert.equal(stateOf(c, { SMS_ENABLED: '1' }).hasPhone, true);
});

test('Meta lead CSV export', () => {
  const csv = 'id\tcreated_time\tad_name\tform_id\tform_name\tfull_name\temail\tphone_number\tdate_of_birth\n' +
    'l:111\t2026-11-23T23:43:35+01:00\t"Bulk Images EN"\tf:999\t"Pripravnici (v1)"\t"Ana Petrović"\tana@gmail.com\tp:+38263434481\t09/03/1971\n';
  const [l] = parseLeadsCsv(csv, '{"999":"mne"}');
  assert.deepEqual(
    { id: l.id, form: l.formId, lang: l.lang, first: l.firstName, last: l.lastName, email: l.email, phone: l.phone, at: new Date(l.createdAt).toISOString() },
    { id: '111', form: '999', lang: 'mne', first: 'Ana', last: 'Petrović', email: 'ana@gmail.com', phone: '+38263434481', at: '2026-11-23T22:43:35.000Z' }
  );
});
