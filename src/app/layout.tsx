import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import {
  SITE_URL,
  SITE_NAME_JA,
  SITE_NAME_EN,
  SITE_DESCRIPTION_JA,
  SITE_DESCRIPTION_EN,
} from '../lib/site';
import { INSTRUMENTS_JA } from '../lib/instruments';
import linesData from '../config/lines.json';
import type { LineConfig } from '../types';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-jp',
});

export const metadata: Metadata = {
  // Makes every relative URL below (canonical, OG image) absolute against the
  // real origin. Without it Next warns and falls back to localhost at build.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME_JA} | ${SITE_NAME_EN}`,
    template: `%s | ${SITE_NAME_EN}`,
  },
  description: SITE_DESCRIPTION_JA,
  applicationName: SITE_NAME_EN,
  keywords: [
    '東京電車オーケストラ', '東京メトロ', '都営地下鉄', 'JR東日本', '山手線',
    'generative music', 'Tokyo Metro', 'Tokyo trains', 'train music',
    'realtime music', 'ambient', 'ODPT', 'open data',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME_EN,
    title: `${SITE_NAME_JA} | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION_EN,
    locale: 'ja_JP',
    alternateLocale: ['en_US'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME_JA} | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION_EN,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

// themeColor and colorScheme belong here, not in `metadata` — they were
// deprecated out of the metadata object in Next 14. Paper, to match the app.
export const viewport: Viewport = {
  themeColor: '#EBEDE8',
  colorScheme: 'light',
};

/** Structured data. WebApplication rather than WebSite: this is a thing you
 *  use, not a page you read, and the free/no-signup price is worth stating
 *  explicitly since it is what most people want to know before clicking. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: `${SITE_NAME_JA} | ${SITE_NAME_EN}`,
  alternateName: [SITE_NAME_JA, SITE_NAME_EN],
  url: SITE_URL,
  description: SITE_DESCRIPTION_EN,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any modern web browser',
  inLanguage: ['ja', 'en'],
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
  creditText: '公共交通オープンデータセンター / ODPT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} bg-[var(--paper)] overflow-hidden font-sans`}>
        <script
          type="application/ld+json"
          // The payload is a build-time literal with no user input, but `<` is
          // escaped anyway: that is the only character that could close this
          // script tag early, and escaping it makes the injection impossible
          // rather than merely absent today.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        {/* The app is client-only (`ssr: false`), so the served HTML body is
            otherwise empty: head metadata is complete, but there is no text to
            index. Google renders JS; Bing and DuckDuckGo do so far less
            reliably. This gives every crawler the real substance, and users
            with JS never see it. */}
        <noscript>
          <h1>{SITE_NAME_JA} | {SITE_NAME_EN}</h1>
          <p>{SITE_DESCRIPTION_JA}</p>
          <p lang="en">{SITE_DESCRIPTION_EN}</p>
          <h2>路線と楽器 / Lines and instruments</h2>
          <ul>
            {(linesData as LineConfig[]).map((line) => (
              <li key={line.id}>
                {line.nameJa} ({line.name}) — {INSTRUMENTS_JA[line.instrument] ?? line.instrument}
              </li>
            ))}
          </ul>
          <p>Data: 公共交通オープンデータセンター / ODPT</p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
