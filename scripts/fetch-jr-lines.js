#!/usr/bin/env node
/**
 * Fetch JR East Tokyo-area line data from OpenStreetMap via Overpass:
 *   - Station positions (from relation stop members)
 *   - Route geometry (from relation track ways, stitched endpoint-to-endpoint)
 *
 * Outputs:
 *   - Appends to src/config/lines.json
 *   - Appends to src/config/routes.json
 *
 * No ODPT data needed — everything comes from OSM.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LINES_PATH = path.join(ROOT, 'src/config/lines.json');
const ROUTES_PATH = path.join(ROOT, 'src/config/routes.json');

const JR_LINES = [
  {
    id: 'jr-yamanote',
    name: 'Yamanote',
    nameJa: '山手線',
    color: '#9ACD32',
    instrument: 'piano', // placeholder — no schedule data yet
    odptRailway: 'odpt.Railway:JR-East.Yamanote',
    osmQuery: 'relation["name"="JR山手線"]["ref"="JY"]["route"="train"];',
    isLoop: true,
  },
  {
    id: 'jr-chuo-rapid',
    name: 'Chuo Rapid',
    nameJa: '中央線快速',
    color: '#F15A22',
    instrument: 'piano',
    odptRailway: 'odpt.Railway:JR-East.ChuoRapid',
    osmQuery: 'relation["name"~"JR中央線"]["ref"="JC"]["operator"="東日本旅客鉄道"]["route"="train"];',
    isLoop: false,
  },
  {
    id: 'jr-chuo-sobu',
    name: 'Chuo-Sobu Local',
    nameJa: '中央・総武緩行線',
    color: '#FFD400',
    instrument: 'piano',
    odptRailway: 'odpt.Railway:JR-East.ChuoSobuLocal',
    osmQuery: 'relation["name"="中央・総武緩行線"]["ref"="JB"]["route"="train"];',
    isLoop: false,
  },
  {
    id: 'jr-keihin-tohoku',
    name: 'Keihin-Tohoku',
    nameJa: '京浜東北線',
    color: '#00B2E5',
    instrument: 'piano',
    odptRailway: 'odpt.Railway:JR-East.KeihinTohokuNegishi',
    osmQuery: 'relation["name"~"JR京浜東北線"]["ref"="JK"]["operator"="東日本旅客鉄道"]["route"="train"];',
    isLoop: false,
  },
  {
    id: 'jr-saikyo',
    name: 'Saikyo',
    nameJa: '埼京線',
    color: '#008000',
    instrument: 'piano',
    odptRailway: 'odpt.Railway:JR-East.SaikyoKawagoe',
    osmQuery: 'relation["name"~"埼京線"]["operator"="東日本旅客鉄道"]["route"~"train|railway"];',
    isLoop: false,
  },
];

const MIRRORS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function queryOverpass(query, retries = 3) {
  const full = `[out:json][timeout:90];\n(\n${query}\n);\nout body geom;`;
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TokyoTrainOrchestra/1.0',
          },
          body: `data=${encodeURIComponent(full)}`,
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.startsWith('<')) continue; // HTML error page
        return JSON.parse(text);
      } catch {}
    }
    // Back off before retry
    console.log(`  retrying in 5s (attempt ${attempt + 2}/${retries})...`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('all Overpass mirrors failed');
}

function extractStopRefs(relation) {
  const stops = [];
  for (const m of relation.members || []) {
    if (m.type !== 'node' || m.role !== 'stop') continue;
    if (m.lat == null || m.lon == null) continue;
    stops.push({ lat: m.lat, lon: m.lon, ref: m.ref });
  }
  return stops;
}

async function enrichStopNames(stops) {
  if (stops.length === 0) return stops;
  const ids = stops.map((s) => s.ref).join(',');
  const query = `node(id:${ids});`;
  const data = await queryOverpass(query);
  const nodeMap = new Map();
  for (const el of data.elements || []) {
    if (el.type === 'node' && el.tags) {
      nodeMap.set(el.id, el.tags);
    }
  }
  return stops.map((s) => {
    const tags = nodeMap.get(s.ref) || {};
    return {
      ...s,
      nameJa: tags['name'] || '',
      nameEn: tags['name:en'] || tags['name'] || '',
    };
  });
}

function stitchTrackWays(relation) {
  const ways = [];
  for (const m of relation.members || []) {
    if (m.type !== 'way' || (m.role && m.role !== '')) continue;
    const pts = (m.geometry || []).map((p) => [p.lat, p.lon]);
    if (pts.length >= 2) ways.push({ ref: m.ref, pts });
  }
  if (ways.length === 0) return [];

  // Walk from a degree-1 terminal (or arbitrary start for loops)
  const k = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const endpointCount = new Map();
  for (const w of ways) {
    const s = k(w.pts[0]);
    const e = k(w.pts[w.pts.length - 1]);
    endpointCount.set(s, (endpointCount.get(s) || 0) + 1);
    endpointCount.set(e, (endpointCount.get(e) || 0) + 1);
  }
  const terminals = [...endpointCount.entries()].filter(([, n]) => n === 1).map(([p]) => p);

  function walk(startKey) {
    let cursor = startKey;
    const path = [];
    const used = new Set();
    while (true) {
      let next = null;
      let flip = false;
      for (const w of ways) {
        if (used.has(w.ref)) continue;
        if (k(w.pts[0]) === cursor) { next = w; flip = false; break; }
        if (k(w.pts[w.pts.length - 1]) === cursor) { next = w; flip = true; break; }
      }
      if (!next) break;
      used.add(next.ref);
      const pts = flip ? [...next.pts].reverse() : next.pts;
      if (path.length === 0) path.push(pts[0]);
      for (let i = 1; i < pts.length; i++) path.push(pts[i]);
      cursor = k(path[path.length - 1]);
    }
    return { path, usedCount: used.size };
  }

  // Try each terminal; keep the longest walk
  const starts = terminals.length > 0 ? terminals : [k(ways[0].pts[0])];
  let best = { path: [], usedCount: 0 };
  for (const s of starts) {
    const result = walk(s);
    if (result.usedCount > best.usedCount) best = result;
  }

  // Quantize + dedup
  const quant = [];
  for (const p of best.path) {
    const q = [+p[0].toFixed(4), +p[1].toFixed(4)];
    if (!quant.length || quant[quant.length - 1][0] !== q[0] || quant[quant.length - 1][1] !== q[1]) {
      quant.push(q);
    }
  }
  console.log(`    stitched ${best.usedCount}/${ways.length} ways → ${quant.length} points`);
  return quant;
}

function snapStations(stations, route) {
  function project(p, a, b) {
    const [ay, ax] = [a[0], a[1]];
    const [by, bx] = [b[0], b[1]];
    const [py, px] = [p.lat, p.lon];
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return { pt: [ay, ax], d: (py - ay) ** 2 + (px - ax) ** 2 };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const cy = ay + t * dy, cx = ax + t * dx;
    return { pt: [cy, cx], d: (py - cy) ** 2 + (px - cx) ** 2 };
  }
  return stations.map((s) => {
    let best = null, bd = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const { pt, d } = project(s, route[i], route[i + 1]);
      if (d < bd) { bd = d; best = pt; }
    }
    return { ...s, lat: best ? +best[0].toFixed(5) : s.lat, lon: best ? +best[1].toFixed(5) : s.lon };
  });
}

function idFromName(nameEn, suffix) {
  return nameEn
    .replace(/[()（）]/g, '')
    .replace(/[\s/・]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + suffix;
}

async function main() {
  const lines = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  const routes = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));

  for (const line of JR_LINES) {
    console.log(`\n=== ${line.nameJa} (${line.id}) ===`);

    // Fetch from Overpass
    console.log('  querying overpass...');
    const data = await queryOverpass(line.osmQuery);
    const rels = (data.elements || []).filter((e) => e.type === 'relation');
    console.log(`  found ${rels.length} relations`);
    if (rels.length === 0) { console.log('  SKIPPED (no relation found)'); continue; }

    // Pick the relation with the most members (usually the most complete direction)
    rels.sort((a, b) => (b.members || []).length - (a.members || []).length);
    const rel = rels[0];
    const tags = rel.tags || {};
    console.log(`  using: "${tags.name}" (id=${rel.id}, ${(rel.members || []).length} members)`);

    // Stations from stop nodes (two-step: positions from relation, names via separate query)
    const rawStops = extractStopRefs(rel);
    console.log(`  stops: ${rawStops.length} (fetching names...)`);
    const enriched = await enrichStopNames(rawStops);
    const namedCount = enriched.filter((s) => s.nameJa).length;
    console.log(`  named: ${namedCount}/${enriched.length}`);

    // Route geometry from track ways
    const route = stitchTrackWays(rel);
    if (route.length === 0) { console.log('  SKIPPED (no route geometry)'); continue; }

    // Snap stations
    const snapped = snapStations(enriched, route);
    const suffix = line.id.replace('jr-', '');
    const stations = snapped.map((s, i) => ({
      id: idFromName(s.nameEn, suffix),
      name: s.nameEn,
      nameJa: s.nameJa,
      lat: s.lat,
      lng: s.lon,
      index: i,
    }));

    console.log(`  final: ${stations.length} stations, ${route.length} route points`);
    if (stations.length > 0) {
      console.log(`  first: ${stations[0].name} (${stations[0].nameJa})`);
      console.log(`  last:  ${stations[stations.length - 1].name} (${stations[stations.length - 1].nameJa})`);
    }

    // Upsert into lines.json
    const entry = {
      id: line.id,
      name: line.name,
      nameJa: line.nameJa,
      color: line.color,
      instrument: line.instrument,
      odptRailway: line.odptRailway,
      stations,
    };
    const idx = lines.findIndex((l) => l.id === line.id);
    if (idx >= 0) lines[idx] = entry;
    else lines.push(entry);

    // Upsert into routes.json
    routes[line.id] = route;

    // Rate-limit between queries
    await new Promise((r) => setTimeout(r, 3000));
  }

  fs.writeFileSync(LINES_PATH, JSON.stringify(lines, null, 2));
  fs.writeFileSync(ROUTES_PATH, JSON.stringify(routes));
  console.log(`\nDone. lines.json: ${lines.length} entries. routes.json: ${Object.keys(routes).length} keys.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
