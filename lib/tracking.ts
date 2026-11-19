// Browser-side tracking: consent, attribution, and the conversion events fired
// when the Typeform is submitted. IDs come from NEXT_PUBLIC_* env vars.

import type { Lang } from './content';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { loaded?: boolean };
    ksiLoadPixel?: () => void;
  }
}

export const CONSENT_KEY = 'ksi_consent';
export type Consent = 'granted' | 'denied' | null;

export const ADS_SEND_TO = process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO || '';

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {}
  const state = choice === 'granted' ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state
  });
  if (choice === 'granted') window.ksiLoadPixel?.();
  else window.fbq?.('consent', 'revoke');
}

// --- Attribution ----------------------------------------------------------
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const;
type AttrKey = (typeof ATTR_KEYS)[number];
export type Attribution = Record<AttrKey, string>;
const ATTR_STORE = 'ksi_taster_attr';

// The ad click that brought the visitor this session. A new click (new params) replaces it.
export function captureAttribution(): Attribution {
  const empty = Object.fromEntries(ATTR_KEYS.map((k) => [k, ''])) as Attribution;
  let stored: Attribution = empty;
  try {
    stored = { ...empty, ...JSON.parse(sessionStorage.getItem(ATTR_STORE) || '{}') };
  } catch {}
  const qs = new URLSearchParams(window.location.search);
  if (ATTR_KEYS.some((k) => qs.get(k))) {
    stored = { ...empty };
    ATTR_KEYS.forEach((k) => (stored[k] = qs.get(k) || ''));
  }
  try {
    sessionStorage.setItem(ATTR_STORE, JSON.stringify(stored));
  } catch {}
  return stored;
}

function cookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

// Meta browser and click ids. Only read once the visitor allowed ad cookies.
export function metaIds(fbclid: string, consent: Consent): { fbp: string; fbc: string } {
  if (consent !== 'granted') return { fbp: '', fbc: '' };
  const fbp = cookie('_fbp');
  let fbc = cookie('_fbc');
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return { fbp, fbc };
}

export function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// --- Conversion on submit -------------------------------------------------
// Meta Lead uses the same event_id the webhook sends to the Conversions API,
// so Meta keeps one of the two. Google tags respect Consent Mode on their own.
export function fireLead(lang: Lang, eventId: string) {
  const language = lang;
  window.gtag?.('event', 'generate_lead', { language });
  if (ADS_SEND_TO) window.gtag?.('event', 'conversion', { send_to: ADS_SEND_TO });
  if (readConsent() === 'granted') window.fbq?.('track', 'Lead', { language }, { eventID: eventId });
}
