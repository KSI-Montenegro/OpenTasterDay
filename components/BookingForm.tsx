'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Widget } from '@typeform/embed-react';
import type { Lang } from '@/lib/content';
import { captureAttribution, fireLead, metaIds, newEventId, type Attribution, type Consent } from '@/lib/tracking';

const FORMS: Record<Lang, string> = {
  en: process.env.NEXT_PUBLIC_TYPEFORM_EN || '',
  mne: process.env.NEXT_PUBLIC_TYPEFORM_MNE || ''
};

export default function BookingForm({ lang, consent }: { lang: Lang; consent: Consent }) {
  const [attr, setAttr] = useState<Attribution | null>(null);
  const [ids, setIds] = useState({ fbp: '', fbc: '' });
  // One event id per page view: the browser Lead and the server (CAPI) Lead share it.
  const eventId = useRef<string>('');
  if (!eventId.current) eventId.current = newEventId();

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

  const hidden = useMemo(() => {
    if (!attr) return null;
    return {
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
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : ''
    };
  }, [attr, ids, lang, consent]);

  const formId = FORMS[lang];
  if (!formId) {
    return <div className="form-missing">Typeform ID missing: NEXT_PUBLIC_TYPEFORM_{lang.toUpperCase()}</div>;
  }
  if (!hidden) return <div className="form-placeholder" />;

  return (
    <Widget
      // Remount when the language or the tracking ids change, so Typeform gets current hidden fields.
      key={`${formId}:${hidden.fbp}:${hidden.fbc}:${hidden.ad_consent}`}
      id={formId}
      hidden={hidden}
      inlineOnMobile
      className="typeform"
      style={{ width: '100%', height: '100%' }}
      onSubmit={() => fireLead(lang, eventId.current)}
    />
  );
}
