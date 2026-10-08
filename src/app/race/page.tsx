import type { Metadata } from 'next';
import RaceEntry from '../../components/race/RaceEntry';
import { SITE_NAME_EN } from '../../lib/site';

const TITLE = '電車レース / Train Race';
const DESCRIPTION =
  '曲を選び、路線を選ぶ。曲の音階が電車を走らせ、どの電車が終点に一番乗りするかを競うパーティーゲーム。'
  + ' Pick a song and a train line; the notes in the song drive the trains.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/race' },
  // Page-level openGraph replaces the layout's wholesale (no deep merge), so
  // the shared fields are restated here.
  openGraph: {
    type: 'website',
    url: '/race',
    siteName: SITE_NAME_EN,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'ja_JP',
    alternateLocale: ['en_US'],
  },
};

export default function RacePage() {
  return <RaceEntry />;
}
