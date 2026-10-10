'use dom';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import './leaflet.css';
import './station-map.css';

type Point = { latitude: number; longitude: number };
export type MapPin = Point & { id: string; name: string; price: number | null; sample: boolean; stopNumber?: number };

export default function StationMap({ pins, center, selectedId, route = [], onSelect }: {
  pins: MapPin[];
  center: Point | null;
  selectedId?: string | null;
  route?: Point[];
  onSelect: (id: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.LayerGroup | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const initialView = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

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
    if (route.length > 1) L.polyline(route.map((point) => [point.latitude, point.longitude]), { color: '#245A4B', weight: 5 }).addTo(group);
    if (center) L.circleMarker([center.latitude, center.longitude], { radius: 7, color: '#FFFEF9', weight: 3, fillColor: '#2373CE', fillOpacity: 1 }).bindTooltip('Your location').addTo(group);
    for (const pin of pins) {
      const label = document.createElement('span');
      label.className = `station-pin${pin.id === selectedId ? ' selected' : ''}${pin.sample ? ' example' : ''}`;
      label.textContent = `${pin.stopNumber ? `${pin.stopNumber} · ` : ''}${pin.price === null ? 'Gas' : `$${pin.price.toFixed(2)}`}${pin.sample && pin.price !== null ? '*' : ''}`;
      const description = `${pin.name} · ${pin.price === null ? 'Price not reported' : `${pin.sample ? 'Sample price ' : 'Unverified price '}$${pin.price.toFixed(3)} per gallon`}`;
      const tooltip = document.createElement('span');
      tooltip.textContent = description;
      const marker = L.marker([pin.latitude, pin.longitude], { icon: L.divIcon({ html: label, className: 'station-marker', iconSize: [88, 44], iconAnchor: [44, 22] }), title: description, alt: description })
        .bindTooltip(tooltip).on('click', () => { void onSelect(pin.id); }).addTo(group);
      if (pin.id === selectedId) marker.setZIndexOffset(1000);
    }
    // Fit on first results, a changed search location, or a new route; preserve user panning during updates.
    const viewKey = route.length > 1 ? `${route[0].latitude},${route.at(-1)?.longitude},${route.length}` : center ? `${center.latitude},${center.longitude}` : 'sample';
    const viewState = `${viewKey}:${pins.length ? 'results' : 'empty'}`;
    if (initialView.current !== viewState) {
      const points = route.length > 1 ? route : [...pins, ...(center ? [center] : [])];
      if (points.length) instance.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [42, 42], maxZoom: 14 });
      initialView.current = viewState;
    }
    instance.invalidateSize();
  }, [ready, pins, center, route, selectedId, onSelect]);

  return <div className="station-map-shell">
    <div className="station-map" ref={container} aria-label="Gas station map. Select a price marker to view station details." />
    {!ready && !error && <div className="map-message">Opening map…</div>}
    {error && <div className="map-message" role="status">{error} <button onClick={() => { setError(''); tiles.current?.redraw(); }}>Retry</button></div>}
    {pins.some((pin) => pin.sample) && <div className="map-legend">* Sample price</div>}
  </div>;
}
