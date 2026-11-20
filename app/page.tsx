import Image from 'next/image';
import { COPY, type Copy, type Lang } from '@/lib/content';
import Interactions from '@/components/Interactions';
import { PHOTOS, PHOTO_QUALITY, type Photo } from '@/lib/photos';

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

// A photo inside a language block: lazy (the hidden language's copy never loads), alt in that language.
function Shot({ p, lang, sizes, className = '' }: { p: Photo; lang: Lang; sizes: string; className?: string }) {
  return (
    <div className={`shot ${className}`}>
      <Image src={p.src} alt={p.alt[lang]} fill sizes={sizes} quality={PHOTO_QUALITY} style={{ objectPosition: p.focus }} />
    </div>
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

function Body({ c, lang }: { c: Copy; lang: Lang }) {
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

      <figure className="photo-band pair">
        <Shot p={PHOTOS.classroom} lang={lang} sizes="(max-width: 900px) 100vw, 50vw" />
        <Shot p={PHOTOS.heroLab} lang={lang} sizes="50vw" className="desktop-only" />
      </figure>

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
              <dt>
                {p.group}
                <span className="ages">
                  {c.agesPrefix} {p.ages}
                </span>
              </dt>
              <dd>{p.count}</dd>
            </div>
          ))}
        </dl>
        <p className="prose english">
          <strong>{c.englishLabel}</strong> {c.englishBody}
        </p>
        <Cta c={c} />
      </section>

      <figure className="photo-band">
        <Shot p={PHOTOS.graduation} lang={lang} sizes="100vw" className="wide" />
      </figure>

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
        <div className="final-bg" aria-hidden="true">
          <Image src={PHOTOS.campus.src} alt="" fill sizes="100vw" quality={PHOTO_QUALITY} style={{ objectPosition: PHOTOS.campus.focus }} />
        </div>
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
            {/* Decorative: the headline next to it says what the photo shows. */}
            <Image
              src={PHOTOS.heroChild.src}
              alt=""
              fill
              priority
              quality={PHOTO_QUALITY}
              sizes="(max-width: 900px) 100vw, 56vw"
              style={{ objectPosition: PHOTOS.heroChild.focus }}
            />
          </div>
          {LANGS.map((l) => (
            <div key={l} className="hero-copy" data-l={l} lang={COPY[l].htmlLang}>
              <HeroCopy c={COPY[l]} />
            </div>
          ))}
        </section>

        {LANGS.map((l) => (
          <div key={l} data-l={l} lang={COPY[l].htmlLang}>
            <Body c={COPY[l]} lang={l} />
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
