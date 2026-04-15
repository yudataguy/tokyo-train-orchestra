'use client';

import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { LineConfig, ArrivalEvent, Aircraft } from '../types';
import routesData from '../config/routes.json';
import { useLanguage } from '../i18n/useLanguage';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
  aircraft: Aircraft[];
}

/**
 * Small airplane glyph as a Leaflet divIcon. The inline SVG is rotated to
 * match the aircraft's heading, and stroked white + filled dark so it reads
 * on both light (GSI Pale / CARTO Positron) and dark (CARTO Dark) tiles.
 * Memoized on color + rounded heading so identical icons are shared.
 */
function buildAircraftIcon(headingDeg: number, onGround: boolean): L.DivIcon {
  // Top-down silhouette of a twin-engine passenger jet. Nose points up
  // (bearing 0°) and the divIcon root is rotated via CSS to match the
  // true-track heading. Proportions are narrow-body (think 737/A320):
  // a slender fuselage ~2 units wide on a 24-unit grid, wings swept back
  // at ~30°, a shorter horizontal stabilizer near the tail, and a tiny
  // centerline triangle suggesting the vertical fin.
  const size = 20;
  const opacity = onGround ? 0.45 : 0.9;
  const fill = '#1f2937';     // slate-800 for contrast on both tile themes
  const stroke = '#ffffff';

  // Path walks clockwise starting from the nose tip:
  //   nose → starboard fuselage → starboard wing (forward, tip, trailing)
  //   → starboard tail plane (forward, tip, trailing)
  //   → tail → (mirror on port side back up to nose).
  const fuselageAndWings = [
    'M12 2.2',                     // nose
    'C 12.9 2.2 13.2 3.2 13.2 4.2',// starboard fuselage curve
    'L 13.2 9',                    // along fuselage to wing root (front)
    'L 22 13.4',                   // starboard wing leading edge out to tip
    'L 22 14.4',                   // wingtip trailing corner
    'L 13.2 12.4',                 // wing trailing edge back to fuselage
    'L 13.2 16.8',                 // fuselage to horizontal stabilizer root
    'L 17 18.8',                   // stabilizer leading edge out to tip
    'L 17 19.4',                   // tip
    'L 13.2 18.4',                 // stabilizer trailing edge back to fuselage
    'L 13 21.2',                   // taper to tail cone
    'L 12 21.6',                   // tail tip (centerline)
    'L 11 21.2',
    'L 10.8 18.4',                 // back up port side — mirrors above
    'L 7 19.4',
    'L 7 18.8',
    'L 10.8 16.8',
    'L 10.8 12.4',
    'L 2 14.4',
    'L 2 13.4',
    'L 10.8 9',
    'L 10.8 4.2',
    'C 10.8 3.2 11.1 2.2 12 2.2',
    'Z',
  ].join(' ');

  // A small vertical-fin triangle floating above the tail, drawn lighter
  // so the plane reads as 3-D rather than flat.
  const verticalFin = `<path d="M 11.6 19.4 L 12.4 19.4 L 12 17.4 Z" fill="${fill}" opacity="0.55" />`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
         style="transform:rotate(${headingDeg}deg);display:block;opacity:${opacity};">
      <path d="${fuselageAndWings}"
            fill="${fill}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round"/>
      ${verticalFin}
    </svg>`;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: svg,
  });
}

function AircraftMarker({ plane }: { plane: Aircraft }) {
  // Round heading to 5° so icons are shared across nearby orientations.
  const headingBucket = Math.round(plane.heading / 5) * 5;
  const icon = useMemo(
    () => buildAircraftIcon(headingBucket, plane.onGround),
    [headingBucket, plane.onGround],
  );
  return <Marker position={[plane.lat, plane.lng]} icon={icon} />;
}

function TrainDot({ lat, lng, color }: { lat: number; lng: number; color: string }) {
  // Icon memoized on color ALONE so subsequent re-renders (triggered by new
  // arrivals elsewhere) never rebuild this dot's DOM. Both the expanding
  // pulse ring and the core-dot fade are driven by CSS keyframe animations,
  // so each dot's animation runs once on mount and isn't restarted when
  // other arrivals fire.
  const icon = useMemo(() => L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="position:relative;width:30px;height:30px;">
      <div class="station-pulse" style="position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${color};"></div>
      <div class="station-core" style="position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${color};"></div>
    </div>`,
  }), [color]);

  return <Marker position={[lat, lng]} icon={icon} />;
}

function useTokyoDaylight(): boolean {
  const [isDay, setIsDay] = useState(() => {
    const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false });
    const h = parseInt(hour, 10);
    return h >= 6 && h < 18;
  });

  useEffect(() => {
    const check = () => {
      const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false });
      const h = parseInt(hour, 10);
      setIsDay(h >= 6 && h < 18);
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return isDay;
}

// CARTO renders labels in Latin script. Good for the English UI.
const TILE_CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTR_CARTO = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// GSI Pale (地理院淡色地図) — Japan's Geospatial Information Authority
// publishes this purpose-built "muted" tile set, the Japanese equivalent of
// CARTO Positron. Labels are baked in Japanese. No dark variant exists, so
// Japanese UI stays light at night; the tradeoff is accepting a bright map
// at night in exchange for native Japanese labels.
const TILE_GSI_PALE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const ATTR_GSI = '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>';

export default function MapView({ lines, recentArrivals, aircraft }: MapViewProps) {
  const center: [number, number] = [35.6812, 139.7671];
  const isDay = useTokyoDaylight();
  const { language } = useLanguage();
  // Japanese UI → Japanese-labeled OSM tiles. English UI → CARTO with
  // day/night swap. OSM Japan has no dark tileset, so Japanese stays light
  // at night — acceptable tradeoff for authentic Japanese labels.
  const tileUrl = language === 'ja' ? TILE_GSI_PALE : (isDay ? TILE_CARTO_LIGHT : TILE_CARTO_DARK);
  const tileAttribution = language === 'ja' ? ATTR_GSI : ATTR_CARTO;

  const stationLookup = useMemo(() => {
    const lookup = new Map<string, { lat: number; lng: number; color: string }>();
    for (const line of lines) {
      for (const station of line.stations) {
        lookup.set(`${line.id}:${station.id}`, { lat: station.lat, lng: station.lng, color: line.color });
      }
    }
    return lookup;
  }, [lines]);

  return (
    <>
      {/* All animation + filter rules live here because Tailwind v4 tree-
          shakes class selectors it doesn't see in JSX attributes. The
          station classes are referenced only inside Leaflet divIcon HTML
          strings, so Tailwind misses them; the map tile filter targets
          Leaflet's own class names. Injecting the rules inline sidesteps
          Tailwind's source scanner entirely. */}
      <style>{`
        @keyframes tto-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(3); opacity: 0; }
        }
        .station-pulse {
          animation: tto-pulse 1.5s ease-out forwards;
          pointer-events: none;
        }
        @keyframes tto-core-fade {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        .station-core {
          animation: tto-core-fade 5s ease-out forwards;
          pointer-events: none;
        }
      `}</style>
      {language === 'ja' && (
        <style>{`.leaflet-tile-pane img.leaflet-tile { filter: saturate(0.35) brightness(1.04); }`}</style>
      )}
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100vh', width: '100vw' }}
        zoomControl={false}
        attributionControl={false}
      >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution={tileAttribution}
      />

      {lines.map((line) => {
        const routeCoords = (routesData as unknown as Record<string, [number, number][]>)[line.id];
        const positions = routeCoords
          ? routeCoords
          : line.stations.map((s) => [s.lat, s.lng] as [number, number]);
        // Yurikamome is a driverless guideway transit line; Marunouchi Branch
        // shares the same red color as the main Marunouchi trunk. Both are
        // drawn dashed to follow transit-mapping convention and avoid visual
        // collision with their solid counterparts.
        const isDashed = line.id === 'yurikamome' || line.id === 'marunouchi-branch';
        return (
          <Polyline
            key={line.id}
            positions={positions}
            pathOptions={{
              color: line.color,
              weight: 4,
              opacity: 0.85,
              dashArray: isDashed ? '8 5' : undefined,
            }}
          />
        );
      })}

      {aircraft.map((plane) => (
        <AircraftMarker key={plane.icao24} plane={plane} />
      ))}

      {recentArrivals.map((event) => {
        const coords = stationLookup.get(`${event.line}:${event.station}`);
        if (!coords) return null;
        // No opacity prop: the CSS animations own the visual lifecycle so
        // this Marker mounts once per arrival and stays mounted (invisible
        // after ~5 s) until pushed out of the 20-slot recentArrivals buffer.
        return (
          <TrainDot
            key={`${event.trainId}-${event.timestamp}`}
            lat={coords.lat}
            lng={coords.lng}
            color={coords.color}
          />
        );
      })}
      </MapContainer>
    </>
  );
}
