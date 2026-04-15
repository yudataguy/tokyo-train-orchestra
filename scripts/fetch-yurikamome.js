#!/usr/bin/env node
/**
 * One-time fetcher for Yurikamome (ゆりかもめ):
 *   1. Reads station metadata from the Railway endpoint (for coordinates, order, JP names).
 *   2. Synthesizes the route polyline by interpolating between consecutive stations
 *      (Overpass has been timing out; interpolation matches the existing Toei fallback).
 *   3. Pulls the StationTimetable data and compacts it to per-station departure arrays.
 *   4. Writes:
 *        src/config/lines.json       — appends a `yurikamome` entry
 *        src/config/routes.json      — appends `yurikamome` polyline
 *        public/station-timetables.json — new file, Yurikamome-only
 *        public/station-timetables-version.json — version sidecar
 *
 * Data License: ODPT Public Transportation Open Data Basic License.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const KEY = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/NEXT_PUBLIC_ODPT_API_KEY=(\S+)/) || [])[1];
if (!KEY) { console.error('NEXT_PUBLIC_ODPT_API_KEY missing'); process.exit(1); }

const LINE = {
  id: 'yurikamome',
  name: 'Yurikamome',
  nameJa: 'ゆりかもめ',
  color: '#0065A6', // official line color from ODPT Railway metadata
  instrument: 'glockenspiel',
  odptRailway: 'odpt.Railway:Yurikamome.Yurikamome',
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function idFromUri(uri) {
  // "odpt.Station:Yurikamome.Yurikamome.Aomi" -> "aomi"
  const tail = uri.split('.').pop();
  return tail
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
}

function interpolate(a, b, steps) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    pts.push([
      +((a.lat * (1 - t) + b.lat * t).toFixed(4)),
      +((a.lng * (1 - t) + b.lng * t).toFixed(4)),
    ]);
  }
  return pts;
}

async function main() {
  // ---- 1) Stations
  const railwayData = await fetchJSON(`https://api.odpt.org/api/v4/odpt:Railway?odpt:operator=odpt.Operator:Yurikamome&acl:consumerKey=${KEY}`);
  const railway = railwayData[0];
  console.log(`Line title: ${railway['dc:title']}, color: ${railway['odpt:color']}`);

  // Look up each station's lat/lng via Station endpoint
  const stationDocs = await fetchJSON(`https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:Yurikamome&acl:consumerKey=${KEY}`);
  const stationByUri = new Map(stationDocs.map(s => [s['owl:sameAs'], s]));

  const stations = railway['odpt:stationOrder']
    .sort((a, b) => a['odpt:index'] - b['odpt:index'])
    .map((entry, i) => {
      const uri = entry['odpt:station'];
      const doc = stationByUri.get(uri);
      const title = entry['odpt:stationTitle'] || {};
      return {
        id: idFromUri(uri),
        name: title.en || uri.split('.').pop(),
        nameJa: title.ja || '',
        lat: doc?.['geo:lat'] ?? 0,
        lng: doc?.['geo:long'] ?? 0,
        index: i,
      };
    });
  console.log(`Resolved ${stations.length} stations, first: ${stations[0].name} @ (${stations[0].lat}, ${stations[0].lng})`);

  // ---- 2) Synthesize route polyline by interpolation
  const route = [];
  for (let i = 0; i < stations.length - 1; i++) {
    route.push(...interpolate({ lat: stations[i].lat, lng: stations[i].lng }, { lat: stations[i + 1].lat, lng: stations[i + 1].lng }, 15));
  }
  const last = stations[stations.length - 1];
  route.push([+last.lat.toFixed(4), +last.lng.toFixed(4)]);
  console.log(`Synthesized route with ${route.length} points`);

  // ---- 3) StationTimetable
  const stt = await fetchJSON(`https://api.odpt.org/api/v4/odpt:StationTimetable?odpt:operator=odpt.Operator:Yurikamome&acl:consumerKey=${KEY}`);
  console.log(`Got ${stt.length} station-timetable docs`);

  // Compact: byCalendar → byStationIndex → [{t, d (direction)}, ...]
  // We key by our internal station id / index so runtime doesn't need URI parsing.
  const idByUri = new Map(stations.map(s => [
    `odpt.Station:Yurikamome.Yurikamome.${railway['odpt:stationOrder'].find(e => idFromUri(e['odpt:station']) === s.id)['odpt:station'].split('.').pop()}`,
    s,
  ]));
  // Simpler: build uri → station directly
  const stationByUriDirect = new Map();
  for (const s of stations) {
    const orderEntry = railway['odpt:stationOrder'].find(e => idFromUri(e['odpt:station']) === s.id);
    if (orderEntry) stationByUriDirect.set(orderEntry['odpt:station'], s);
  }

  const compact = { Weekday: [], SaturdayHoliday: [] };
  let unresolved = 0;
  for (const doc of stt) {
    const calendar = doc['odpt:calendar'].split(':').pop(); // Weekday | SaturdayHoliday
    const station = stationByUriDirect.get(doc['odpt:station']);
    if (!station) { unresolved++; continue; }
    const direction = doc['odpt:railDirection'].split(':').pop();
    for (const obj of doc['odpt:stationTimetableObject'] || []) {
      const t = obj['odpt:departureTime'];
      if (!t) continue;
      compact[calendar]?.push({ t, s: station.index, d: direction });
    }
  }
  for (const cal of Object.keys(compact)) {
    // Sort by time for faster scanning at runtime
    compact[cal].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.s - b.s));
  }
  console.log(`Compacted: weekday=${compact.Weekday.length}, sathol=${compact.SaturdayHoliday.length}, unresolved=${unresolved}`);

  // ---- 4) Write outputs

  // lines.json: append (skip if already present)
  const LINES_PATH = path.join(ROOT, 'src/config/lines.json');
  const lines = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  const existing = lines.findIndex(l => l.id === LINE.id);
  const entry = { ...LINE, stations };
  if (existing >= 0) lines[existing] = entry;
  else lines.push(entry);
  fs.writeFileSync(LINES_PATH, JSON.stringify(lines, null, 2));
  console.log(`lines.json: ${existing >= 0 ? 'updated' : 'added'} yurikamome`);

  // routes.json: append
  const ROUTES_PATH = path.join(ROOT, 'src/config/routes.json');
  const routes = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
  routes.yurikamome = route;
  fs.writeFileSync(ROUTES_PATH, JSON.stringify(routes));
  console.log(`routes.json: wrote ${route.length} points`);

  // station-timetables.json + version sidecar
  const version = new Date().toISOString();
  const STT_PATH = path.join(ROOT, 'public/station-timetables.json');
  fs.writeFileSync(STT_PATH, JSON.stringify({ version, lines: { yurikamome: compact } }));
  const STT_VER_PATH = path.join(ROOT, 'public/station-timetables-version.json');
  fs.writeFileSync(STT_VER_PATH, JSON.stringify({ version }));
  const sizeKb = (fs.statSync(STT_PATH).size / 1024).toFixed(1);
  console.log(`station-timetables.json: ${sizeKb} KB, version=${version}`);
}

main().catch(err => { console.error(err); process.exit(1); });
