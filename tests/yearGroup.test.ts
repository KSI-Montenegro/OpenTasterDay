import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yearGroupFor, agesForGroup, OUTSIDE_TASTER } from '../lib/yearGroup.ts';

// The school's placement sheet, as supplied.
const csv = readFileSync(new URL('./fixtures/year-group-placement.csv', import.meta.url), 'utf8');

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const MONTHS: Record<string, string> = { Sept: '09', Aug: '08' };
const rows = csv.trim().split(/\r?\n/).map(parseCsvLine);
const years = rows[1].slice(1).filter(Boolean).map((y) => Number(y.slice(0, 4))); // 2026, 2027, 2028, 2029

test('matches every cell of the placement sheet, at both ends of each birth range', () => {
  let checked = 0;
  for (const r of rows.slice(2)) {
    const m = /^(\w+) 1, (\d{4}) - (\w+) 31, (\d{4})$/.exec(r[0]);
    if (!m) continue;
    const first = `${m[2]}-${MONTHS[m[1]]}-01`;
    const last = `${m[4]}-${MONTHS[m[3]]}-31`;
    years.forEach((year, i) => {
      const ages = r[1 + i * 2];
      const label = r[2 + i * 2];
      for (const dob of [first, last]) {
        const g = yearGroupFor(dob, year);
        if (!label) {
          assert.equal(g, null, `${dob} in ${year}: expected no year group`);
        } else {
          assert.ok(g, `${dob} in ${year}: expected ${label}`);
          assert.equal(g.label, label, `${dob} in ${year}`);
          assert.equal(g.ages, ages, `${dob} in ${year} ages`);
        }
        checked++;
      }
    });
  }
  assert.ok(checked >= 140, `checked ${checked} cells`);
});

test('Taster Morning buckets for 2026-27', () => {
  assert.equal(yearGroupFor('2022-10-10')!.tasterGroup, 'Early Years'); // Nursery
  assert.equal(yearGroupFor('2021-12-01')!.tasterGroup, 'Early Years'); // Reception
  assert.equal(yearGroupFor('2016-03-05')!.label, 'Year 6');
  assert.equal(yearGroupFor('2016-03-05')!.tasterGroup, 'Year 6');
  assert.equal(yearGroupFor('2014-10-01')!.label, 'Year 7');
  assert.equal(yearGroupFor('2014-10-01')!.tasterGroup, 'Year 7/8');
  assert.equal(yearGroupFor('2014-01-01')!.label, 'Year 8');
  assert.equal(yearGroupFor('2014-01-01')!.tasterGroup, 'Year 7/8');
  assert.equal(yearGroupFor('2013-05-01')!.label, 'Year 9');
  assert.equal(yearGroupFor('2011-09-01')!.tasterGroup, 'Year 10');
  assert.equal(yearGroupFor('2010-09-01')!.tasterGroup, OUTSIDE_TASTER); // Year 11
  assert.equal(yearGroupFor('2023-01-01')!.label, 'Nursery'); // Sept 2022 to Aug 2023 row
  assert.equal(yearGroupFor('2024-01-01'), null); // too young for 2026-27
  assert.equal(yearGroupFor('not a date'), null);
});

test('age bands shown on the page', () => {
  const expected: Record<string, string> = {
    'Early Years': '3-5', 'Year 1': '5-6', 'Year 2': '6-7', 'Year 3': '7-8', 'Year 4': '8-9',
    'Year 5': '9-10', 'Year 6': '10-11', 'Year 7/8': '11-13', 'Year 9': '13-14', 'Year 10': '14-15'
  };
  for (const [group, ages] of Object.entries(expected)) assert.equal(agesForGroup(group), ages, group);
});
