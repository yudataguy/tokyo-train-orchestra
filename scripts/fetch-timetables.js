#!/usr/bin/env node
/**
 * Fetch Tokyo Metro train timetables from ODPT and write src/config/timetables.json.
 * One-time / periodic run; the output is bundled into the app.
 *
 * Data License: Public Transportation Open Data Basic License (ODPT).
 * Attribution: 公共交通オープンデータセンター / ODPT.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENV = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const KEY = (ENV.match(/NEXT_PUBLIC_ODPT_API_KEY=(\S+)/) || [])[1];
if (!KEY) {
  console.error('NEXT_PUBLIC_ODPT_API_KEY not found in .env.local');
  process.exit(1);
}

const LINES_PATH = path.join(ROOT, 'src/config/lines.json');
const OUT_PATH = path.join(ROOT, 'public/timetables.json');

const lines = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
// Only Metro lines need timetable bundling. Toei is covered by live odpt:Train.
const metroLines = lines.filter((l) => l.odptRailway.startsWith('odpt.Railway:TokyoMetro.'));

const CALENDARS = ['Weekday', 'SaturdayHoliday'];

/** Build station-id lookup for a line to resolve ODPT station URIs → our id+index. */
function buildStationLookup(line) {
  const byOdpt = new Map();
  for (const s of line.stations) {
    // ODPT station URIs look like odpt.Station:TokyoMetro.Ginza.Shibuya
    // Match against the trailing segment (case-insensitive, stripping punctuation)
    const norm = s.name.toLowerCase().replace(/[^a-z]/g, '');
    byOdpt.set(norm, { id: s.id, index: s.index });
  }
  return byOdpt;
}

function resolveStation(odptStationUri, lookup) {
  const tail = (odptStationUri || '').split('.').pop() || '';
  const norm = tail.toLowerCase().replace(/[^a-z]/g, '');
  return lookup.get(norm) || null;
}

async function fetchOne(line, calendar) {
  const url = `https://api.odpt.org/api/v4/odpt:TrainTimetable?odpt:railway=${encodeURIComponent(line.odptRailway)}&odpt:calendar=${encodeURIComponent('odpt.Calendar:' + calendar)}&acl:consumerKey=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${line.id}/${calendar} HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  const data = await res.json();
  return data;
}

/** Strip a raw timetable entry down to the fields we use at runtime. */
function compact(entry, lookup) {
  const stops = [];
  for (const s of entry['odpt:trainTimetableObject'] || []) {
    const stationUri = s['odpt:arrivalStation'] || s['odpt:departureStation'];
    const resolved = resolveStation(stationUri, lookup);
    if (!resolved) continue;
    stops.push({
      t: s['odpt:arrivalTime'] || s['odpt:departureTime'] || '',
      // 'a' means this stop has an arrival (intermediate/terminus). Only these fire notes.
      a: Boolean(s['odpt:arrivalTime']),
      s: resolved.index,
    });
  }
  return {
    n: entry['odpt:trainNumber'] || '',
    d: (entry['odpt:railDirection'] || '').split(':').pop() || '',
    stops,
  };
}

async function main() {
  const out = {};
  for (const line of metroLines) {
    const lookup = buildStationLookup(line);
    out[line.id] = {};
    for (const calendar of CALENDARS) {
      process.stdout.write(`Fetching ${line.id} ${calendar}... `);
      const raw = await fetchOne(line, calendar);
      const compacted = raw.map((e) => compact(e, lookup)).filter((t) => t.stops.length > 0);
      const unresolved = raw.length - compacted.length;
      out[line.id][calendar] = compacted;
      console.log(`${compacted.length} trains (${unresolved} unresolved)`);
    }
  }

  const version = new Date().toISOString();
  const payload = { version, lines: out };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
  // Sidecar: tiny file clients fetch first to decide whether their cache is stale.
  const VERSION_PATH = path.join(path.dirname(OUT_PATH), 'timetables-version.json');
  fs.writeFileSync(VERSION_PATH, JSON.stringify({ version }));
  const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  const totalTrains = Object.values(out).reduce(
    (sum, byCal) => sum + Object.values(byCal).reduce((s, arr) => s + arr.length, 0),
    0,
  );
  console.log(`\nWrote ${OUT_PATH} (${sizeKb} KB, ${totalTrains} total train runs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
