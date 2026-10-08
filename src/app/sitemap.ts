import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

// `output: export` requires metadata routes to opt into being fully static.
export const dynamic = 'force-static';

/** One entry per route. The sitemap is how the subdomain gets discovered
 *  independently of japantv.app, which has no link to it yet. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/race`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
