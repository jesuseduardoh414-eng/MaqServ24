'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

type Punto = { lat: number; lng: number };

const AZUL = '#008CFF';
const AMBAR = '#E0A32E';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * EL MAPA DEL SERVICIO, PARA EL CLIENTE (2026-10-15).
 *
 * "Que el cliente también vea dónde está la máquina." Su obra siempre; la
 * unidad y el camino que lleva solo mientras va en camino (es lo que manda el
 * teléfono del aliado). El patio del aliado no aparece: es dato suyo.
 *
 * Leaflet se carga en el efecto y no en el servidor: necesita la ventana.
 * Teselas de OpenStreetMap, igual que el panel.
 */
export function MapaServicio({ obra, unidad, ruta, alto = 280 }: {
  obra: (Punto & { name: string | null }) | null;
  unidad: (Punto & { at: string }) | null;
  ruta: Punto[];
  alto?: number;
}) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!caja.current || (!obra && !unidad)) return;
    let vivo = true;
    let mapa: { remove: () => void } | null = null;

    (async () => {
      const L = await import('leaflet');
      if (!vivo || !caja.current) return;
      const m = L.map(caja.current, { scrollWheelZoom: false, attributionControl: true });
      mapa = m;
      // OSM bloquea teselas sin el sitio de origen ("Access blocked"): se manda solo el dominio, explícito (2026-10-26).
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);

      const limites: Array<[number, number]> = [];
      // Lo que ya recorrió, y lo que le falta (en línea recta) hasta la obra.
      if (ruta.length > 1) {
        L.polyline(ruta.map((p) => [p.lat, p.lng] as [number, number]), { color: AZUL, weight: 4, opacity: 0.75 }).addTo(m);
        for (const p of ruta) limites.push([p.lat, p.lng]);
      }
      if (unidad && obra) {
        L.polyline([[unidad.lat, unidad.lng], [obra.lat, obra.lng]], { color: AMBAR, weight: 3, opacity: 0.9, dashArray: '2 8', lineCap: 'round' }).addTo(m);
      }

      const marca = (p: Punto, color: string, etiqueta: string, radio: number, blanco = false) => {
        L.circleMarker([p.lat, p.lng], { radius: radio, color: blanco ? '#fff' : color, weight: blanco ? 3 : 2, fillColor: color, fillOpacity: 0.95 })
          .addTo(m)
          .bindTooltip(esc(etiqueta), { permanent: true, direction: 'top', offset: [0, -radio], className: 'ms-mapa-etq' });
        limites.push([p.lat, p.lng]);
      };
      if (obra) marca(obra, AMBAR, obra.name ? `Tu obra · ${obra.name}` : 'Tu obra', 8);
      if (unidad) marca(unidad, AZUL, 'Tu unidad', 9, true);

      if (limites.length > 1) m.fitBounds(L.latLngBounds(limites).pad(0.25), { maxZoom: 15 });
      else m.setView(limites[0], 14);
    })();

    return () => {
      vivo = false;
      mapa?.remove();
    };
  }, [obra?.lat, obra?.lng, obra?.name, unidad?.lat, unidad?.lng, ruta.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!obra && !unidad) return null;
  return (
    <>
      <style>{`
        .ms-mapa-etq.leaflet-tooltip { background: var(--color-surface, #fff); color: var(--color-text, #111); border: 1px solid var(--color-border, #ddd); border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.25); white-space: nowrap; }
        .ms-mapa-etq.leaflet-tooltip-top::before { border-top-color: var(--color-border, #ddd); }
      `}</style>
      {/* isolation: Leaflet pinta capas con z-index altos; aisladas no tapan el menú del sitio. */}
      <div ref={caja} style={{ height: alto, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative', zIndex: 0, isolation: 'isolate', marginTop: 14 }} />
    </>
  );
}
