import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifySignature, parseSubmission, splitName, isoDate } from '../lib/server/tally.ts';
import { contactAttributes, e164 } from '../lib/server/brevo.ts';
import { buildLeadEvent } from '../lib/server/meta.ts';
import { sheetRow, ageOn, localTime, SHEET_COLUMNS } from '../lib/server/sheet.ts';

const hidden = (label: string, value: string) => ({ key: `question_h_${label}`, label, type: 'HIDDEN_FIELDS', value });

// Shape of a Tally FORM_RESPONSE webhook for the MNE form.
const payload = {
  eventId: 'evt1',
  eventType: 'FORM_RESPONSE',
  createdAt: '2026-11-20T09:00:00.000Z',
  data: {
    responseId: 'resp123',
    submissionId: 'resp123',
    formId: 'db0ePA',
    formName: 'KSI Taster Morning (MNE)',
    createdAt: '2026-11-20T09:00:00.000Z',
    fields: [
      { key: 'question_a', label: 'Ime i prezime roditelja', type: 'INPUT_TEXT', value: 'Ana Marija Petrović' },
      { key: 'question_b', label: 'Email', type: 'INPUT_EMAIL', value: 'Ana@Example.com' },
      { key: 'question_c', label: 'Telefon', type: 'INPUT_PHONE_NUMBER', value: '+38267123456' },
      { key: 'question_d', label: 'Ime i prezime djeteta', type: 'INPUT_TEXT', value: 'Luka Petrović' },
      { key: 'question_e', label: 'Datum rođenja djeteta', type: 'INPUT_DATE', value: '2016-03-05' },
      { key: 'question_f', label: 'Škola koju dijete pohađa', type: 'INPUT_TEXT', value: 'OŠ Drago Milović' },
      { key: 'question_g', label: 'Razred koji dijete pohađa', type: 'INPUT_TEXT', value: 'IV razred' },
      {
        key: 'question_h',
        label: 'Nivo engleskog jezika',
        type: 'DROPDOWN',
        value: ['opt2'],
        options: [
          { id: 'opt1', text: '1 - Malo ili nimalo engleskog' },
          { id: 'opt2', text: '2 - Prati jednostavna uputstva i priča o svakodnevnim stvarima' },
          { id: 'opt3', text: '3 - Uči bez poteškoća na engleskom' }
        ]
      },
      { key: 'question_i', label: 'Maternji jezik', type: 'INPUT_TEXT', value: 'Crnogorski' },
      { key: 'question_j', label: 'Zdravstvene informacije ili alergije koje treba da znamo', type: 'TEXTAREA', value: 'Alergija na kikiriki' },
      hidden('lang', 'mne'),
      hidden('utm_source', 'facebook'),
      hidden('utm_campaign', 'taster'),
      hidden('fbclid', 'FB1'),
      hidden('gclid', ''),
      hidden('fbp', 'fb.1.1.2'),
      hidden('fbc', 'fb.1.1.FB1'),
      hidden('event_id', 'ev-1'),
      hidden('ad_consent', 'granted'),
      hidden('user_agent', 'UA')
    ]
  }
};

test('signature: valid, tampered, wrong secret, missing', () => {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', 'sec').update(raw).digest('base64');
  assert.equal(verifySignature(raw, sig, 'sec'), true);
  assert.equal(verifySignature(raw + ' ', sig, 'sec'), false);
  assert.equal(verifySignature(raw, sig, 'other'), false);
  assert.equal(verifySignature(raw, null, 'sec'), false);
  assert.equal(verifySignature(raw, sig, ''), false);
});

test('parse Tally fields by type, label and hidden fields', () => {
  const s = parseSubmission(payload)!;
  assert.equal(s.parentName, 'Ana Marija Petrović');
  assert.equal(s.email, 'ana@example.com');
  assert.equal(s.phone, '+38267123456');
  assert.equal(s.childName, 'Luka Petrović');
  assert.equal(s.childDob, '2016-03-05');
  assert.equal(s.hidden.event_id, 'ev-1');
  assert.equal(s.hidden.lang, 'mne');
  assert.equal(s.currentSchool, 'OŠ Drago Milović');
  assert.equal(s.currentGrade, 'IV razred');
  assert.equal(s.englishLevel, '2');
  assert.equal(s.motherTongue, 'Crnogorski');
  assert.equal(s.medical, 'Alergija na kikiriki');
  assert.deepEqual(splitName(s.parentName), { first: 'Ana Marija', last: 'Petrović' });
});

test('EN labels and order fallback for names', () => {
  const en = structuredClone(payload);
  en.data.fields[0].label = "Parent's first and last name";
  en.data.fields[3].label = "Child's first and last name";
  en.data.fields[5].label = "Child's current school"; // mentions the child, must not be taken as the child's name
  en.data.fields[6].label = 'Current grade level';
  en.data.fields[7].label = 'English level';
  en.data.fields[8].label = 'Mother tongue';
  en.data.fields[9].label = 'Any medical information or allergies we should know about';
  const e = parseSubmission(en)!;
  assert.equal(e.childName, 'Luka Petrović');
  assert.equal(e.parentName, 'Ana Marija Petrović');
  assert.equal(e.currentSchool, 'OŠ Drago Milović');
  assert.equal(e.currentGrade, 'IV razred');
  assert.equal(e.englishLevel, '2');
  assert.equal(e.motherTongue, 'Crnogorski');
  assert.equal(e.medical, 'Alergija na kikiriki');
  const odd = structuredClone(payload);
  odd.data.fields[0].label = 'Name';
  odd.data.fields[3].label = 'Other name';
  const s = parseSubmission(odd)!;
  assert.equal(s.parentName, 'Ana Marija Petrović');
  assert.equal(s.childName, 'Luka Petrović');
});

test('date formats', () => {
  assert.equal(isoDate('2016-03-05'), '2016-03-05');
  assert.equal(isoDate('5.3.2016'), '2016-03-05');
  assert.equal(isoDate('05/03/2016'), '2016-03-05');
  assert.equal(isoDate('nonsense'), '');
});

test('brevo attributes', () => {
  const a = contactAttributes(parseSubmission(payload)!);
  assert.equal(a.SMS, '+38267123456');
  assert.equal(a.LANGUAGE, 'MNE');
  assert.equal(a.CHILD_DOB, '2016-03-05');
  assert.equal(a.STUDENT_NAME, 'Luka Petrović');
  assert.equal(a.YEAR_GROUP, 'Year 6');
  assert.equal(a.TASTER_GROUP, 'Year 6');
  assert.equal(a.UTM_SOURCE, 'facebook');
  assert.equal(a.CURRENT_SCHOOL, 'OŠ Drago Milović');
  assert.equal(a.ENGLISH_LEVEL, '2');
  assert.equal(a.MOTHER_TONGUE, 'Crnogorski');
  assert.equal(JSON.stringify(a).includes('kikiriki'), false, 'medical info never goes to Brevo');
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

test('sheet row', () => {
  const row = sheetRow(parseSubmission(payload)!);
  assert.equal(row.length, SHEET_COLUMNS.length);
  const at = (c: (typeof SHEET_COLUMNS)[number]) => row[SHEET_COLUMNS.indexOf(c)];
  assert.equal(at('Submitted (Montenegro time)'), '2026-11-20 10:00');
  assert.equal(at('Language'), 'MNE');
  assert.equal(at('Date of birth'), '05.03.2016');
  assert.equal(at('Age on 11 Dec'), '10');
  assert.equal(at('KSI year group'), 'Year 6');
  assert.equal(at('Taster group'), 'Year 6');
  assert.equal(at('English level (parent)'), '2 - Follows simple instructions and talks about everyday things');
  assert.equal(at('Medical / allergies'), 'Alergija na kikiriki');
  assert.equal(at('Response ID'), 'resp123');
  assert.equal(ageOn('2016-12-11'), '10');
  assert.equal(ageOn('2016-12-12'), '9');
  assert.equal(localTime('2026-07-01T10:00:00Z'), '2026-07-01 12:00');
});
