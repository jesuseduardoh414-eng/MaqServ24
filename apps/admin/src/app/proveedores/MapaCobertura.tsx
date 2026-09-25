'use client';

import { useEffect, useRef } from 'react';

/**
 * MAPA DE COBERTURA (documento institucional, sección 17).
 *
 * "Geolocalización: relaciona obra, proveedor, equipo, banco, ruta y cobertura."
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Teselas de OpenStreetMap y no de Google. Google Maps cobra por carga de
 *    mapa y exige una llave con tarjeta detrás; OSM no pide ninguna de las dos.
 *    Para un mapa que se mira dos veces al día, esa diferencia es todo el
 *    presupuesto de la función. La llave de Google, cuando exista, ya la usa el
 *    cotizador de traslado para lo que sí necesita precisión: la distancia por
 *    carretera.
 *
 * 2. Leaflet se carga a mano en un efecto y no con un envoltorio de React. Los
 *    envoltorios van un paso atrás de cada versión de React, y este mapa no
 *    necesita nada de lo que aportan: son cuarenta líneas contra una
 *    dependencia que se rompe en la siguiente actualización.
 */

export interface PuntoMapa {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  /** Radio de cobertura en km. Sólo los aliados lo traen. */
  radioKm?: number | null;
  tipo: 'aliado' | 'obra';
  detalle?: string | null;
}

/** Centro por omisión (Monterrey) cuando se va a marcar a mano y aún no hay punto. */
const CENTRO_MTY: [number, number] = [25.6866, -100.3161];

export function MapaCobertura({
  puntos,
  alto = 340,
  onMover,
}: {
  puntos: PuntoMapa[];
  alto?: number;
  /**
   * Modo "marcar a mano" (2026-09-25): un clic en el mapa o arrastrar el
   * punto lo mueve. Para cuando la dirección no existe en OpenStreetMap.
   */
  onMover?: (lat: number, lng: number) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<unknown>(null);

  useEffect(() => {
    if (!caja.current || (puntos.length === 0 && !onMover)) return;
    let vivo = true;

    (async () => {
      const L = await import('leaflet');
      if (!vivo || !caja.current) return;

      // Al recargar en desarrollo el contenedor conserva el mapa anterior y
      // Leaflet lanza "Map container is already initialized".
      if (mapa.current) {
        (mapa.current as { remove: () => void }).remove();
        mapa.current = null;
      }

      const m = L.map(caja.current, { scrollWheelZoom: false, attributionControl: true });
      mapa.current = m;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap',
      }).addTo(m);

      const capas: Array<{ getBounds?: () => unknown; getLatLng?: () => unknown }> = [];

      for (const p of puntos) {
        const esObra = p.tipo === 'obra';
        const color = esObra ? '#E0A32E' : '#008CFF';

        // El radio primero, para que los marcadores queden encima.
        if (!esObra && p.radioKm && p.radioKm > 0) {
          const c = L.circle([p.lat, p.lng], {
            radius: p.radioKm * 1000,
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.08,
          }).addTo(m);
          capas.push(c);
        }

        // Editable: un marcador que se arrastra (el circleMarker no se puede).
        if (onMover && puntos.length === 1) {
          const icono = L.divIcon({
            className: '',
            html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.6);cursor:grab"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const pin = L.marker([p.lat, p.lng], { draggable: true, icon: icono }).addTo(m);
          pin.on('dragend', () => { const ll = pin.getLatLng(); onMover(ll.lat, ll.lng); });
          capas.push(pin as never);
          continue;
        }

        const marca = L.circleMarker([p.lat, p.lng], {
          radius: esObra ? 8 : 6,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        }).addTo(m);
        marca.bindPopup(
          `<strong>${p.nombre}</strong>${p.detalle ? `<br>${p.detalle}` : ''}${
            p.radioKm ? `<br>Llega hasta ${p.radioKm} km` : ''
          }`,
        );
        capas.push(marca);
      }

      if (onMover) {
        m.on('click', (e: { latlng: { lat: number; lng: number } }) => onMover(e.latlng.lat, e.latlng.lng));
        (caja.current as HTMLDivElement).style.cursor = 'crosshair';
      }

      // Encuadra todo lo que hay. Con un solo punto no hay límites que calcular.
      if (puntos.length === 0) {
        m.setView(CENTRO_MTY, 10);
      } else if (puntos.length === 1) {
        m.setView([puntos[0].lat, puntos[0].lng], puntos[0].radioKm ? 10 : 13);
      } else {
        const grupo = L.featureGroup(capas as never);
        m.fitBounds(grupo.getBounds().pad(0.15));
      }
    })();

    return () => {
      vivo = false;
      if (mapa.current) {
        (mapa.current as { remove: () => void }).remove();
        mapa.current = null;
      }
    };
  }, [puntos, onMover]);

  if (puntos.length === 0 && !onMover) {
    return (
      <div
        style={{
          height: alto, display: 'grid', placeItems: 'center', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
          color: '#6b7280', fontSize: 13, padding: 20, lineHeight: 1.6,
        }}
      >
        Nadie está ubicado todavía.<br />
        Usa &quot;Ponerlo en el mapa&quot; en el expediente de cada aliado.
      </div>
    );
  }

  return (
    <>
      {/* La hoja de estilos de Leaflet: sin ella las teselas se apilan sin
          posición y el mapa sale como una columna de imágenes. */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div
        ref={caja}
        // isolation: Leaflet pinta sus capas con z-index 400–1000; sin aislarlas quedaban encima de los modales del panel.
        style={{ height: alto, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', position: 'relative', zIndex: 0, isolation: 'isolate' }}
      />
    </>
  );
}
