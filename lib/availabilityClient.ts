// Browser side: places left per group, fetched once per page view and shared.
import type { Availability } from './places';

let pending: Promise<{ live: boolean; groups: Availability } | null> | null = null;

export function loadAvailability(): Promise<{ live: boolean; groups: Availability } | null> {
  if (!pending) {
    pending = fetch('/api/availability')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (!d) pending = null; // try again next time
        return d;
      });
  }
  return pending;
}
