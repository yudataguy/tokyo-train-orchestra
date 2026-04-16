'use client';

import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { LineConfig, ArrivalEvent } from '../types';
import routesData from '../config/routes.json';
import { useLanguage } from '../i18n/useLanguage';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
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

export default function MapView({ lines, recentArrivals }: MapViewProps) {
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
        minZoom={5}
        maxBounds={[[20, 120], [46, 150]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100vh', width: '100vw' }}
        zoomControl={false}
        attributionControl={false}
      >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution={tileAttribution}
      />

      {/* Render all lines except Yamanote first, then Yamanote on top so
          the iconic green loop is always visible above other overlapping
          lines (Chuo, Keihin-Tohoku, Saikyo share much of the same corridor). */}
      {[...lines.filter(l => l.id !== 'jr-yamanote'), ...lines.filter(l => l.id === 'jr-yamanote')].map((line) => {
        const routeCoords = (routesData as unknown as Record<string, [number, number][]>)[line.id];
        const positions = routeCoords
          ? routeCoords
          : line.stations.map((s) => [s.lat, s.lng] as [number, number]);
        const isDashed = line.id === 'yurikamome' || line.id === 'marunouchi-branch';
        const isYamanote = line.id === 'jr-yamanote';
        return (
          <Polyline
            key={line.id}
            positions={positions}
            pathOptions={{
              color: line.color,
              weight: isYamanote ? 5 : 4,
              opacity: isYamanote ? 1.0 : 0.85,
              dashArray: isDashed ? '8 5' : undefined,
            }}
          />
        );
      })}

      {recentArrivals.map((event) => {
        const coords = stationLookup.get(`${event.line}:${event.station}`);
        if (!coords) return null;
        // No opacity prop: the CSS animations own the visual lifecycle so
        // this Marker mounts once per arrival and stays mounted (invisible
        // after ~5 s) until pushed out of the 20-slot recentArrivals buffer.
        return (
          <TrainDot
            key={(event as any)._seq ?? `${event.trainId}-${event.timestamp}`}
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
