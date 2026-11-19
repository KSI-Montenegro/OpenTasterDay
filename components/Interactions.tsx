'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { COPY, langFromHash, type Lang } from '@/lib/content';
import { readConsent, type Consent } from '@/lib/tracking';
import ConsentBanner from './ConsentBanner';

// The form (Tally iframe) is the heaviest thing on the page, so it loads only
// when the visitor nears the form or taps a booking button.
const BookingForm = dynamic(() => import('./BookingForm'), { ssr: false, loading: () => <div className="form-placeholder" /> });

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Interactions() {
  const [lang, setLang] = useState<Lang>('en');
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(true);
    bookRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

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

  // Load the form when it is about a screen away.
  useEffect(() => {
    const book = bookRef.current;
    if (!book || showForm) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShowForm(true), { rootMargin: '1200px 0px' });
    io.observe(book);
    return () => io.disconnect();
  }, [showForm]);

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
      <section id="book" ref={bookRef} className="book" aria-label={c.formLabel}>
        {ready && showForm ? <BookingForm lang={lang} consent={consent} /> : <div className="form-placeholder" />}
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
