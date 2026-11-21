import type { Status } from '../places.ts';
import type { SheetResult } from './sheet.ts';

// Confirmed or Waitlist. The sheet decides (it counts under a lock); if it could not be reached,
// fall back to what the page saw when the parent entered the date of birth, never blocking the email.
export function decideStatus(sheet: SheetResult | null, pageHint: string | undefined): Status {
  if (sheet?.ok && sheet.bookingStatus) return sheet.bookingStatus;
  return pageHint === 'waitlist' ? 'Waitlist' : 'Confirmed';
}

// Brevo template for the parent's email: the confirmation, or the waitlist message.
export function templateFor(lang: 'en' | 'mne', status: Status, env: Record<string, string | undefined>): number {
  const key =
    status === 'Waitlist'
      ? lang === 'mne' ? 'BREVO_WAITLIST_TEMPLATE_MNE' : 'BREVO_WAITLIST_TEMPLATE_EN'
      : lang === 'mne' ? 'BREVO_TEMPLATE_MNE' : 'BREVO_TEMPLATE_EN';
  return parseInt(env[key] || '', 10) || 0;
}
