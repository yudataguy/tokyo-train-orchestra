/** Canonical origin. The app is one property in the japantv.app family, so
 *  it lives on a subdomain rather than its own apex; every absolute URL in
 *  metadata, the sitemap, robots.txt and JSON-LD derives from this one
 *  constant so a future move needs a single edit. */
export const SITE_URL = 'https://tokyotrainmusic.japantv.app';

export const SITE_NAME_JA = '東京電車オーケストラ';
export const SITE_NAME_EN = 'Tokyo Train Orchestra';

export const SITE_DESCRIPTION_JA =
  '東京の鉄道網が奏でる、刻々と変化するオーケストラ。東京メトロ・都営地下鉄・JR東日本など23路線がそれぞれひとつの楽器になり、実際の列車の到着が音になります。';

export const SITE_DESCRIPTION_EN =
  'A living generative orchestra driven by real Tokyo train arrivals. Each of 23 Tokyo Metro, Toei and JR East lines plays its own instrument, and every station arrival sounds a note.';
