'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COPY, type Lang } from '@/lib/content';
import { captureAttribution, fireLead, metaIds, newEventId, type Attribution, type Consent } from '@/lib/tracking';

const FORMS: Record<Lang, string> = {
  en: process.env.NEXT_PUBLIC_TALLY_EN || '',
  mne: process.env.NEXT_PUBLIC_TALLY_MNE || ''
};

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

const EMBED_JS = 'https://tally.so/widgets/embed.js';

// Tally's embed script resizes the iframe to the form's height. Loaded once, only with the form.
function loadEmbedScript(): Promise<void> {
  if (window.Tally) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${EMBED_JS}"]`);
  return new Promise((resolve, reject) => {
    const s = existing || document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Tally embed script failed')));
    if (!existing) {
      s.src = EMBED_JS;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

export default function BookingForm({ lang, consent }: { lang: Lang; consent: Consent }) {
  const [attr, setAttr] = useState<Attribution | null>(null);
  const [ids, setIds] = useState({ fbp: '', fbc: '' });
  const frame = useRef<HTMLIFrameElement>(null);
  // One event id per page view: the browser Lead and the server (CAPI) Lead share it.
  const eventId = useRef<string>('');
  if (!eventId.current) eventId.current = newEventId();
  const leadSent = useRef(false);

  useEffect(() => {
    setAttr(captureAttribution());
  }, []);

  // _fbp appears a moment after the Pixel loads, so wait for it once consent is given.
  useEffect(() => {
    if (!attr) return;
    let tries = 0;
    const read = () => {
      const next = metaIds(attr.fbclid, consent);
      setIds((prev) => (prev.fbp === next.fbp && prev.fbc === next.fbc ? prev : next));
      if (consent === 'granted' && !next.fbp && tries++ < 8) timer = window.setTimeout(read, 500);
    };
    let timer = window.setTimeout(read, 0);
    return () => window.clearTimeout(timer);
  }, [attr, consent]);

  const formId = FORMS[lang];

  // Tally passes hidden fields as query parameters with the same names.
  const src = useMemo(() => {
    if (!attr || !formId) return '';
    const p = new URLSearchParams({
      alignLeft: '1',
      hideTitle: '1',
      transparentBackground: '1',
      dynamicHeight: '1',
      lang,
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
      utm_content: attr.utm_content,
      utm_term: attr.utm_term,
      fbclid: attr.fbclid,
      gclid: attr.gclid,
      fbp: ids.fbp,
      fbc: ids.fbc,
      event_id: eventId.current,
      // Needed by the server-side Meta event: consent choice and browser user agent.
      ad_consent: consent === 'granted' ? 'granted' : 'denied',
      user_agent: navigator.userAgent.slice(0, 250)
    });
    return `https://tally.so/embed/${formId}?${p.toString()}`;
  }, [attr, ids, lang, consent, formId]);

  // Hand the iframe to Tally's script for auto height; without the script it still works at a fixed height.
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    loadEmbedScript()
      .then(() => !cancelled && window.Tally?.loadEmbeds())
      .catch(() => {
        if (!cancelled && frame.current && !frame.current.src) frame.current.src = src;
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Tally tells the page when the form is submitted: fire the browser conversions once.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://tally.so' || typeof e.data !== 'string' || !e.data.includes('Tally.FormSubmitted')) return;
      let msg: { event?: string; payload?: { formId?: string } } = {};
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.event !== 'Tally.FormSubmitted' || (msg.payload?.formId && msg.payload.formId !== formId) || leadSent.current) return;
      leadSent.current = true;
      fireLead(lang, eventId.current);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lang, formId]);

  if (!formId) {
    return <div className="form-missing">Tally form ID missing: NEXT_PUBLIC_TALLY_{lang.toUpperCase()}</div>;
  }
  if (!src) return <div className="form-placeholder" />;

  return (
    <iframe
      // Remount when the language or tracking ids change, so Tally gets current hidden fields.
      key={src}
      ref={frame}
      data-tally-src={src}
      className="tally"
      title={COPY[lang].formLabel}
      loading="eager"
      width="100%"
      height="560"
      frameBorder={0}
      marginHeight={0}
      marginWidth={0}
    />
  );
}
