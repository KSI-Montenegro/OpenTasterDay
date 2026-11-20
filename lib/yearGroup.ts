// Year group placement by date of birth, as in the school's "Year Group placement" sheet
// (tests/fixtures/year-group-placement.csv).
//
// For the school year that starts in September of year A, a child born between
// 1 September S and 31 August S+1 has offset = A - S:
//   offset 4  -> Nursery    (ages 3-4)
//   offset 5  -> Reception  (ages 4-5)
//   offset 6..18 -> Year 1..13 (ages offset-1 to offset)
// Anything else is outside the school's year groups.

// The Taster Morning is on 11 December 2026, in the 2026-27 school year.
export const TASTER_SCHOOL_YEAR = 2026;

export type YearGroup = {
  code: string; // 'N' | 'R' | '1'..'13'
  label: string; // 'Nursery' | 'Reception' | 'Year 1'..'Year 13'
  ages: string; // e.g. '5-6'
  tasterGroup: string; // the Taster Morning places bucket, or OUTSIDE_TASTER
};

export const OUTSIDE_TASTER = 'Outside Taster range';

// Places on the page are counted in these buckets (Nursery + Reception share Early Years,
// Years 7 and 8 share one group, Years 11 to 13 are not part of the Taster Morning).
function tasterGroupFor(code: string): string {
  if (code === 'N' || code === 'R') return 'Early Years';
  const n = Number(code);
  if (n >= 1 && n <= 6) return `Year ${n}`;
  if (n === 7 || n === 8) return 'Year 7/8';
  if (n === 9 || n === 10) return `Year ${n}`;
  return OUTSIDE_TASTER;
}

function fromOffset(offset: number): YearGroup | null {
  if (offset < 4 || offset > 18) return null;
  const code = offset === 4 ? 'N' : offset === 5 ? 'R' : String(offset - 5);
  const label = code === 'N' ? 'Nursery' : code === 'R' ? 'Reception' : `Year ${code}`;
  return { code, label, ages: `${offset - 1}-${offset}`, tasterGroup: tasterGroupFor(code) };
}

// dob as YYYY-MM-DD. Returns null for an invalid date or a child outside Nursery to Year 13.
export function yearGroupFor(dob: string, schoolYear: number = TASTER_SCHOOL_YEAR): YearGroup | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  // Born September to December: cohort starts that year; January to August: the year before.
  const cohortStart = month >= 9 ? y : y - 1;
  return fromOffset(schoolYear - cohortStart);
}

// Age band for a Taster Morning places bucket, e.g. 'Year 7/8' -> '11-13', 'Early Years' -> '3-5'.
export function agesForGroup(group: string, schoolYear: number = TASTER_SCHOOL_YEAR): string {
  void schoolYear; // age bands are the same every year; the year only moves the birth dates
  const bands: number[][] = [];
  for (let offset = 4; offset <= 18; offset++) {
    const g = fromOffset(offset)!;
    if (g.tasterGroup === group) bands.push(g.ages.split('-').map(Number));
  }
  if (!bands.length) return '';
  const lo = Math.min(...bands.map((b) => b[0]));
  const hi = Math.max(...bands.map((b) => b[1]));
  return `${lo}-${hi}`;
}
