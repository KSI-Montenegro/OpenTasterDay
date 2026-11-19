'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { COPY, langFromHash, type Lang } from '@/lib/content';
import { readConsent, type Consent } from '@/lib/tracking';
import BookingForm from './BookingForm';
import ConsentBanner from './ConsentBanner';

const scrollToForm = () => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Landing() {
  const [lang, setLang] = useState<Lang>('en');
  const [consent, setConsentState] = useState<Consent>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Language follows the URL hash (#en / #mne). No hash means #en.
  useEffect(() => {
    const apply = () => {
      if (!/^#(en|mne)$/i.test(window.location.hash)) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#en`);
      }
      const l = langFromHash(window.location.hash);
      setLang(l);
      document.documentElement.lang = COPY[l].htmlLang;
      document.documentElement.setAttribute('data-lang', l);
      document.documentElement.setAttribute('data-ready', '');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  useEffect(() => {
    setConsentState(readConsent());
    setConsentLoaded(true);
  }, []);

  // Sticky booking bar on mobile once the hero button has scrolled away, hidden at the form.
  useEffect(() => {
    const hero = document.getElementById('hero-cta');
    const form = document.getElementById('book');
    if (!hero || !form) return;
    let heroGone = false;
    let formVisible = false;
    const update = () => setShowSticky(heroGone && !formVisible);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === form) formVisible = e.isIntersecting;
      });
      update();
    });
    io.observe(hero);
    io.observe(form);
    return () => io.disconnect();
  }, []);

  const switchTo = useCallback((l: Lang) => {
    // Updates the hash (the ads link to #en / #mne) without reloading.
    window.location.hash = l;
  }, []);

  const c = COPY[lang];

  const Cta = ({ id, className = '' }: { id?: string; className?: string }) => (
    <button type="button" id={id} className={`btn ${className}`} onClick={scrollToForm}>
      {c.cta}
    </button>
  );

  return (
    <>
      <header className="topbar">
        <Image src="/img/ksi-logo.png" alt="KSI Montenegro" width={84} height={57} priority className="logo" />
        <nav className="lang" aria-label="Language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => switchTo('en')}>
            EN
          </button>
          <span aria-hidden="true">|</span>
          <button type="button" aria-pressed={lang === 'mne'} onClick={() => switchTo('mne')}>
            MNE
          </button>
        </nav>
      </header>

      <main className="page" lang={c.htmlLang}>
        <section className="hero">
          <div className="hero-img">
            <Image src="/img/hero.jpg" alt="" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
          <div className="hero-copy">
            <h1>{c.headline}</h1>
            <p className="sub">{c.subhead}</p>
            <Cta id="hero-cta" />
            <p className="urgency">{c.urgency}</p>
          </div>
        </section>

        <section className="section">
          <h2>{c.scheduleTitle}</h2>
          <ol className="timeline">
            {c.schedule.map((s, i) => (
              <li key={i} className={s.time ? '' : 'no-time'}>
                {s.time ? <span className="time">{s.time}</span> : <span className="time" aria-hidden="true" />}
                <span className="what">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="section alt">
          <h2>{c.meetTitle}</h2>
          <ul className="meet">
            {c.meet.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>{c.forTitle}</h2>
          <p>{c.forBody}</p>
          <h3 className="places-label">{c.placesLabel}</h3>
          <ul className="places">
            {c.places.map((p) => (
              <li key={p.group}>
                <span className="group">{p.group}</span>
                <span className="count">{p.count}</span>
              </li>
            ))}
          </ul>
          <p className="english">
            <strong>{c.englishLabel}</strong> {c.englishBody}
          </p>
          <Cta className="btn-block" />
        </section>

        <section className="section alt">
          <h2>{c.faqTitle}</h2>
          <div className="faq">
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final">
          <p className="when">{c.finalWhen}</p>
          <p>{c.finalLimited}</p>
          <Cta className="btn-light" />
        </section>

        <section id="book" className="book" aria-label={c.formLabel}>
          {consentLoaded ? <BookingForm lang={lang} consent={consent} /> : <div className="form-placeholder" />}
        </section>

        <footer className="foot">
          <Image src="/img/ksi-logo.png" alt="KSI Montenegro" width={96} height={65} />
          <button type="button" className="link" onClick={() => setConsentState(null)}>
            {c.consent.settings}
          </button>
        </footer>
      </main>

      <div className={`sticky ${showSticky ? 'on' : ''}`} aria-hidden={!showSticky}>
        <button type="button" className="btn" onClick={scrollToForm} tabIndex={showSticky ? 0 : -1}>
          {c.cta}
        </button>
      </div>

      {consentLoaded && consent === null ? <ConsentBanner lang={lang} onChoice={setConsentState} /> : null}
    </>
  );
}
