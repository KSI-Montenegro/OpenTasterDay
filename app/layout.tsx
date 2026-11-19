import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { PT_Serif, Poppins } from 'next/font/google';
import './globals.css';

const serif = PT_Serif({ subsets: ['latin', 'latin-ext'], weight: ['700'], variable: '--font-serif', display: 'swap' });
const sans = Poppins({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-sans', display: 'swap' });

const GA4 = process.env.NEXT_PUBLIC_GA4_ID || '';
const ADS = (process.env.NEXT_PUBLIC_GOOGLE_ADS_SEND_TO || '').split('/')[0];
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const GTAG_ID = GA4 || ADS;

export const metadata: Metadata = {
  title: 'KSI Montenegro',
  description: 'Let your child try a morning at KSI Montenegro.',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#262453'
};

// Runs before anything else: Consent Mode v2 defaults (everything denied until
// the visitor chooses), the previous choice if there is one, the Google tag
// config, and a loader for the Meta Pixel that only runs after consent.
const bootstrap = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', wait_for_update: 500
});
gtag('set', 'url_passthrough', true);
gtag('set', 'ads_data_redaction', true);
var ksiGranted = false;
try { ksiGranted = localStorage.getItem('ksi_consent') === 'granted'; } catch (e) {}
if (ksiGranted) {
  gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });
}
gtag('js', new Date());
${GA4 ? `gtag('config', '${GA4}');` : ''}
${ADS ? `gtag('config', '${ADS}');` : ''}
window.ksiLoadPixel = function () {
  ${PIXEL ? `
  if (window.fbq && window.fbq.loaded) { window.fbq('consent', 'grant'); return; }
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('consent', 'grant');
  fbq('init', '${PIXEL}');
  fbq('track', 'PageView');` : ''}
};
if (ksiGranted) window.ksiLoadPixel();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
        {/* Language from the hash before first paint, so #mne visitors never see English. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=(location.hash||'').toLowerCase()==='#mne',d=document.documentElement;d.setAttribute('data-lang',m?'mne':'en');if(m)d.lang='sr-ME';})();`
          }}
        />
      </head>
      <body>
        {children}
        {/* Google's tag loads after the page; gtag() calls made earlier wait in dataLayer and are sent then. */}
        {GTAG_ID ? <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="lazyOnload" /> : null}
      </body>
    </html>
  );
}
