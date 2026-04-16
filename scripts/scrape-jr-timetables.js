#!/usr/bin/env node
/**
 * Scrape JR East station timetables from the public English timetable site.
 *
 * Three phases:
 *   1. Discover station codes from a sample train detail page per line.
 *   2. For each station, fetch its list page → find the timetable link for
 *      the target line+direction+calendar.
 *   3. Fetch each timetable page → parse hour:minute departures.
 *
 * Outputs merged into public/station-timetables.json alongside Yurikamome.
 *
 * Rate-limited to ~2 req/s to be respectful.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://timetables.jreast.co.jp/en';
const DELAY_MS = 500;

const JR_LINES = [
  {
    id: 'jr-yamanote',
    lineNamePattern: /yamanote/i,
    seedStation: '1039',
    seedTimetable: { weekday: '1039110', holiday: '1039111' },
  },
  {
    id: 'jr-chuo-rapid',
    lineNamePattern: /chuo.*rapid/i,
    seedStation: '1039',
    seedTimetable: { weekday: '1039090', holiday: '1039091' },
  },
  {
    id: 'jr-keihin-tohoku',
    lineNamePattern: /keihin.*tohoku|negishi/i,
    seedStation: '1039',
    seedTimetable: { weekday: '1039140', holiday: '1039141' },
  },
  {
    id: 'jr-saikyo',
    lineNamePattern: /saikyo|kawagoe/i,
    seedStation: '0866',
    seedTimetable: { weekday: '0866010', holiday: '0866011' },
  },
  {
    id: 'jr-chuo-sobu',
    lineNamePattern: /sobu.*local|chuo.*sobu.*local/i,
    seedStation: '0866',
    seedTimetable: { weekday: '0866030', holiday: '0866031' },
  },
];

async function fetchPage(url) {
  await new Promise((r) => setTimeout(r, DELAY_MS));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TokyoTrainOrchestra/1.0 (educational project)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── Phase 1: Discover station codes from a train detail page ──
async function discoverStations(seedTimetableCode) {
  const stCode = seedTimetableCode.slice(0, 4);
  const ttUrl = `${BASE}/2604/timetable/tt${stCode}/${seedTimetableCode}.html`;
  console.log(`  fetching seed timetable: ${ttUrl}`);
  const html = await fetchPage(ttUrl);

  // Get the first train detail link (href contains "/train/")
  const trainMatch = html.match(/href="([^"]*\/train\/[^"]+)"/);
  if (!trainMatch) throw new Error('no train link found');
  const trainUrl = new URL(trainMatch[1], ttUrl).href;

  console.log(`  fetching train detail: ${trainUrl}`);
  const trainHtml = await fetchPage(trainUrl);

  // Extract stations that appear in the route table (they have departure/arrival
  // times nearby). Sidebar navigation links to "principal stations" (Yokohama,
  // Sendai, Niigata, etc.) are NOT in the route table and must be excluded.
  // Route-table rows look like: <td>...<a href="...list0108.html">Ikebukuro</a>...</td>
  // followed by <td>04:25 Dep.</td>. We look for list links that are near time patterns.
  const stations = [];
  const seen = new Set();
  const re = /href="[^"]*list(\d{4})\.html"[^>]*>([^<]+)<\/a>[^]*?(\d{2}:\d{2})/g;
  let m;
  while ((m = re.exec(trainHtml)) !== null) {
    const code = m[1];
    const name = m[2].trim();
    if (seen.has(code) || !name) continue;
    seen.add(code);
    stations.push({ code, name });
  }

  // Fallback: if regex didn't capture well, use a simpler pattern but limit
  // to the first N unique codes where a time appears within 200 chars.
  if (stations.length < 5) {
    stations.length = 0;
    seen.clear();
    const simplRe = /list(\d{4})\.html"[^>]*>([^<]+)/g;
    while ((m = simplRe.exec(trainHtml)) !== null) {
      const code = m[1];
      const name = m[2].trim();
      if (seen.has(code) || !name) continue;
      const nearbyText = trainHtml.slice(m.index, m.index + 200);
      if (/\d{2}:\d{2}/.test(nearbyText)) {
        seen.add(code);
        stations.push({ code, name });
      }
    }
  }

  console.log(`  discovered ${stations.length} stations`);
  return stations;
}

// ── Phase 2: Find timetable URLs for a line from a station's list page ──
// The HTML has table rows like:
//   <tr>
//     <th>Yamanote Line</th>
//     <td>for Ueno / Tokyo (Clockwise)</td>
//     <td class="weekday"><a href="...0108050.html">Weekdays</a></td>
//     <td class="holiday"><a href="...0108051.html">Saturdays and holidays</a></td>
//   </tr>
async function findTimetableLinks(stationCode, lineNamePattern) {
  const listUrl = `${BASE}/timetable/list${stationCode}.html`;
  const html = await fetchPage(listUrl);

  const results = [];
  // Split by <tr> and process each row that contains the target line name.
  const rows = html.split(/<tr[^>]*>/i);
  for (const row of rows) {
    if (!lineNamePattern.test(row)) continue;

    // Extract direction text from the second <td>
    const dirMatch = row.match(/<td[^>]*>(for [^<]+)<\/td>/i);
    const direction = dirMatch ? dirMatch[1].toLowerCase() : '';

    // Find all timetable links in this row
    const linkRe = /href="([^"]*?(\d{7})\.html)"/g;
    let m;
    while ((m = linkRe.exec(row)) !== null) {
      const fullHref = m[1];
      const code = m[2];
      // Calendar from last digit: 0 = weekday, 1 = holiday
      const calendar = code.endsWith('1') ? 'SaturdayHoliday' : 'Weekday';
      const url = new URL(fullHref, listUrl).href;
      results.push({ code, calendar, direction, url });
    }
  }

  return results;
}

// ── Phase 3: Parse a timetable page → departure times ──
async function parseTimetable(url) {
  const html = await fetchPage(url);
  const departures = [];

  // Pattern: <tr id="time_H"><td>H</td><td>...<span class="minute">MM</span>...
  const trRe = /<tr\s+id="time_(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const hour = parseInt(tr[1], 10);
    const block = tr[2];
    const minRe = /<span\s+class="minute">(\d+)<\/span>/g;
    let min;
    while ((min = minRe.exec(block)) !== null) {
      const minute = parseInt(min[1], 10);
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      departures.push(`${hh}:${mm}`);
    }
  }

  return departures;
}

async function processLine(line) {
  console.log(`\n=== ${line.id} ===`);

  const seedCode = line.seedTimetable.weekday;
  if (!seedCode) { console.log('  no seed — skipping'); return null; }

  // Phase 1: discover stations
  let stations;
  try {
    stations = await discoverStations(seedCode);
  } catch (err) {
    console.log(`  phase 1 failed: ${err.message}`);
    return null;
  }
  if (stations.length === 0) { console.log('  no stations'); return null; }
  console.log(`  ${stations[0].name} → ${stations[stations.length - 1].name}`);

  // Phase 2+3: scrape each station
  const lineData = { Weekday: [], SaturdayHoliday: [] };

  for (let si = 0; si < stations.length; si++) {
    const station = stations[si];
    process.stdout.write(`  [${si + 1}/${stations.length}] ${station.name}... `);

    let ttLinks;
    try {
      ttLinks = await findTimetableLinks(station.code, line.lineNamePattern);
    } catch (err) {
      console.log(`list failed: ${err.message}`);
      continue;
    }

    if (ttLinks.length === 0) { console.log('no links'); continue; }

    // Deduplicate by code (same timetable might be found multiple times)
    const seen = new Set();
    const unique = ttLinks.filter((l) => { if (seen.has(l.code)) return false; seen.add(l.code); return true; });

    let count = 0;
    for (const link of unique) {
      try {
        const deps = await parseTimetable(link.url);
        for (const t of deps) {
          // Infer direction from context: for now use the link index
          // (first pair = direction A, second pair = direction B)
          const dir = link.direction.includes('south') || link.direction.includes('clockwise')
            || link.direction.includes('chiba') || link.direction.includes('yokohama')
            ? 'Outbound' : 'Inbound';
          lineData[link.calendar].push({ t, s: si, d: dir });
        }
        count += deps.length;
      } catch {}
    }
    console.log(`${count} deps (${unique.length} pages)`);
  }

  // Sort by time
  for (const cal of ['Weekday', 'SaturdayHoliday']) {
    lineData[cal].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.s - b.s));
  }

  console.log(`  total: weekday=${lineData.Weekday.length}, holiday=${lineData.SaturdayHoliday.length}`);
  return lineData;
}

async function main() {
  const output = {};

  for (const target of JR_LINES) {
    const data = await processLine(target);
    if (data) output[target.id] = data;
  }

  if (Object.keys(output).length === 0) {
    console.log('\nNo data scraped. Exiting.');
    return;
  }

  // Merge into existing station-timetables.json
  const STT_PATH = path.join(ROOT, 'public/station-timetables.json');
  let existing = { version: new Date().toISOString(), lines: {} };
  try { existing = JSON.parse(fs.readFileSync(STT_PATH, 'utf8')); } catch {}

  for (const [id, data] of Object.entries(output)) {
    existing.lines[id] = data;
  }
  existing.version = new Date().toISOString();

  fs.writeFileSync(STT_PATH, JSON.stringify(existing));
  const sizeKb = (fs.statSync(STT_PATH).size / 1024).toFixed(1);
  console.log(`\nWrote ${STT_PATH} (${sizeKb} KB)`);

  const VER_PATH = path.join(ROOT, 'public/station-timetables-version.json');
  fs.writeFileSync(VER_PATH, JSON.stringify({ version: existing.version }));
  console.log('Done!');
}

main().catch((err) => { console.error(err); process.exit(1); });
