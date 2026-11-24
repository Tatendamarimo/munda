import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

export interface MapCell { cell: string; label: string; farms: number }

/**
 * The group's checks as circles, one per ~5 km square: bigger and redder with more farms. A square
 * shows where to look, never which farm. Needs signal for the map tiles (OpenStreetMap).
 */
export function AreaMap({ cells }: { cells: MapCell[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([-19.0, 30.5], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 14, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    for (const c of cells) {
      const [lat, lng] = c.cell.split(',').map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const color = c.farms >= 3 ? '#c2410c' : '#e0a300';
      L.circle([lat!, lng!], { radius: 2500, color, weight: 2, fillColor: color, fillOpacity: Math.min(0.25 + c.farms * 0.1, 0.65) })
        .bindTooltip(c.label, { direction: 'top' }).addTo(g);
      pts.push([lat!, lng!]);
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.6), { maxZoom: 11 });
  }, [cells]);

  return <div ref={el} className="area-map" role="img" aria-label="Map of the group's checks by area" />;
}
