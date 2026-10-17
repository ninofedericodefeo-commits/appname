'use dom';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import './leaflet.css';
import './station-map.css';

type Point = { latitude: number; longitude: number };
export type MapPin = Point & { id: string; name: string; price: number | null; sample: boolean; stopNumber?: number; stale?: boolean; lowest?: boolean };

export default function StationMap({ pins, center, centerLabel = 'Your location', selectedId, route = [], onSelect, onSearchArea, dark = false, height = 370 }: {
  pins: MapPin[];
  center: Point | null;
  selectedId?: string | null;
  route?: Point[];
  onSelect: (id: string) => Promise<void>;
  centerLabel?: string;
  onSearchArea?: (point: Point) => Promise<void>;
  dark?: boolean;
  height?: number;
  dom?: import('expo/dom').DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.LayerGroup | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const initialView = useRef('');
  const fitting = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [searchPoint, setSearchPoint] = useState<Point | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !onSearchArea) return;
    const moved = () => {
      if (fitting.current) { setSearchPoint(null); return; }
      const point = instance.getCenter().wrap();
      if (instance.getZoom() < 8 || center && instance.distance(point, [center.latitude, center.longitude]) < 160) { setSearchPoint(null); return; }
      setSearchPoint({ latitude: point.lat, longitude: point.lng });
    };
    instance.on('moveend', moved);
    return () => { instance.off('moveend', moved); };
  }, [ready, center, onSearchArea]);

  useEffect(() => {
    let canceled = false;
    void import('leaflet').then((L) => {
      if (canceled || !container.current) return;
      library.current = L;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView([39, -98], 4);
      map.current = instance;
      tiles.current = L.tileLayer(process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).on('tileerror', () => setError('Map tiles unavailable. You can still select stations, or use List.')).addTo(instance);
      layers.current = L.layerGroup().addTo(instance);
      setReady(true);
    }).catch(() => setError('Map unavailable. Switch to List to see stations.'));
    return () => { canceled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const L = library.current;
    const group = layers.current;
    if (!ready || !instance || !L || !group) return;
    group.clearLayers();
    if (route.length > 1) L.polyline(route.map((point) => [point.latitude, point.longitude]), { color: '#005FCC', weight: 5, opacity: 0.85 }).addTo(group);
    if (center) L.circleMarker([center.latitude, center.longitude], { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#005FCC', fillOpacity: 1 }).bindTooltip(centerLabel).addTo(group);
    for (const pin of pins) {
      const label = document.createElement('span');
      const lowest = pin.lowest && pin.price !== null && !pin.sample && !pin.stale;
      label.className = `station-pin${pin.id === selectedId ? ' selected' : ''}${pin.sample ? ' example' : ''}${pin.stale ? ' stale' : ''}${pin.price === null ? ' unknown' : ''}${lowest ? ' lowest' : ''}`;
      label.textContent = `${pin.stopNumber ? `${pin.stopNumber} · ` : ''}${pin.price === null ? 'N/A' : `$${pin.price.toFixed(3)}`}${pin.sample && pin.price !== null ? '*' : ''}${pin.stale ? ' · Old' : ''}`;
      const description = `${pin.name} · ${pin.price === null ? 'Price unavailable' : `${lowest ? 'Lowest recent report. ' : ''}${pin.stale ? 'Old report ' : pin.sample ? 'Sample price ' : 'Unverified price '}$${pin.price.toFixed(3)} per gallon`}`;
      const tooltip = document.createElement('span');
      tooltip.textContent = description;
      const width = pin.stopNumber || pin.stale ? 124 : pin.price === null ? 68 : 88;
      const marker = L.marker([pin.latitude, pin.longitude], { icon: L.divIcon({ html: label, className: 'station-marker', iconSize: [width, 44], iconAnchor: [width / 2, 22] }), title: description, alt: description })
        .bindTooltip(tooltip).on('click', () => { void onSelect(pin.id); }).addTo(group);
      if (pin.id === selectedId) marker.setZIndexOffset(1000);
    }
    // Fit on first results, a changed search location, or a new route; preserve user panning during updates.
    const viewKey = route.length > 1 ? `${route[0].latitude},${route.at(-1)?.longitude},${route.length}` : center ? `${center.latitude},${center.longitude}` : 'sample';
    const viewState = `${viewKey}:${pins.length ? 'results' : 'empty'}`;
    if (initialView.current !== viewState) {
      const points = route.length > 1 ? route : [...pins, ...(center ? [center] : [])];
      fitting.current = true;
      if (points.length) instance.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [42, 42], maxZoom: 14, animate: false });
      fitting.current = false;
      initialView.current = viewState;
    }
    instance.invalidateSize({ pan: false });
  }, [ready, pins, center, centerLabel, route, selectedId, onSelect]);

  return <div className={`station-map-shell${dark ? ' map-dark' : ''}`} style={{ height }}>
    <div className="station-map" ref={container} aria-label="Gas station map. Select a price marker to view station details." />
    {!ready && !error && <div className="map-message">Opening map…</div>}
    {error && <div className="map-message" role="status">{error} <button onClick={() => { setError(''); tiles.current?.redraw(); }}>Retry</button></div>}
    {onSearchArea && searchPoint && (!center || Math.abs(searchPoint.latitude - center.latitude) + Math.abs(searchPoint.longitude - center.longitude) > 0.001) && <button className="map-search-area" disabled={searching} onClick={() => { setSearching(true); void onSearchArea(searchPoint).catch(() => setError('Could not search this area. Try again.')).finally(() => setSearching(false)); }}>{searching ? 'Searching…' : 'Search this area'}</button>}
    {pins.some(pin => pin.sample || pin.stale || pin.price === null) && <div className="map-legend">
      {pins.some(pin => pin.price === null) && <span>N/A · Price unavailable</span>}
      {pins.some(pin => pin.sample) && <span>* Sample price</span>}
      {pins.some(pin => pin.stale) && <span>Old · Over 24h or report time unavailable</span>}
    </div>}
  </div>;
}
