// Places per Taster Morning group, from the line on the page (as supplied).
// The page and the caps both read this, so they cannot drift apart.

export const PLACES_LINE =
  'Early Years 3 | Year 1 4 | Year 2 4 | Year 3 5 | Year 4 6 | Year 5 6 | Year 6 6 | Year 7/8 4 | Year 9 6 | Year 10 6';

export const PLACES: { group: string; count: string }[] = PLACES_LINE.split(' | ').map((p) => {
  const i = p.lastIndexOf(' ');
  return { group: p.slice(0, i), count: p.slice(i + 1) };
});

export const CAPS: Record<string, number> = Object.fromEntries(PLACES.map((p) => [p.group, Number(p.count)]));

// Optional override for testing, e.g. CAP_OVERRIDE='{"Year 6":1}'. Unknown groups are ignored.
export function capsWith(override: string | undefined): Record<string, number> {
  if (!override) return CAPS;
  try {
    const o = JSON.parse(override) as Record<string, unknown>;
    const out = { ...CAPS };
    for (const [g, n] of Object.entries(o)) if (g in out && Number.isInteger(n) && (n as number) >= 0) out[g] = n as number;
    return out;
  } catch {
    return CAPS;
  }
}

export type Status = 'Confirmed' | 'Waitlist';
export type Availability = Record<string, { cap: number; taken: number; left: number }>;

export function availability(caps: Record<string, number>, taken: Record<string, number>): Availability {
  return Object.fromEntries(
    Object.entries(caps).map(([g, cap]) => {
      const t = Math.max(0, Math.floor(taken[g] || 0));
      return [g, { cap, taken: t, left: Math.max(0, cap - t) }];
    })
  );
}
