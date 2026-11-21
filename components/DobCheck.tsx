'use client';

import { useState } from 'react';
import { COPY, fill, type Lang } from '@/lib/content';
import { yearGroupFor, agesForGroup, OUTSIDE_TASTER } from '@/lib/yearGroup';
import { loadAvailability } from '@/lib/availabilityClient';

export type Check = { dob: string; group: string; status: 'confirmed' | 'waitlist' };

// Step 1 of booking: the child's date of birth. Works out the Taster group and whether it has places,
// then hands over to the form (or says the child is outside the Taster Morning's year groups).
export default function DobCheck({ lang, onReady }: { lang: Lang; onReady: (c: Check) => void }) {
  const c = COPY[lang].book;
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = yearGroupFor(dob);
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setMsg({ text: c.dobMissing, kind: 'error' });
    if (!g || g.tasterGroup === OUTSIDE_TASTER) return setMsg({ text: c.outside, kind: 'info' });
    setBusy(true);
    const a = await loadAvailability();
    setBusy(false);
    const left = a?.live ? a.groups[g.tasterGroup]?.left : undefined;
    // Unknown availability (sheet unreachable): let the parent book; the server decides.
    onReady({ dob, group: g.tasterGroup, status: left === 0 ? 'waitlist' : 'confirmed' });
  };

  return (
    <form className="dob" onSubmit={submit} noValidate>
      <label htmlFor={`dob-${lang}`}>{c.dobLabel}</label>
      <div className="dob-row">
        <input
          id={`dob-${lang}`}
          type="date"
          value={dob}
          min="2008-09-01"
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setDob(e.target.value);
            setMsg(null);
          }}
          aria-describedby={msg ? `dob-msg-${lang}` : undefined}
          aria-invalid={msg?.kind === 'error' || undefined}
          required
        />
        <button type="submit" className="btn" disabled={busy}>
          {c.dobButton}
        </button>
      </div>
      {msg ? (
        <p id={`dob-msg-${lang}`} className={`dob-msg ${msg.kind}`} role="status">
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}

// The line shown above the form once the date of birth is known.
export function checkLine(lang: Lang, check: Check, left: number | undefined): string {
  const c = COPY[lang].book;
  const ages = agesForGroup(check.group);
  if (check.status === 'waitlist') return fill(c.full, { group: check.group });
  if (left === undefined) return fill(c.groupOnly, { group: check.group, ages });
  return fill(left === 1 ? c.placeLeft : c.placesLeft, { group: check.group, ages, n: left });
}
