#!/usr/bin/env node
/**
 * Align lines.json station lists with the scraped timetable indices.
 * Re-discovers station order from JR East train detail pages and rebuilds
 * each JR line's station array to match. Coordinates are looked up from
 * the existing OSM-sourced data by name matching, then snapped to the
 * OSM route geometry.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LINES_PATH = path.join(ROOT, 'src/config/lines.json');
const ROUTES_PATH = path.join(ROOT, 'src/config/routes.json');
const BASE = 'https://timetables.jreast.co.jp/en';
const DELAY_MS = 500;

const SEEDS = {
  'jr-yamanote':       '1039110',
  'jr-chuo-rapid':     '1039090',
  'jr-keihin-tohoku':  '1039140',
  'jr-saikyo':         '0866010',
  'jr-chuo-sobu':      '0866030',
};

async function fetchPage(url) {
  await new Promise(r => setTimeout(r, DELAY_MS));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TTO/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function discoverStations(seedCode) {
  const stCode = seedCode.slice(0, 4);
  const ttUrl = `${BASE}/2604/timetable/tt${stCode}/${seedCode}.html`;
  const html = await fetchPage(ttUrl);
  const trainMatch = html.match(/href="([^"]*\/train\/[^"]+)"/);
  if (!trainMatch) throw new Error('no train link');
  const trainUrl = new URL(trainMatch[1], ttUrl).href;
  const trainHtml = await fetchPage(trainUrl);

  const stations = [];
  const seen = new Set();
  const re = /list(\d{4})\.html"[^>]*>([^<]+)/g;
  let m;
  while ((m = re.exec(trainHtml)) !== null) {
    const code = m[1], name = m[2].trim();
    if (seen.has(code) || !name) continue;
    const nearby = trainHtml.slice(m.index, m.index + 200);
    if (/\d{2}:\d{2}/.test(nearby)) {
      seen.add(code);
      stations.push({ code, name });
    }
  }
  return stations;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function project(p, a, b) {
  const [ay, ax] = [a[0], a[1]], [by, bx] = [b[0], b[1]], [py, px] = [p[0], p[1]];
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return { pt: [ay, ax], d: (py - ay) ** 2 + (px - ax) ** 2 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return { pt: [ay + t * dy, ax + t * dx], d: (py - ay - t * dy) ** 2 + (px - ax - t * dx) ** 2 };
}

async function main() {
  const lines = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  const routes = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));

  for (const [lineId, seedCode] of Object.entries(SEEDS)) {
    console.log(`\n=== ${lineId} ===`);
    const lineIdx = lines.findIndex(l => l.id === lineId);
    if (lineIdx < 0) { console.log('  not in lines.json'); continue; }
    const existingLine = lines[lineIdx];
    const route = routes[lineId] || [];

    // Build name→coordinate lookup from existing OSM stations
    const coordByName = new Map();
    for (const s of existingLine.stations) {
      coordByName.set(normalize(s.name), { lat: s.lat, lng: s.lng, nameJa: s.nameJa });
      if (s.nameJa) coordByName.set(normalize(s.nameJa), { lat: s.lat, lng: s.lng, nameJa: s.nameJa });
    }

    // Discover station order from JR East
    const discovered = await discoverStations(seedCode);
    console.log(`  discovered: ${discovered.length}, existing: ${existingLine.stations.length}`);

    // Build new station array matching the scraper's order
    const suffix = lineId.replace('jr-', '');
    const newStations = [];
    let unmatched = 0;
    for (let i = 0; i < discovered.length; i++) {
      const d = discovered[i];
      const norm = normalize(d.name);

      // Try exact match, then substring match
      let match = coordByName.get(norm);
      if (!match) {
        for (const [key, val] of coordByName.entries()) {
          if (key.includes(norm) || norm.includes(key)) { match = val; break; }
        }
      }

      if (match) {
        newStations.push({
          id: norm.replace(/[^a-z0-9]+/g, '-') + '-' + suffix,
          name: d.name,
          nameJa: match.nameJa || '',
          lat: match.lat,
          lng: match.lng,
          index: i,
        });
      } else {
        unmatched++;
        console.log(`  UNMATCHED: "${d.name}" (code ${d.code})`);
      }
    }

    // Snap to route geometry
    if (route.length > 1) {
      for (const s of newStations) {
        let best = null, bd = Infinity;
        for (let i = 0; i < route.length - 1; i++) {
          const { pt, d } = project([s.lat, s.lng], route[i], route[i + 1]);
          if (d < bd) { bd = d; best = pt; }
        }
        if (best) { s.lat = +best[0].toFixed(5); s.lng = +best[1].toFixed(5); }
      }
    }

    console.log(`  result: ${newStations.length} matched (${unmatched} unmatched)`);
    if (newStations.length > 0) {
      console.log(`  first: ${newStations[0].name}, last: ${newStations[newStations.length - 1].name}`);
    }

    existingLine.stations = newStations;
  }

  fs.writeFileSync(LINES_PATH, JSON.stringify(lines, null, 2));
  console.log('\nDone. lines.json updated.');
}

main().catch(err => { console.error(err); process.exit(1); });
