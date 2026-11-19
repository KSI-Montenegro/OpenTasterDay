import Image from 'next/image';
import { COPY, type Copy, type Lang } from '@/lib/content';
import Interactions from '@/components/Interactions';

// The page is static HTML with both languages in it. An inline script in the
// layout sets <html data-lang> from the hash before first paint, and CSS shows
// only that language, so there is no flash and almost no JavaScript for the copy.
// Interactions (a small client island) handles the switcher, buttons and the form.

function Cta({ c, className = '' }: { c: Copy; className?: string }) {
  return (
    <button type="button" className={`btn ${className}`} data-cta>
      {c.cta}
    </button>
  );
}

function HeroCopy({ c }: { c: Copy }) {
  return (
    <>
      <h1>{c.headline}</h1>
      <p className="sub">{c.subhead}</p>
      <Cta c={c} className="hero-cta" />
      <p className="urgency">{c.urgency}</p>
    </>
  );
}

function Body({ c }: { c: Copy }) {
  return (
    <>
      <section className="section schedule" aria-labelledby={`schedule-${c.htmlLang}`}>
        <h2 id={`schedule-${c.htmlLang}`}>{c.scheduleTitle}</h2>
        <ol className="timeline">
          {c.schedule.map((s) => (
            <li key={s.time}>
              <time className="time">{s.time}</time>
              <div className="what">
                <p>{s.text}</p>
                {s.note ? <p className="note">{s.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="band" aria-labelledby={`meet-${c.htmlLang}`}>
        <div className="section">
          <h2 id={`meet-${c.htmlLang}`}>{c.meetTitle}</h2>
          <ul className="meet">
            {c.meet.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby={`for-${c.htmlLang}`}>
        <h2 id={`for-${c.htmlLang}`}>{c.forTitle}</h2>
        <p className="prose">{c.forBody}</p>
        <h3 className="places-label">{c.placesLabel}</h3>
        <dl className="places">
          {c.places.map((p) => (
            <div key={p.group}>
              <dt>{p.group}</dt>
              <dd>{p.count}</dd>
            </div>
          ))}
        </dl>
        <p className="prose english">
          <strong>{c.englishLabel}</strong> {c.englishBody}
        </p>
        <Cta c={c} />
      </section>

      <section className="band" aria-labelledby={`faq-${c.htmlLang}`}>
        <div className="section">
          <h2 id={`faq-${c.htmlLang}`}>{c.faqTitle}</h2>
          <div className="faq">
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final">
        <p className="when">{c.finalWhen}</p>
        <p>{c.finalLimited}</p>
        <Cta c={c} className="btn-light" />
      </section>
    </>
  );
}

const LANGS: Lang[] = ['en', 'mne'];

export default function Page() {
  return (
    <>
      <header className="topbar">
        <Image src="/img/ksi-logo.png" alt="KSI Montenegro" width={84} height={57} priority className="logo" />
        <nav className="lang" aria-label="Language">
          <button type="button" data-lang-to="en" lang="en">
            EN
          </button>
          <span aria-hidden="true">|</span>
          <button type="button" data-lang-to="mne" lang="sr-ME">
            MNE
          </button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-img">
            <Image src="/img/hero.jpg" alt="" fill priority quality={70} sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
          {LANGS.map((l) => (
            <div key={l} className="hero-copy" data-l={l} lang={COPY[l].htmlLang}>
              <HeroCopy c={COPY[l]} />
            </div>
          ))}
        </section>

        {LANGS.map((l) => (
          <div key={l} data-l={l} lang={COPY[l].htmlLang}>
            <Body c={COPY[l]} />
          </div>
        ))}

        <Interactions />
      </main>

      <footer className="foot">
        <Image src="/img/ksi-logo.png" alt="KSI Montenegro" width={96} height={65} />
        {LANGS.map((l) => (
          <button key={l} type="button" className="link" data-l={l} data-consent-open>
            {COPY[l].consent.settings}
          </button>
        ))}
      </footer>
    </>
  );
}
