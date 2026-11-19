'use client';

import { COPY, type Lang } from '@/lib/content';
import { setConsent, type Consent } from '@/lib/tracking';

export default function ConsentBanner({ lang, onChoice }: { lang: Lang; onChoice: (c: Consent) => void }) {
  const t = COPY[lang].consent;
  const choose = (c: 'granted' | 'denied') => {
    setConsent(c);
    onChoice(c);
  };
  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label={t.settings}>
      <p>{t.text}</p>
      <div className="consent-actions">
        <button type="button" className="btn btn-small" onClick={() => choose('granted')}>
          {t.accept}
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => choose('denied')}>
          {t.decline}
        </button>
      </div>
    </div>
  );
}
