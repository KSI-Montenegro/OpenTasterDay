// KSI's own photos for the Taster Morning page. Originals live in /public/img at
// full resolution; Next.js serves resized AVIF/WebP per device.
// To add a photo: put the file in /public/img, add an entry here, place it in app/page.tsx.

import type { Lang } from './content';

export type Photo = {
  src: string;
  width: number;
  height: number;
  alt: Record<Lang, string>;
  // CSS object-position, so faces stay in the crop on narrow screens.
  focus: string;
};

export const PHOTOS = {
  heroLab: {
    src: '/img/hero-lab.jpg',
    width: 2000,
    height: 1335,
    alt: {
      en: 'Two students in lab coats laughing in the science lab',
      mne: 'Dvije učenice u laboratorijskim mantilima smiju se u laboratoriji'
    },
    focus: '56% 32%'
  },
  labMicroscope: {
    src: '/img/lab-microscope.jpg',
    width: 2000,
    height: 1335,
    alt: {
      en: 'Two students at a microscope in the science lab',
      mne: 'Dvije učenice za mikroskopom u laboratoriji'
    },
    focus: '40% 45%'
  },
  classroom: {
    src: '/img/classroom.jpg',
    width: 2000,
    height: 1333,
    alt: {
      en: 'A teacher with students during a lesson',
      mne: 'Nastavnica sa učenicima na času'
    },
    focus: '45% 40%'
  },
  graduation: {
    src: '/img/graduation.jpg',
    width: 2000,
    height: 1334,
    alt: {
      en: 'Graduates throwing their caps at the graduation ceremony',
      mne: 'Maturanti bacaju kape na svečanoj dodjeli diploma'
    },
    focus: '50% 40%'
  },
  campus: {
    src: '/img/campus.webp',
    width: 2000,
    height: 1334,
    alt: {
      en: 'The KSI Montenegro school building',
      mne: 'Zgrada škole KSI Montenegro'
    },
    focus: '60% 50%'
  }
} satisfies Record<string, Photo>;

// One quality for every photo on the page.
export const PHOTO_QUALITY = 82;
