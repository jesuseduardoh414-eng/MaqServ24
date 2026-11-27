'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { ShButton, type PuntoObra as Punto } from '@maqserv/ui';
import { centroDeMunicipio } from '@maqserv/config';
import { Icon } from '@/components/Icon';

/**
 * EL PUNTO EXACTO DE LA OBRA (2026-11-27; la primera versión, del 5 de
 * octubre, se quedó sin subir cuando cambiaron los cotizadores).
 *
 * Desde el 3 de noviembre el cotizador del sitio solo pide empresa y
 * municipio, así que la obra quedaba en el centro del municipio y el operador
 * veía «La ubicación exacta no está en el mapa». Con el punto, la API guarda
 * la obra con sus coordenadas: el operador abre Google Maps directo ahí y los
 * mapas del panel la ponen donde es.
 *
 * OPCIONAL y nunca bloquea. Dos caminos: «Usar mi ubicación» para quien está
 * parado en la obra, y el mapa para quien la conoce pero está en otro lado.
 * Leaflet se carga solo al abrir el mapa: quien no lo usa no descarga nada.
 */

const CENTRO_MTY: [number, number] = [25.6866, -100.3161];
const AZUL = '#008CFF';

export function PuntoObra({ valor, poner, municipio }: {
  valor: Punto | null;
  poner: (p: Punto | null) => void;
  /** El municipio elegido: el mapa abre ahí si todavía no hay punto. */
  municipio: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const pin = useRef<import('leaflet').Marker | null>(null);
  // El mapa no se rehace con cada movimiento del punto: lee lo último de aquí.
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const ponerRef = useRef(poner);
  ponerRef.current = poner;
  const municipioRef = useRef(municipio);
  municipioRef.current = municipio;

  function miUbicacion() {
    if (!('geolocation' in navigator)) {
      setAviso('Tu navegador no comparte la ubicación. Toca el mapa donde está la obra.');
      setAbierto(true);
      return;
    }
    setBuscando(true);
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscando(false);
        // Por la referencia: la respuesta tarda, y mientras pudo cambiar otro dato de la tarjeta.
        ponerRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAbierto(true);
        setAviso(pos.coords.accuracy > 150
          ? `Tu teléfono dio la ubicación con un margen de ${Math.round(pos.coords.accuracy)} m: revisa el punto y arrástralo a la entrada de la obra.`
          : 'Listo. Si no es justo la entrada de la obra, arrastra el punto.');
      },
      (err) => {
        setBuscando(false);
        setAbierto(true);
        setAviso(err.code === err.PERMISSION_DENIED
          ? 'No diste permiso de ubicación. Toca el mapa donde está la obra.'
          : 'No pudimos obtener tu ubicación. Toca el mapa donde está la obra.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function quitar() {
    poner(null);
    setAviso(null);
    pin.current?.remove();
    pin.current = null;
  }

  // Monta el mapa al abrirlo.
  useEffect(() => {
    if (!abierto || !caja.current) return;
    let vivo = true;
    (async () => {
      const L = await import('leaflet');
      if (!vivo || !caja.current) return;
      const m = L.map(caja.current, { scrollWheelZoom: false });
      mapa.current = m;
      // OSM bloquea teselas sin el sitio de origen: se manda solo el dominio (igual que MapaServicio).
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);
      const icono = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${AZUL};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.55);cursor:grab"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marcar = (lat: number, lng: number) => {
        if (pin.current) pin.current.setLatLng([lat, lng]);
        else {
          pin.current = L.marker([lat, lng], { draggable: true, icon: icono, keyboard: false }).addTo(m);
          pin.current.on('dragend', () => {
            const ll = pin.current!.getLatLng();
            ponerRef.current({ lat: ll.lat, lng: ll.lng });
          });
        }
      };
      const v = valorRef.current;
      if (v) {
        marcar(v.lat, v.lng);
        m.setView([v.lat, v.lng], 17);
      } else {
        const c = centroDeMunicipio(municipioRef.current);
        m.setView(c ? [c.lat, c.lng] : CENTRO_MTY, c ? 13 : 11);
      }
      m.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marcar(e.latlng.lat, e.latlng.lng);
        ponerRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      // La tarjeta pudo cambiar de alto al abrirse: Leaflet mide de nuevo.
      setTimeout(() => m.invalidateSize(), 60);
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      pin.current = null;
    };
  }, [abierto]);

  // «Usar mi ubicación» con el mapa ya abierto: mover el punto y la vista.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !valor) return;
    if (pin.current) pin.current.setLatLng([valor.lat, valor.lng]);
    if (!m.getBounds().contains([valor.lat, valor.lng])) m.setView([valor.lat, valor.lng], 17);
  }, [valor]);

  return (
    <div className="cz-punto">
      <style>{CSS}</style>
      <b>Ubicación exacta de la obra <span className="cz-punto-op">(opcional)</span></b>
      <p className="cz-help">
        {valor
          ? 'El operador llegará directo a este punto.'
          : 'Si estás en la obra, toca «Usar mi ubicación». Si no, márcala en el mapa. Así el operador llega directo.'}
      </p>
      <div className="cz-punto-acts">
        <ShButton type="button" variant="outline" size="sm" onClick={miUbicacion} disabled={buscando}>
          <Icon name="mapPin" size={16} />{buscando ? 'Buscando…' : 'Usar mi ubicación'}
        </ShButton>
        <ShButton type="button" variant="outline" size="sm" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
          {abierto ? 'Ocultar mapa' : valor ? 'Ver en el mapa' : 'Marcar en el mapa'}
        </ShButton>
        {valor ? (
          <ShButton type="button" variant="ghost" size="sm" onClick={quitar}>
            <Icon name="x" size={16} />Quitar punto
          </ShButton>
        ) : null}
      </div>
      {valor ? (
        <p className="cz-punto-ok"><Icon name="check" size={14} /> Punto marcado</p>
      ) : null}
      {aviso ? <p className="cz-help">{aviso}</p> : null}
      {abierto ? (
        <>
          <div ref={caja} className="cz-punto-mapa" />
          <p className="cz-help">{valor ? 'Arrastra el punto para afinarlo, o toca otro lugar del mapa.' : 'Toca el mapa donde está la entrada de la obra.'}</p>
        </>
      ) : null}
    </div>
  );
}

const CSS = `
.cz-punto{ display:grid; gap:8px; min-width:0; margin-top:16px; padding-top:14px; border-top:1px dashed var(--cz-border); }
.cz-punto > b{ font-size:14px; }
.cz-punto-op{ font-weight:400; color:var(--cz-muted); }
.cz-punto > .cz-help{ margin:0; }
.cz-punto-acts{ display:flex; gap:8px; flex-wrap:wrap; }
.cz-punto-ok{ display:flex; align-items:center; gap:6px; margin:0; font-size:13px; font-weight:600; color:var(--color-success, #1d8455); }
/* isolation: Leaflet pinta sus capas con z-index 400–1000 y quedaban encima del menú fijo. */
.cz-punto-mapa{ height:280px; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--cz-border); position:relative; z-index:0; isolation:isolate; }
@media (max-width:640px){ .cz-punto-mapa{ height:240px; } .cz-punto-acts > *{ flex:1 1 auto; } }
`;
