#!/usr/bin/env node
/**
 * Fetch script for 3 new rail lines with REAL OSM route geometry:
 *   - Tama Monorail (多摩都市モノレール) — celesta instrument
 *   - Marunouchi Branch (丸ノ内線支線) — piano instrument, dashed on map
 *   - MIR Tsukuba Express (つくばエクスプレス) — kalimba instrument
 *
 * Actions:
 *   1. Fetches Railway metadata + stations from ODPT API.
 *   2. Fetches REAL route geometry from Overpass API (NOT interpolation).
 *      If Overpass fails for any line, the script STOPS and reports failure.
 *   3. Snaps station coords onto the nearest route segment.
 *   4. Fetches TrainTimetable data for all 3 lines.
 *   5. Updates lines.json, routes.json, timetables.json, timetables-version.json.
 *
 * Data License: ODPT Public Transportation Open Data Basic License.
 * OSM Data: © OpenStreetMap contributors, ODbL.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const KEY = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/NEXT_PUBLIC_ODPT_API_KEY=(\S+)/) || [])[1];
if (!KEY) { console.error('NEXT_PUBLIC_ODPT_API_KEY missing'); process.exit(1); }

const OVERPASS_MIRRORS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const OVERPASS_USER_AGENT = 'tokyo-train-orchestra/1.0 (https://github.com/samyu/tokyo-train-orchestra; educational/personal project)';

const LINE_DEFS = [
  {
    id: 'tama-monorail',
    name: 'Tama Monorail',
    nameJa: '多摩都市モノレール',
    colorFallback: '#286460', // from ODPT metadata
    instrument: 'celesta',
    odptRailway: 'odpt.Railway:TamaMonorail.TamaMonorail',
    operator: 'odpt.Operator:TamaMonorail',
    suffix: '-t',
    osmQueries: [
      '[out:json][timeout:60];(relation["name"~"多摩都市モノレール"]["route"~"monorail|train|light_rail"];);out geom;',
      '[out:json][timeout:60];(relation["operator"~"多摩都市モノレール|Tama"]["route"~"monorail"];);out geom;',
    ],
  },
  {
    id: 'marunouchi-branch',
    name: 'Marunouchi Branch',
    nameJa: '丸ノ内線支線',
    colorFallback: '#F62E36',
    instrument: 'piano',
    odptRailway: 'odpt.Railway:TokyoMetro.MarunouchiBranch',
    operator: 'odpt.Operator:TokyoMetro',
    suffix: '-mb',
    // OSM: relation 8015930 = 中野坂上→方南町, 8015931 = reverse
    // We use the forward direction; both have same geometry
    osmQueries: [
      '[out:json][timeout:60];(relation["name"~"丸ノ内"]["route"~"subway"]["ref"="M"];);out geom;',
      '[out:json][timeout:60];(relation(8015930);relation(8015931););out geom;',
    ],
    // Filter: only use branch relations (short ~4 ways), not the main trunk (~40 ways)
    osmRelationFilter: (rel) => {
      const mems = rel.members || [];
      const trackWays = mems.filter(m => m.type === 'way' && m.role === '');
      return trackWays.length <= 10; // branch has ~4 ways, main trunk ~40
    },
  },
  {
    id: 'tsukuba-express',
    name: 'Tsukuba Express',
    nameJa: 'つくばエクスプレス',
    colorFallback: '#00A650', // official TX green
    instrument: 'kalimba',
    odptRailway: 'odpt.Railway:MIR.TsukubaExpress',
    operator: 'odpt.Operator:MIR',
    suffix: '-tx',
    osmQueries: [
      '[out:json][timeout:60];(relation["name"~"つくばエクスプレス"]["route"~"train"];);out geom;',
      '[out:json][timeout:60];(relation["operator"~"首都圏新都市鉄道"]["route"~"train"];);out geom;',
    ],
  },
];

const CALENDARS = ['Weekday', 'SaturdayHoliday'];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function idFromUri(uri, suffix) {
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

async function fetchStations(lineDef) {
  const railwayData = await fetchJSON(
    `https://api.odpt.org/api/v4/odpt:Railway?owl:sameAs=${encodeURIComponent(lineDef.odptRailway)}&acl:consumerKey=${KEY}`
  );
  if (!railwayData || railwayData.length === 0) {
    throw new Error(`No Railway doc found for ${lineDef.odptRailway}`);
  }
  const railway = railwayData[0];
  console.log(`  Railway: ${railway['dc:title'] || lineDef.odptRailway}`);

  // Get color from ODPT metadata
  const odptColor = railway['odpt:color'];
  if (odptColor) {
    lineDef.color = odptColor;
    console.log(`  Color from ODPT: ${odptColor}`);
  } else {
    lineDef.color = lineDef.colorFallback;
    console.log(`  Color from fallback: ${lineDef.colorFallback}`);
  }

  const stationDocs = await fetchJSON(
    `https://api.odpt.org/api/v4/odpt:Station?odpt:railway=${encodeURIComponent(lineDef.odptRailway)}&acl:consumerKey=${KEY}`
  );
  const stationByUri = new Map();
  for (const s of stationDocs) {
    stationByUri.set(s['owl:sameAs'], s);
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

/** Fetch route geometry from Overpass. Tries multiple mirrors and queries.
 *  Returns array of [lat, lng] with 4 decimal places.
 *  Throws if no geometry obtained after all attempts. */
async function fetchOsmRoute(lineDef) {
  const errors = [];

  for (const mirror of OVERPASS_MIRRORS) {
    for (const query of lineDef.osmQueries) {
      process.stdout.write(`  Trying Overpass ${mirror.replace('https://', '').split('/')[0]}... `);
      try {
        // Try GET first (avoids some CSRF/whitelist restrictions), then POST
        let res;
        const getUrl = `${mirror}?data=${encodeURIComponent(query)}`;
        try {
          res = await fetch(getUrl, {
            method: 'GET',
            headers: { 'User-Agent': OVERPASS_USER_AGENT },
            signal: AbortSignal.timeout(90000),
          });
        } catch (_e) {
          res = await fetch(mirror, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': OVERPASS_USER_AGENT,
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(90000),
          });
        }
        if (!res.ok) {
          const txt = (await res.text()).slice(0, 200);
          console.log(`HTTP ${res.status}`);
          errors.push(`${mirror}: HTTP ${res.status}: ${txt}`);
          continue;
        }
        const data = await res.json();
        const elements = data.elements || [];
        const relations = elements.filter(e => e.type === 'relation');

        if (relations.length === 0) {
          console.log(`no relations found`);
          errors.push(`${mirror} + query: no relations`);
          continue;
        }

        // Apply optional filter (e.g., to pick only branch, not main trunk)
        let candidates = relations;
        if (lineDef.osmRelationFilter) {
          candidates = relations.filter(lineDef.osmRelationFilter);
        }
        if (candidates.length === 0) {
          console.log(`${relations.length} relations found but none passed filter`);
          errors.push(`${mirror}: relations found but filtered out`);
          continue;
        }

        console.log(`${candidates.length} relation(s) found`);

        // Use the first candidate relation (or merge forward+backward by picking larger)
        // For lines with up/down directions, pick the one with more way members (likely more complete)
        const rel = candidates.reduce((best, r) => {
          const bWays = (best.members || []).filter(m => m.type === 'way' && m.role === '').length;
          const rWays = (r.members || []).filter(m => m.type === 'way' && m.role === '').length;
          return rWays > bWays ? r : best;
        });

        console.log(`  Using relation ${rel.id}: "${rel.tags?.name || '?'}", ${(rel.members || []).filter(m => m.type === 'way' && m.role === '').length} track ways`);

        const route = buildRouteFromRelation(rel);
        if (route.length < 10) {
          console.log(`  Only ${route.length} route points — too few, skipping`);
          errors.push(`${mirror}: only ${route.length} pts after geometry walk`);
          continue;
        }

        console.log(`  Route: ${route.length} points (OSM real geometry)`);
        return { route, mirror, relationId: rel.id };

      } catch (err) {
        console.log(`error: ${err.message}`);
        errors.push(`${mirror}: ${err.message}`);
      }
    }
  }

  throw new Error(
    `OVERPASS FAILURE for ${lineDef.id}: all mirrors/queries failed.\n` +
    errors.map(e => `  - ${e}`).join('\n') +
    '\nNOT falling back to interpolation per user requirement.'
  );
}

/** Walk ways from a relation, stitching them into a continuous polyline.
 *  Only uses members with type=way and role="" (track ways, not platforms/stops). */
function buildRouteFromRelation(relation) {
  const members = relation.members || [];
  const trackWays = members.filter(m => m.type === 'way' && m.role === '');

  if (trackWays.length === 0) return [];

  // Build adjacency: each way has a list of [lat,lon] geometry nodes
  const ways = trackWays.map(m => {
    const geom = m.geometry || [];
    return geom.map(n => [n.lat, n.lon]);
  }).filter(pts => pts.length >= 2);

  if (ways.length === 0) return [];

  // Chain ways using endpoint matching (flip ways as needed)
  const TOLERANCE = 0.0001; // ~11m, enough for endpoint matching

  function dist([la1, lo1], [la2, lo2]) {
    return Math.abs(la1 - la2) + Math.abs(lo1 - lo2);
  }

  function closeEnough(a, b) {
    return dist(a, b) < TOLERANCE;
  }

  // Find the best starting way: try to find a terminal (its start or end only connects once)
  // Simplify: just greedy-chain from the first way
  const used = new Set();
  const chain = [ways[0]];
  used.add(0);

  let changed = true;
  while (changed && used.size < ways.length) {
    changed = false;
    const tail = chain[chain.length - 1];
    const tailEnd = tail[tail.length - 1];
    const head = chain[0];
    const headStart = head[0];

    for (let i = 0; i < ways.length; i++) {
      if (used.has(i)) continue;
      const w = ways[i];
      const wStart = w[0];
      const wEnd = w[w.length - 1];

      // Connect to tail
      if (closeEnough(tailEnd, wStart)) {
        chain.push(w);
        used.add(i);
        changed = true;
        break;
      }
      if (closeEnough(tailEnd, wEnd)) {
        chain.push([...w].reverse());
        used.add(i);
        changed = true;
        break;
      }
      // Connect to head (prepend)
      if (closeEnough(headStart, wEnd)) {
        chain.unshift(w);
        used.add(i);
        changed = true;
        break;
      }
      if (closeEnough(headStart, wStart)) {
        chain.unshift([...w].reverse());
        used.add(i);
        changed = true;
        break;
      }
    }
  }

  // If some ways couldn't be chained (disconnected segments), append them anyway
  for (let i = 0; i < ways.length; i++) {
    if (!used.has(i)) {
      chain.push(ways[i]);
    }
  }

  // Flatten, dedup consecutive duplicates, quantize to 4 decimal places
  const pts = [];
  let prev = null;
  for (const segment of chain) {
    for (const [lat, lon] of segment) {
      const qLat = +lat.toFixed(4);
      const qLon = +lon.toFixed(4);
      if (prev && prev[0] === qLat && prev[1] === qLon) continue;
      const pt = [qLat, qLon];
      pts.push(pt);
      prev = pt;
    }
  }

  return pts;
}

/** Snap station lat/lng onto the nearest point on the route polyline.
 *  Returns a new array of stations with snapped coordinates (for line rendering). */
function snapStationsToRoute(stations, route) {
  return stations.map(station => {
    let minDist = Infinity;
    let snappedLat = station.lat;
    let snappedLng = station.lng;

    for (let i = 0; i < route.length - 1; i++) {
      const [la1, lo1] = route[i];
      const [la2, lo2] = route[i + 1];

      // Project station onto segment
      const dx = la2 - la1;
      const dy = lo2 - lo1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      let t = ((station.lat - la1) * dx + (station.lng - lo1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projLat = la1 + t * dx;
      const projLon = lo1 + t * dy;
      const d = Math.hypot(station.lat - projLat, station.lng - projLon);
      if (d < minDist) {
        minDist = d;
        snappedLat = projLat;
        snappedLng = projLon;
      }
    }

    return { ...station, lat: snappedLat, lng: snappedLng };
  });
}

function buildStationLookup(stations) {
  const byNorm = new Map();
  for (const s of stations) {
    const norm = s.name.toLowerCase().replace(/[^a-z]/g, '');
    byNorm.set(norm, { id: s.id, index: s.index });
  }
  return byNorm;
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

  const summary = [];

  for (const lineDef of LINE_DEFS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing ${lineDef.id} (${lineDef.nameJa})...`);

    // 1. Fetch stations from ODPT
    console.log('  Fetching ODPT stations...');
    const stations = await fetchStations(lineDef);

    // 2. Fetch REAL route geometry from Overpass
    console.log('  Fetching OSM route geometry...');
    const { route, mirror, relationId } = await fetchOsmRoute(lineDef);
    console.log(`  OSM source: ${mirror}, relation ${relationId}`);

    if (route.length <= 50) {
      console.warn(`  WARNING: Only ${route.length} route points — expected >50 for real geometry`);
    }

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

    // 5. Fetch timetable
    const timetable = await fetchTimetable(lineDef, stations);
    ttJson.lines[lineDef.id] = timetable;
    console.log(`  timetables.json: updated ${lineDef.id}`);

    summary.push({
      id: lineDef.id,
      stations: stations.length,
      routePoints: route.length,
      osmMirror: mirror,
      osmRelationId: relationId,
      ttWeekday: timetable.Weekday?.length ?? 0,
      ttSatHol: timetable.SaturdayHoliday?.length ?? 0,
    });
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
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const s of summary) {
    console.log(`\n${s.id}:`);
    console.log(`  Stations: ${s.stations}`);
    console.log(`  Route points: ${s.routePoints} (${s.routePoints > 50 ? 'REAL OSM geometry' : 'WARNING: few points'})`);
    console.log(`  OSM source: ${s.osmMirror} (relation ${s.osmRelationId})`);
    console.log(`  Timetable: Weekday=${s.ttWeekday}, SaturdayHoliday=${s.ttSatHol}`);
  }
}

main().catch((err) => { console.error('\nFATAL:', err.message || err); process.exit(1); });
