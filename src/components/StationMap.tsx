'use dom';

import { useEffect, useRef, useState } from 'react';
import type * as MapLibre from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './station-map.css';

type Point = { latitude: number; longitude: number };
export type MapPin = Point & { id: string; name: string; price: number | null; sample: boolean; stopNumber?: number };
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
// v6 uses a separate module worker. Match the installed version exactly; the
// official loader wraps this cross-origin module in a same-origin Blob worker.
const WORKER = 'https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl-worker.mjs';

export default function StationMap({ pins, center, selectedId, route = [], onSelect }: {
  pins: MapPin[]; center: Point | null; selectedId?: string | null; route?: Point[];
  onSelect: (id: string) => Promise<void>; dom?: import('expo/dom').DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre.Map | null>(null);
  const library = useRef<typeof MapLibre | null>(null);
  const markers = useRef(new Map<string, MapLibre.Marker>());
  const locationMarker = useRef<MapLibre.Marker | null>(null);
  const initialView = useRef('');
  const select = useRef(onSelect);
  const [readyMap, setReadyMap] = useState<MapLibre.Map | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { select.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let canceled = false;
    let loaded = false;
    const activeMarkers = markers.current;
    initialView.current = '';
    const timer = setTimeout(() => { if (!canceled && !loaded) setError('Map is taking too long to load. Try again or use List.'); }, 30_000);
    void import('maplibre-gl').then((L) => {
      if (canceled || !container.current) return;
      library.current = L;
      L.setWorkerUrl(WORKER);
      L.setWorkerCount(1);
      const instance = new L.Map({ container: container.current, style: STYLE, center: [-98, 39], zoom: 3.5,
        scrollZoom: false, dragRotate: false, pitchWithRotate: false, attributionControl: false });
      map.current = instance;
      instance.touchZoomRotate.disableRotation();
      instance.addControl(new L.NavigationControl({ showCompass: false }), 'top-right');
      instance.addControl(new L.AttributionControl({ compact: true }), 'bottom-right');
      instance.on('load', () => { if (!canceled) { loaded = true; clearTimeout(timer); setReadyMap(instance); setError(''); } });
      instance.on('error', () => { if (!canceled) setError('Some map details could not load. Try again or use List.'); });
    }).catch(() => { if (!canceled) setError('Map unavailable on this device. Use List to see stations.'); });
    return () => {
      canceled = true; clearTimeout(timer); activeMarkers.forEach((marker) => marker.remove()); activeMarkers.clear();
      locationMarker.current?.remove(); locationMarker.current = null; map.current?.remove(); map.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const instance = map.current, L = library.current;
    if (!readyMap || readyMap !== instance || !L) return;
    const ids = new Set(pins.map((pin) => pin.id));
    markers.current.forEach((marker, id) => { if (!ids.has(id)) { marker.remove(); markers.current.delete(id); } });
    for (const pin of pins) {
      let marker = markers.current.get(pin.id);
      if (!marker) {
        const button = document.createElement('button'); button.type = 'button';
        button.addEventListener('click', () => { void select.current(pin.id); });
        marker = new L.Marker({ element: button, anchor: 'center' }).setLngLat([pin.longitude, pin.latitude]).addTo(instance);
        markers.current.set(pin.id, marker);
      }
      const element = marker.getElement();
      element.className = `station-pin${pin.id === selectedId ? ' selected' : ''}${pin.price === null ? ' unknown' : ''}`;
      element.style.zIndex = pin.id === selectedId ? '2' : '1';
      element.textContent = `${pin.stopNumber ? `${pin.stopNumber} · ` : ''}${pin.price === null ? 'Gas' : `$${pin.price.toFixed(2)}${pin.sample ? '*' : ''}`}`;
      const description = `${pin.name} · ${pin.price === null ? 'Price not reported' : `${pin.sample ? 'Sample' : 'Unverified'} price $${pin.price.toFixed(3)} per gallon`}`;
      element.setAttribute('aria-label', description); element.setAttribute('aria-pressed', String(pin.id === selectedId)); element.title = description;
      marker.setLngLat([pin.longitude, pin.latitude]);
    }
    if (center) {
      if (!locationMarker.current) {
        const dot = document.createElement('div'); dot.className = 'map-location'; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', 'Your location');
        locationMarker.current = new L.Marker({ element: dot }).setLngLat([center.longitude, center.latitude]).addTo(instance);
      }
      locationMarker.current.setLngLat([center.longitude, center.latitude]);
    } else { locationMarker.current?.remove(); locationMarker.current = null; }
    const data = route.length > 1 ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.map((point) => [point.longitude, point.latitude]) } } : { type: 'FeatureCollection' as const, features: [] };
    const source = instance.getSource('drive-route') as MapLibre.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else if (route.length > 1) {
      instance.addSource('drive-route', { type: 'geojson', data });
      instance.addLayer({ id: 'drive-route-line', type: 'line', source: 'drive-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2878D3', 'line-width': 5, 'line-opacity': 0.9 } });
    }
    const viewKey = route.length > 1 ? `${route[0].latitude},${route[0].longitude}:${route.at(-1)?.latitude},${route.at(-1)?.longitude}:${route.length}` : center ? `${center.latitude},${center.longitude}` : 'overview';
    const viewState = `${viewKey}:${pins.length ? 'results' : 'empty'}`;
    if (initialView.current !== viewState) {
      const points = route.length > 1 ? route : [...pins, ...(center ? [center] : [])];
      if (points.length) {
        const bounds = new L.LngLatBounds(); points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        instance.fitBounds(bounds, { padding: { top: 55, bottom: 45, left: 45, right: 100 }, maxZoom: 14, duration: 0 });
      }
      initialView.current = viewState;
    }
    instance.resize();
  }, [readyMap, pins, center, route, selectedId]);

  return <div className="station-map-shell">
    <div className="station-map" ref={container} aria-label="Gas station map. Select a station marker to view details." />
    {readyMap && center && <button className="map-center" aria-label="Center map on your location" title="Center on your location" onClick={() => map.current?.easeTo({ center: [center.longitude, center.latitude], zoom: 13, duration: 300 })}>⌖</button>}
    {!readyMap && !error && <div className="map-message">Opening map…</div>}
    {error && <div className="map-message" role="status">{error} <button onClick={() => { setReadyMap(null); setError(''); setAttempt((value) => value + 1); }}>Retry</button></div>}
    {pins.some((pin) => pin.sample) && <div className="map-legend">* Sample price</div>}
  </div>;
}
