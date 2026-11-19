// Page copy, exactly as supplied. Do not add claims, offers or extra text here.
// Only the consent banner strings (needed for the cookie banner) were added.

export type Lang = 'en' | 'mne';

export type Copy = {
  htmlLang: string;
  headline: string;
  subhead: string;
  cta: string;
  urgency: string;
  scheduleTitle: string;
  schedule: { time: string; text: string; note?: string }[];
  meetTitle: string;
  meet: string[];
  forTitle: string;
  forBody: string;
  placesLabel: string;
  places: { group: string; count: string }[];
  englishLabel: string;
  englishBody: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalWhen: string;
  finalLimited: string;
  formLabel: string;
  consent: { text: string; accept: string; decline: string; settings: string };
};

// "Early Years 3 | Year 1 4 | ..." as written, split into group and number.
const PLACES = 'Early Years 3 | Year 1 4 | Year 2 4 | Year 3 5 | Year 4 6 | Year 5 6 | Year 6 6 | Year 7/8 4 | Year 9 6 | Year 10 6';
export const placesLine = PLACES;
const places = PLACES.split(' | ').map((p) => {
  const i = p.lastIndexOf(' ');
  return { group: p.slice(0, i), count: p.slice(i + 1) };
});

export const COPY: Record<Lang, Copy> = {
  en: {
    htmlLang: 'en',
    headline: 'Let your child try a morning at KSI Montenegro.',
    subhead:
      'Free Taster Morning on Friday 11 December. Your child joins a real IB lesson with a student buddy. You tour the school and ask our senior team anything.',
    cta: 'Book a free place',
    urgency: '50 places across all year groups. Registration closes Sunday 6 December, or sooner if places run out.',
    scheduleTitle: 'What happens on the day',
    schedule: [
      { time: '07:40', text: 'Check-in' },
      { time: '08:00', text: 'One-hour school tour with our senior team and student ambassadors' },
      {
        time: '09:00',
        text: 'Your child joins a real lesson with a student buddy. You meet our senior team in the library for a short session and open Q&A.'
      },
      {
        time: '09:50',
        text: 'Early Years and PYP families head home',
        note: 'MYP students stay for a break activity run by our student ambassadors, then two more lessons.'
      },
      { time: '11:55', text: 'MYP students finish' }
    ],
    meetTitle: 'Who you will meet',
    meet: ['Head of School', 'MYP/DP Coordinator', 'Head of Student Support', 'Admissions'],
    forTitle: 'Who it is for',
    forBody:
      "Children from Early Years to Year 10. We place each child by date of birth, with a 1 September cut-off. Enter your child's date of birth in the form and we will place them in the right year group.",
    placesLabel: 'Places by year group:',
    places,
    englishLabel: 'English:',
    englishBody:
      'Children up to Year 6 are welcome at any English level. Years 7 to 10 need basic English, enough to follow simple instructions.',
    faqTitle: 'FAQ',
    faq: [
      {
        q: 'Is this a test?',
        a: 'No. The Taster Morning is a light first look at the school. Coming to it is not an application and does not mean a place is offered.'
      },
      {
        q: "My child's English is basic. Can they still come?",
        a: 'Yes. Children up to Year 6 are welcome at any level. Years 7 to 10 need enough English to follow simple instructions.'
      },
      {
        q: 'What if we want to see more?',
        a: 'After the Taster Morning you can book a Full Trial Day. Full Trial Days are not available for Early Years.'
      },
      {
        q: 'Can my child start in January?',
        a: 'Term 2 starts on 11 January 2027. September 2027 entry is also open. You can talk through the right timing with our senior team on the day.'
      },
      {
        q: 'Does it cost anything?',
        a: 'No. The Taster Morning is free. Places go first come, first served, and registration closes on Sunday 6 December.'
      }
    ],
    finalWhen: 'Friday 11 December. KSI Montenegro, Porto Montenegro, Tivat.',
    finalLimited: 'Places are limited by year group.',
    formLabel: 'Book a free place',
    consent: {
      text: 'We use cookies to measure our ads and improve this page. You can allow or decline them.',
      accept: 'Allow',
      decline: 'Decline',
      settings: 'Cookies'
    }
  },
  mne: {
    htmlLang: 'sr-ME',
    headline: 'Neka vaše dijete proba jedno jutro u KSI Montenegro.',
    subhead:
      'Besplatno Probno jutro u petak, 11. decembra. Vaše dijete ide na pravi IB čas uz učenika pratioca. Vi obilazite školu i postavljate pitanja rukovodstvu škole.',
    cta: 'Rezervišite Vaše mjesto',
    urgency: '50 mjesta za sve uzraste. Prijave traju do nedjelje, 6. decembra, ili do popune mjesta.',
    scheduleTitle: 'Kako izgleda jutro',
    schedule: [
      { time: '07:40', text: 'Dolazak i prijava' },
      { time: '08:00', text: 'Obilazak škole sa rukovodstvom i učenicima ambasadorima, u trajanju od sat vremena' },
      {
        time: '09:00',
        text: 'Vaše dijete ide na pravi čas uz učenika pratioca. Vi se u biblioteci sastajete sa rukovodstvom škole na kratkoj prezentaciji i otvorenim pitanjima.'
      },
      {
        time: '09:50',
        text: 'Porodice djece iz Early Years i PYP programa idu kući',
        note: 'MYP učenici ostaju na pauzi sa aktivnošću koju vode učenici ambasadori, a zatim imaju još dva časa.'
      },
      { time: '11:55', text: 'MYP učenici završavaju' }
    ],
    meetTitle: 'Koga ćete upoznati',
    meet: [
      'Direktor škole (Head of School)',
      'MYP/DP koordinator',
      'Rukovodilac službe za podršku učenicima (Head of Student Support)',
      'Tim za upis (Admissions)'
    ],
    forTitle: 'Za koga je',
    forBody:
      'Za djecu od Early Years do Year 10. Djecu raspoređujemo po datumu rođenja, a granica je 1. septembar. Upišite datum rođenja djeteta u prijavu i mi ćemo ga rasporediti u odgovarajuću grupu.',
    placesLabel: 'Broj mjesta po grupi:',
    places,
    englishLabel: 'Engleski:',
    englishBody:
      'Djeca do Year 6 su dobrodošla bez obzira na nivo engleskog. Za Year 7 do Year 10 potreban je osnovni engleski, dovoljan da dijete prati jednostavna uputstva.',
    faqTitle: 'Česta pitanja',
    faq: [
      {
        q: 'Da li je ovo testiranje?',
        a: 'Ne. Probno jutro je prvo, opušteno upoznavanje sa školom. Dolazak nije prijava za upis i ne znači da je djetetu ponuđeno mjesto.'
      },
      {
        q: 'Moje dijete slabo govori engleski. Može li doći?',
        a: 'Može. Djeca do Year 6 su dobrodošla na bilo kom nivou. Za Year 7 do Year 10 dovoljno je da dijete razumije jednostavna uputstva.'
      },
      {
        q: 'Šta ako želimo da vidimo više?',
        a: 'Nakon Probnog jutra možete rezervisati cijeli probni dan (Full Trial Day). Probni dan nije dostupan za Early Years.'
      },
      {
        q: 'Može li dijete krenuti u januaru?',
        a: 'Drugi trimestar počinje 11. januara 2027. Upis za septembar 2027. je takođe otvoren. O pravom trenutku za vaše dijete možete razgovarati sa rukovodstvom škole na dan Probnog jutra.'
      },
      {
        q: 'Da li se plaća?',
        a: 'Ne. Probno jutro je besplatno. Mjesta se popunjavaju redom prijava, a prijave se zatvaraju u nedjelju, 6. decembra.'
      }
    ],
    finalWhen: 'Petak, 11. decembar. KSI Montenegro, Porto Montenegro, Tivat.',
    finalLimited: 'Broj mjesta po grupi je ograničen.',
    formLabel: 'Rezervišite Vaše mjesto',
    consent: {
      text: 'Koristimo kolačiće da mjerimo naše oglase i poboljšamo ovu stranicu. Možete ih dozvoliti ili odbiti.',
      accept: 'Dozvoli',
      decline: 'Odbij',
      settings: 'Kolačići'
    }
  }
};

export const langFromHash = (hash: string): Lang => (hash.replace('#', '').toLowerCase() === 'mne' ? 'mne' : 'en');
