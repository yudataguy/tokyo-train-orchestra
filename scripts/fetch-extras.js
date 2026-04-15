#!/usr/bin/env node
/**
 * Fetch script for 3 new rail lines:
 *   - TWR Rinkai (りんかい線) — scheduled timetable
 *   - Yokohama Municipal Blue (ブルーライン) — live via TrainDataService
 *   - Yokohama Municipal Green (グリーンライン) — live via TrainDataService
 *
 * Actions:
 *   1. Fetches station metadata + route polylines for all 3 lines.
 *   2. Fetches TrainTimetable data for TWR only (Yokohama is served live).
 *   3. Appends/updates lines.json, routes.json, timetables.json, timetables-version.json.
 *
 * Data License: ODPT Public Transportation Open Data Basic License.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const KEY = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/NEXT_PUBLIC_ODPT_API_KEY=(\S+)/) || [])[1];
if (!KEY) { console.error('NEXT_PUBLIC_ODPT_API_KEY missing'); process.exit(1); }

const LINE_DEFS = [
  {
    id: 'twr-rinkai',
    name: 'Rinkai',
    nameJa: 'りんかい線',
    color: '#222D65',
    instrument: 'xylophone',
    odptRailway: 'odpt.Railway:TWR.Rinkai',
    operator: 'odpt.Operator:TWR',
    suffix: '-twr',
    hasTimetable: true,
  },
  {
    id: 'yokohama-blue',
    name: 'Yokohama Blue',
    nameJa: 'ブルーライン',
    color: '#0070C0',
    instrument: 'saxophone',
    odptRailway: 'odpt.Railway:YokohamaMunicipal.Blue',
    operator: 'odpt.Operator:YokohamaMunicipal',
    suffix: '-yb',
    hasTimetable: false,
  },
  {
    id: 'yokohama-green',
    name: 'Yokohama Green',
    nameJa: 'グリーンライン',
    color: '#00B050',
    instrument: 'celesta',
    odptRailway: 'odpt.Railway:YokohamaMunicipal.Green',
    operator: 'odpt.Operator:YokohamaMunicipal',
    suffix: '-yg',
    hasTimetable: false,
  },
];

const CALENDARS = ['Weekday', 'SaturdayHoliday'];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function idFromUri(uri, suffix) {
  // "odpt.Station:TWR.Rinkai.Osaki" -> "osaki-twr"
  const tail = uri.split('.').pop();
  const slug = tail
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  return slug + suffix;
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

async function fetchStations(lineDef) {
  // Fetch Railway doc for station order
  const railwayData = await fetchJSON(
    `https://api.odpt.org/api/v4/odpt:Railway?owl:sameAs=${encodeURIComponent(lineDef.odptRailway)}&acl:consumerKey=${KEY}`
  );
  if (!railwayData || railwayData.length === 0) {
    throw new Error(`No Railway doc found for ${lineDef.odptRailway}`);
  }
  const railway = railwayData[0];
  console.log(`  Railway: ${railway['dc:title'] || lineDef.odptRailway}`);

  // Fetch station metadata (lat/lng, titles)
  const stationDocs = await fetchJSON(
    `https://api.odpt.org/api/v4/odpt:Station?odpt:operator=${encodeURIComponent(lineDef.operator)}&acl:consumerKey=${KEY}`
  );
  // Filter to this railway
  const stationByUri = new Map();
  for (const s of stationDocs) {
    if (s['odpt:railway'] === lineDef.odptRailway || !s['odpt:railway']) {
      stationByUri.set(s['owl:sameAs'], s);
    }
  }

  const stationOrder = railway['odpt:stationOrder'] || [];
  const stations = stationOrder
    .sort((a, b) => (a['odpt:index'] || 0) - (b['odpt:index'] || 0))
    .map((entry, i) => {
      const uri = entry['odpt:station'];
      const doc = stationByUri.get(uri);
      const title = entry['odpt:stationTitle'] || (doc && doc['odpt:stationTitle']) || {};
      return {
        id: idFromUri(uri, lineDef.suffix),
        name: title.en || uri.split('.').pop(),
        nameJa: title.ja || '',
        lat: doc?.['geo:lat'] ?? 0,
        lng: doc?.['geo:long'] ?? 0,
        index: i,
      };
    });

  console.log(`  Resolved ${stations.length} stations, first: ${stations[0].name} @ (${stations[0].lat}, ${stations[0].lng})`);
  return stations;
}

function buildRoute(stations) {
  const route = [];
  for (let i = 0; i < stations.length - 1; i++) {
    route.push(...interpolate(
      { lat: stations[i].lat, lng: stations[i].lng },
      { lat: stations[i + 1].lat, lng: stations[i + 1].lng },
      15
    ));
  }
  const last = stations[stations.length - 1];
  route.push([+last.lat.toFixed(4), +last.lng.toFixed(4)]);
  return route;
}

/** Build station lookup for timetable resolution (same pattern as fetch-timetables.js) */
function buildStationLookup(stations) {
  const byOdpt = new Map();
  for (const s of stations) {
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

function compactTimetableEntry(entry, lookup) {
  const stops = [];
  for (const s of entry['odpt:trainTimetableObject'] || []) {
    const stationUri = s['odpt:arrivalStation'] || s['odpt:departureStation'];
    const resolved = resolveStation(stationUri, lookup);
    if (!resolved) continue;
    stops.push({
      t: s['odpt:arrivalTime'] || s['odpt:departureTime'] || '',
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

async function fetchTimetable(lineDef, stations) {
  const lookup = buildStationLookup(stations);
  const result = {};
  for (const calendar of CALENDARS) {
    process.stdout.write(`  Fetching ${lineDef.id} timetable (${calendar})... `);
    const url = `https://api.odpt.org/api/v4/odpt:TrainTimetable?odpt:railway=${encodeURIComponent(lineDef.odptRailway)}&odpt:calendar=${encodeURIComponent('odpt.Calendar:' + calendar)}&acl:consumerKey=${KEY}`;
    const raw = await fetchJSON(url);
    const compacted = raw.map((e) => compactTimetableEntry(e, lookup)).filter((t) => t.stops.length > 0);
    const unresolved = raw.length - compacted.length;
    result[calendar] = compacted;
    console.log(`${compacted.length} trains (${unresolved} unresolved)`);
  }
  return result;
}

async function main() {
  const LINES_PATH = path.join(ROOT, 'src/config/lines.json');
  const ROUTES_PATH = path.join(ROOT, 'src/config/routes.json');
  const TT_PATH = path.join(ROOT, 'public/timetables.json');
  const TT_VER_PATH = path.join(ROOT, 'public/timetables-version.json');

  const linesJson = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  const routesJson = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
  const ttJson = JSON.parse(fs.readFileSync(TT_PATH, 'utf8'));

  for (const lineDef of LINE_DEFS) {
    console.log(`\nProcessing ${lineDef.id} (${lineDef.nameJa})...`);

    // 1. Fetch stations
    const stations = await fetchStations(lineDef);

    // 2. Build route polyline
    const route = buildRoute(stations);
    console.log(`  Synthesized route with ${route.length} points`);

    // 3. Update lines.json
    const lineEntry = {
      id: lineDef.id,
      name: lineDef.name,
      nameJa: lineDef.nameJa,
      color: lineDef.color,
      instrument: lineDef.instrument,
      odptRailway: lineDef.odptRailway,
      stations,
    };
    const existingIdx = linesJson.findIndex((l) => l.id === lineDef.id);
    if (existingIdx >= 0) {
      linesJson[existingIdx] = lineEntry;
      console.log(`  lines.json: updated ${lineDef.id}`);
    } else {
      linesJson.push(lineEntry);
      console.log(`  lines.json: added ${lineDef.id}`);
    }

    // 4. Update routes.json
    routesJson[lineDef.id] = route;
    console.log(`  routes.json: wrote ${route.length} points`);

    // 5. Fetch timetable for TWR only
    if (lineDef.hasTimetable) {
      const timetable = await fetchTimetable(lineDef, stations);
      ttJson.lines[lineDef.id] = timetable;
      console.log(`  timetables.json: updated ${lineDef.id}`);
    }
  }

  // Write all outputs
  fs.writeFileSync(LINES_PATH, JSON.stringify(linesJson, null, 2));
  console.log(`\nWrote ${LINES_PATH}`);

  fs.writeFileSync(ROUTES_PATH, JSON.stringify(routesJson));
  console.log(`Wrote ${ROUTES_PATH}`);

  const version = new Date().toISOString();
  ttJson.version = version;
  fs.writeFileSync(TT_PATH, JSON.stringify(ttJson));
  fs.writeFileSync(TT_VER_PATH, JSON.stringify({ version }));
  const sizeKb = (fs.statSync(TT_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${TT_PATH} (${sizeKb} KB), version=${version}`);

  // Summary
  console.log('\n--- Summary ---');
  for (const lineDef of LINE_DEFS) {
    const entry = linesJson.find((l) => l.id === lineDef.id);
    console.log(`${lineDef.id}: ${entry?.stations?.length ?? 0} stations`);
    if (lineDef.hasTimetable) {
      const tt = ttJson.lines[lineDef.id];
      const wdCount = tt?.Weekday?.length ?? 0;
      const shCount = tt?.SaturdayHoliday?.length ?? 0;
      console.log(`  timetable: Weekday=${wdCount}, SaturdayHoliday=${shCount}`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
