'use client';

import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { LineConfig, ArrivalEvent } from '../types';
import routesData from '../config/routes.json';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
}

function TrainDot({ lat, lng, color, opacity }: { lat: number; lng: number; color: string; opacity: number }) {
  const icon = useMemo(() => L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="position:relative;width:30px;height:30px;">
      <div class="station-pulse" style="position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${color};"></div>
      <div style="position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${color};opacity:${opacity * 0.9};"></div>
    </div>`,
  }), [color, opacity]);

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

const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

export default function MapView({ lines, recentArrivals }: MapViewProps) {
  const center: [number, number] = [35.6812, 139.7671];
  const isDay = useTokyoDaylight();
  const tileUrl = isDay ? TILE_LIGHT : TILE_DARK;

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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      {lines.map((line) => {
        const routeCoords = (routesData as unknown as Record<string, [number, number][]>)[line.id];
        const positions = routeCoords
          ? routeCoords
          : line.stations.map((s) => [s.lat, s.lng] as [number, number]);
        return (
          <Polyline
            key={line.id}
            positions={positions}
            pathOptions={{ color: line.color, weight: 3, opacity: 0.6 }}
          />
        );
      })}

      {lines.flatMap((line) =>
        line.stations.map((station) => (
          <CircleMarker
            key={`${line.id}-${station.id}`}
            center={[station.lat, station.lng]}
            radius={2}
            pathOptions={{ color: line.color, fillColor: line.color, fillOpacity: 0.3, weight: 0, stroke: false }}
          />
        )),
      )}

      {recentArrivals.map((event) => {
        const coords = stationLookup.get(`${event.line}:${event.station}`);
        if (!coords) return null;
        const age = (Date.now() - event.timestamp) / 1000;
        const opacity = Math.max(0, 1 - age / 5);
        return (
          <TrainDot
            key={`${event.trainId}-${event.timestamp}`}
            lat={coords.lat}
            lng={coords.lng}
            color={coords.color}
            opacity={opacity}
          />
        );
      })}
    </MapContainer>
  );
}
