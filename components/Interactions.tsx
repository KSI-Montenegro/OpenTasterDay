'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { COPY, fill, langFromHash, type Lang } from '@/lib/content';
import { loadAvailability } from '@/lib/availabilityClient';
import DobCheck, { checkLine, type Check } from './DobCheck';
import { readConsent, type Consent } from '@/lib/tracking';
import ConsentBanner from './ConsentBanner';

// Booking is two steps: the child's date of birth (checks places for that group), then the form.
// The form (Tally iframe) is the heaviest thing on the page, so it loads only after step one.
const BookingForm = dynamic(() => import('./BookingForm'), { ssr: false, loading: () => <div className="form-placeholder" /> });

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Interactions() {
  const [lang, setLang] = useState<Lang>('en');
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [left, setLeft] = useState<number | undefined>(undefined);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [sticky, setSticky] = useState(false);
  const bookRef = useRef<HTMLElement>(null);

  // Language from the hash (#en / #mne). No hash means #en.
  useEffect(() => {
    const apply = () => {
      if (!/^#(en|mne)$/i.test(window.location.hash)) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#en`);
      }
      const l = langFromHash(window.location.hash);
      setLang(l);
      const root = document.documentElement;
      root.lang = COPY[l].htmlLang;
      root.setAttribute('data-lang', l);
      document.querySelectorAll<HTMLButtonElement>('[data-lang-to]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.langTo === l));
      });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  useEffect(() => {
    const c = readConsent();
    setConsent(c);
    setShowBanner(c === null);
    setReady(true);
  }, []);

  const goToForm = useCallback(() => {
    void loadAvailability(); // warm it up while the parent types the date
    bookRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => bookRef.current?.querySelector<HTMLInputElement>('.dob input')?.focus({ preventScroll: true }), 450);
  }, []);

  // Places left next to each group in the "Places by year group" table, once the page has settled.
  useEffect(() => {
    const t = window.setTimeout(async () => {
      const a = await loadAvailability();
      if (!a?.live) return;
      document.querySelectorAll<HTMLElement>('[data-left-group]').forEach((el) => {
        const g = a.groups[el.dataset.leftGroup || ''];
        const l = (el.closest('[data-l]') as HTMLElement | null)?.dataset.l === 'mne' ? 'mne' : 'en';
        if (!g) return;
        el.textContent = g.left === 0 ? COPY[l].book.badgeFull : fill(COPY[l].book.badgeLeft, { n: g.left });
        el.classList.toggle('full', g.left === 0);
        el.hidden = false;
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const onReady = useCallback(async (c: Check) => {
    setCheck(c);
    setWaitlistDone(false);
    const a = await loadAvailability();
    setLeft(a?.live ? a.groups[c.group]?.left : undefined);
  }, []);
  const onSubmitted = useCallback(() => {
    if (check?.status === 'waitlist') setWaitlistDone(true);
  }, [check]);

  // One listener for every server-rendered button.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cta],[data-lang-to],[data-consent-open]');
      if (!el) return;
      if (el.dataset.langTo) window.location.hash = el.dataset.langTo; // no reload
      else if (el.hasAttribute('data-consent-open')) setShowBanner(true);
      else goToForm();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [goToForm]);

  // Mobile booking bar: after the hero, hidden while the form is on screen.
  useEffect(() => {
    const hero = document.querySelector('.hero');
    const book = bookRef.current;
    if (!hero || !book) return;
    let pastHero = false;
    let atForm = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === book) atForm = e.isIntersecting;
      });
      setSticky(pastHero && !atForm);
    });
    io.observe(hero);
    io.observe(book);
    return () => io.disconnect();
  }, []);

  const c = COPY[lang];

  return (
    <>
      <section id="book" ref={bookRef} className={`book${check ? '' : ' step-dob'}`} aria-label={c.formLabel}>
        {!check ? (
          <DobCheck key={lang} lang={lang} onReady={onReady} />
        ) : (
          <>
            <div className={`check-line${check.status === 'waitlist' ? ' waitlist' : ''}`} role="status">
              <p>{checkLine(lang, check, left)}</p>
              <button type="button" className="link" onClick={() => setCheck(null)}>
                {c.book.change}
              </button>
            </div>
            {waitlistDone ? (
              <p className="waitlist-done">{c.book.waitlistThanks}</p>
            ) : ready ? (
              <BookingForm lang={lang} consent={consent} childDob={check.dob} status={check.status} onSubmitted={onSubmitted} />
            ) : (
              <div className="form-placeholder" />
            )}
          </>
        )}
      </section>

      <div className={`sticky${sticky ? ' on' : ''}`} aria-hidden={!sticky}>
        <button type="button" className="btn" onClick={goToForm} tabIndex={sticky ? 0 : -1}>
          {c.cta}
        </button>
      </div>

      {showBanner ? (
        <ConsentBanner
          lang={lang}
          onChoice={(choice) => {
            setConsent(choice);
            setShowBanner(false);
          }}
        />
      ) : null}
    </>
  );
}
