'use client';

import { useEffect, useRef } from 'react';
import { useModoClaro } from '@/components/modo';
import { EmptyState } from '@/components/ui';

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
  /** `salida` y `unidad`: el rastreo de Servicios en curso (de dónde salió y por dónde va). */
  /** `municipio`: la cabecera de un municipio en el mapa de Zonas (2026-10-28): anillo del color de su zona, relleno según cuántos aliados llegan. */
  tipo: 'aliado' | 'obra' | 'salida' | 'unidad' | 'municipio';
  detalle?: string | null;
  /** Letrero fijo junto al punto, sin tener que darle clic ("Salida", "Destino"). */
  etiqueta?: string | null;
  /**
   * De qué lado del punto va el letrero (arriba si no se dice). 'auto': el
   * lado libre, medido en pantalla para que dos vecinos no se encimen.
   */
  etiquetaLado?: Lado | 'auto';
  /** Color propio (la etapa del servicio en el Mapa de servicios, 2026-10-26); si no, el de su tipo. */
  color?: string;
  /** Solo `municipio`: el relleno (verde, ámbar o rojo según la cobertura); `color` es el anillo. */
  relleno?: string;
  /** Marcador con ícono de Phosphor ("ph-truck") en vez de un punto; `pulso` lo hace latir (la unidad en vivo). */
  icono?: string;
  pulso?: boolean;
}

/** Una línea del rastreo: lo que ya recorrió (continua) o lo que le falta (punteada). */
export interface RutaMapa {
  linea: Array<[number, number]>;
  falta?: boolean;
  /** Color propio y trazo punteado: de la base del aliado a la obra, por etapa (2026-10-26). Con color lleva contorno. */
  color?: string;
  punteada?: boolean;
  ancho?: number;
}

type Lado = 'top' | 'bottom' | 'left' | 'right';
/** Primero arriba; si tapa, a la derecha, abajo o a la izquierda. */
const LADOS: Lado[] = ['top', 'right', 'bottom', 'left'];
/** Cuánto se separa el letrero del punto, según el lado (r = radio del punto). */
const DESFASE: Record<Lado, (r: number) => [number, number]> = { top: (r) => [0, -r], bottom: (r) => [0, r], left: (r) => [-r, 0], right: (r) => [r, 0] };
/** Alto de un letrero en px (12 px de letra más su relleno y borde). */
const ALTO_ETQ = 24;
/** [x1, y1, x2, y2] en px de pantalla. */
type Caja = [number, number, number, number];
const traslape = (a: Caja, b: Caja) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

const COLOR: Record<PuntoMapa['tipo'], string> = { aliado: '#008CFF', unidad: '#008CFF', obra: '#E0A32E', salida: '#22A06B', municipio: '#9CA3AF' };
const TAMANO: Record<PuntoMapa['tipo'], number> = { aliado: 6, unidad: 9, obra: 8, salida: 7, municipio: 8 };

/** Texto → HTML seguro para los globos de Leaflet. */
const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Centro por omisión (Monterrey) cuando se va a marcar a mano y aún no hay punto. */
const CENTRO_MTY: [number, number] = [25.6866, -100.3161];

export function MapaCobertura({
  puntos,
  alto = 340,
  onMover,
  onElegir,
  rutas,
  tema = 'claro',
  cerca = false,
}: {
  puntos: PuntoMapa[];
  alto?: number;
  /**
   * Abrir de cerca, encuadrando los puntos y no los círculos completos (la
   * red, 2026-10-27): con círculos de 30 km la ciudad salía chiquita. Al
   * alejar se ven completos.
   */
  cerca?: boolean;
  /**
   * Tocar un punto (o su letrero) lo elige: en Proveedores abre su expediente
   * (2026-10-27). Con esto el punto ya no abre su globo. Memorízalo: cambia el mapa.
   */
  onElegir?: (id: number) => void;
  /** `oscuro`: el mapa en tonos del panel (Mapa de servicios, 2026-10-26); los colores de las rutas resaltan. */
  tema?: 'claro' | 'oscuro';
  /** Recorridos para dibujar como línea (rastreo de unidades, 2026-10-14). Memorízalos: cambian el mapa. */
  rutas?: RutaMapa[];
  /**
   * Modo "marcar a mano" (2026-09-25): un clic en el mapa o arrastrar el
   * punto lo mueve. Para cuando la dirección no existe en OpenStreetMap.
   */
  onMover?: (lat: number, lng: number) => void;
}) {
  // En modo claro el mapa "oscuro" se pinta claro (2026-10-28): sin teselas invertidas, ni fondo ni contornos negros.
  const claro = useModoClaro();
  const temaVivo: 'claro' | 'oscuro' = tema === 'oscuro' && !claro ? 'oscuro' : 'claro';
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

      /*
       * OpenStreetMap bloquea las teselas que llegan sin decir de qué sitio
       * vienen ("Access blocked", 2026-10-26). El panel manda
       * `Referrer-Policy: same-origin` para no filtrar sus rutas, así que solo
       * las teselas dicen el dominio (nunca la ruta). Sin subdominios a/b/c:
       * OSM ya no los recomienda.
       */
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);

      const capas: Array<{ getBounds?: () => unknown; getLatLng?: () => unknown }> = [];
      let ultimoClic = 0;
      /** Letreros con lado 'auto': se acomodan cuando el mapa ya tiene vista (abajo). */
      const automaticas: Array<{ p: PuntoMapa; r: number; ancho: number; poner: (l: Lado) => void }> = [];

      // El camino de cada unidad, debajo de los marcadores: continuo lo que ya
      // anduvo, punteado y del color del destino lo que le falta (en línea recta, no la carretera).
      for (const r of rutas ?? []) {
        if (r.linea.length < 2) continue;
        // Con color: primero un contorno más ancho, para que la ruta se lea sobre cualquier calle.
        if (r.color) {
          L.polyline(r.linea, { color: temaVivo === 'oscuro' ? '#07080a' : '#ffffff', weight: (r.ancho ?? 4) + 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(m);
        }
        L.polyline(r.linea, r.color
          ? { color: r.color, weight: r.ancho ?? 4, opacity: 1, lineJoin: 'round' as const, ...(r.punteada ? { dashArray: '1 9', lineCap: 'round' as const } : { lineCap: 'round' as const }) }
          : r.falta
            ? { color: '#E0A32E', weight: 3, opacity: 0.9, dashArray: '2 8', lineCap: 'round' }
            : { color: '#008CFF', weight: 4, opacity: 0.75 }).addTo(m);
      }

      for (const p of puntos) {
        const color = p.color ?? COLOR[p.tipo];

        // El radio primero, para que los marcadores queden encima.
        if (p.tipo === 'aliado' && p.radioKm && p.radioKm > 0) {
          // Sin clic propio: el círculo tapaba el clic al mapa (marcar a mano) y a los puntos de abajo.
          const c = L.circle([p.lat, p.lng], {
            radius: p.radioKm * 1000,
            color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.08,
            interactive: false,
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

        // Con ícono: un círculo de su color con el ícono en blanco (base, obra, unidad).
        if (p.icono) {
          const tam = p.tipo === 'unidad' ? 34 : 28;
          const pin = L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: '',
              iconSize: [tam, tam],
              iconAnchor: [tam / 2, tam / 2],
              popupAnchor: [0, -tam / 2],
              html: `<div class="mc-pin${p.pulso ? ' mc-pulso' : ''}" style="--c:${color};width:${tam}px;height:${tam}px"><i class="ph-bold ${p.icono}"></i></div>`,
            }),
            zIndexOffset: p.tipo === 'unidad' ? 1000 : p.tipo === 'obra' ? 500 : 0,
          }).addTo(m);
          pin.bindPopup(`<strong>${esc(p.nombre)}</strong>${p.detalle ? `<br>${esc(p.detalle)}` : ''}`);
          if (p.etiqueta) pin.bindTooltip(esc(p.etiqueta), { permanent: true, direction: 'top', offset: [0, -tam / 2], className: `mapa-etq mapa-etq-${p.tipo}` });
          capas.push(pin as never);
          continue;
        }

        const marca = L.circleMarker([p.lat, p.lng], {
          radius: TAMANO[p.tipo],
          // La unidad con borde blanco: es el punto que se busca primero.
          color: p.tipo === 'unidad' ? '#fff' : color,
          weight: p.tipo === 'unidad' || p.tipo === 'municipio' ? 3 : 2,
          fillColor: p.tipo === 'municipio' ? p.relleno ?? '#0d0e11' : color,
          fillOpacity: 0.95,
        }).addTo(m);
        // Escapado: el nombre de la obra lo escribe el CLIENTE y el del aliado
        // lo captura cualquiera; bindPopup interpreta HTML (QA 2026-09-25:
        // XSS confirmado en el panel).
        if (!onElegir) {
          marca.bindPopup(
            `<strong>${esc(p.nombre)}</strong>${p.detalle ? `<br>${esc(p.detalle)}` : ''}${
              p.radioKm ? `<br>Llega hasta ${p.radioKm} km` : ''
            }`,
          );
        }
        // El punto y su letrero disparan el clic; el candado evita abrirlo dos veces.
        const elegir = onElegir
          ? () => {
              if (Date.now() - ultimoClic < 400) return;
              ultimoClic = Date.now();
              onElegir(p.id);
            }
          : null;
        if (elegir) marca.on('click', elegir);
        if (p.etiqueta) {
          // Con onElegir el letrero lleva el color del punto y también se toca.
          const texto = onElegir ? `<span class="mapa-etq-punto" style="background:${color}"></span>${esc(p.etiqueta)}` : esc(p.etiqueta);
          const r = TAMANO[p.tipo] + 2;
          const poner = (lado: Lado) => {
            marca.unbindTooltip();
            marca.bindTooltip(texto, { permanent: true, direction: lado, offset: DESFASE[lado](r), interactive: Boolean(elegir), className: `mapa-etq mapa-etq-${p.tipo}` });
            if (elegir) marca.getTooltip()?.on('click', elegir);
          };
          if (p.etiquetaLado === 'auto') automaticas.push({ p, r, ancho: 30 + p.etiqueta.length * 6.8, poner });
          else poner(p.etiquetaLado ?? 'top');
        }
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
        // Los límites se calculan con los números, NO con `circle.getBounds()`:
        // ese necesita el mapa ya con vista y lanzaba "layerPointToLatLng of
        // undefined" en cuanto había dos aliados ubicados y uno con radio —el
        // mapa quedaba gris (2026-09-25). 1° de latitud ≈ 111 km.
        const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));
        for (const r of rutas ?? []) for (const ll of r.linea) limites.extend(ll);
        for (const p of puntos) {
          if (p.tipo !== 'aliado' || !p.radioKm) continue;
          // De cerca: unos km alrededor de cada punto, no el círculo completo.
          const radio = cerca ? Math.min(p.radioKm, 8) : p.radioKm;
          const dLat = radio / 111;
          const dLng = radio / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
          limites.extend([p.lat - dLat, p.lng - dLng]).extend([p.lat + dLat, p.lng + dLng]);
        }
        // maxZoom: si todos están en el mismo punto no se acerca hasta la banqueta.
        // Más margen con letreros: si no, el de arriba queda cortado por el borde.
        m.fitBounds(limites.pad(puntos.some((p) => p.etiqueta) ? 0.25 : 0.15), { maxZoom: 13 });
      }

      /*
       * LETREROS SIN ENCIMARSE (2026-10-27). Con la vista ya puesta se mide en
       * pantalla dónde caería cada letrero y se pone del lado (arriba, derecha,
       * abajo, izquierda) que menos tape a los demás letreros y puntos. Antes
       * se decidía por km y a la distancia en que abre el mapa dos aliados a
       * 20 km se tapaban. Se repite al acercar o alejar.
       */
      if (automaticas.length) {
        const acomodar = () => {
          const pantalla = (p: PuntoMapa) => m.latLngToContainerPoint([p.lat, p.lng]);
          const cajas: Caja[] = automaticas.map(({ p }) => { const c = pantalla(p); return [c.x - 7, c.y - 7, c.x + 7, c.y + 7]; });
          for (const a of [...automaticas].sort((x, y) => pantalla(x.p).x - pantalla(y.p).x)) {
            const c = pantalla(a.p);
            const g = a.r + 6;
            const caja = (l: Lado): Caja =>
              l === 'top' ? [c.x - a.ancho / 2, c.y - g - ALTO_ETQ, c.x + a.ancho / 2, c.y - g]
                : l === 'bottom' ? [c.x - a.ancho / 2, c.y + g, c.x + a.ancho / 2, c.y + g + ALTO_ETQ]
                  : l === 'right' ? [c.x + g, c.y - ALTO_ETQ / 2, c.x + g + a.ancho, c.y + ALTO_ETQ / 2]
                    : [c.x - g - a.ancho, c.y - ALTO_ETQ / 2, c.x - g, c.y + ALTO_ETQ / 2];
            let mejor: Lado = 'top';
            let menos = Number.POSITIVE_INFINITY;
            for (const l of LADOS) {
              const tapa = cajas.reduce((s, k) => s + traslape(caja(l), k), 0);
              if (tapa < menos) { menos = tapa; mejor = l; }
              if (tapa === 0) break;
            }
            cajas.push(caja(mejor));
            a.poner(mejor);
          }
        };
        acomodar();
        m.on('zoomend', acomodar);
      }
    })();

    return () => {
      vivo = false;
      if (mapa.current) {
        (mapa.current as { remove: () => void }).remove();
        mapa.current = null;
      }
    };
  }, [puntos, onMover, onElegir, rutas, temaVivo, cerca]);

  if (puntos.length === 0 && !onMover) {
    return (
      <div style={{ height: alto, display: 'grid', placeItems: 'center', border: '1px solid var(--adm-border)', borderRadius: 12, overflow: 'hidden' }}>
        <EmptyState
          icon="ph-map-trifold"
          title="Nadie está ubicado todavía."
          sub="Usa «Ponerlo en el mapa» en el expediente de cada aliado."
        />
      </div>
    );
  }

  return (
    <>
      {/* La hoja de estilos de Leaflet: sin ella las teselas se apilan sin
          posición y el mapa sale como una columna de imágenes. */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      {/* Controles de Leaflet con la paleta del panel. Vienen blancos de
          fábrica (zoom, atribución, globos) y sobre el cromo oscuro parecían
          de otra aplicación. Solo color y bordes: la lógica del mapa no cambia.
          Los selectores llevan `.mapa-cob` para ganarle a los de leaflet.css. */}
      <style>{`
        .mapa-cob.leaflet-container { background: var(--adm-raised); font-family: inherit; }
        .mapa-cob .leaflet-bar { border: 1px solid var(--adm-border-strong); border-radius: 8px; box-shadow: none; overflow: hidden; }
        .mapa-cob.leaflet-touch .leaflet-bar { border: 1px solid var(--adm-border-strong); }
        .mapa-cob .leaflet-bar a,
        .mapa-cob .leaflet-bar a:first-child,
        .mapa-cob .leaflet-bar a:last-child { background: var(--adm-raised); color: var(--adm-text); border-bottom-color: var(--adm-border-strong); border-radius: 0; }
        .mapa-cob .leaflet-bar a:last-child { border-bottom: 0; }
        .mapa-cob .leaflet-bar a:hover, .mapa-cob .leaflet-bar a:focus { background: color-mix(in srgb, var(--adm-raised) 88%, rgb(var(--adm-ink))); color: var(--adm-text); }
        .mapa-cob .leaflet-bar a.leaflet-disabled { background: var(--adm-raised); color: var(--adm-faint); }
        .mapa-cob.leaflet-container .leaflet-control-attribution { background: color-mix(in srgb, var(--adm-page) 78%, transparent); color: var(--adm-muted); font-size: 11px; }
        .mapa-cob.leaflet-container .leaflet-control-attribution a { color: var(--adm-text-2); }
        .mapa-cob .leaflet-popup-content-wrapper, .mapa-cob .leaflet-popup-tip { background: var(--adm-raised); color: var(--adm-text); }
        .mapa-cob .leaflet-popup-content-wrapper { border: 1px solid var(--adm-border-strong); border-radius: 10px; }
        .mapa-cob .leaflet-popup-content { margin: 11px 14px; font-size: 13px; line-height: 1.5; }
        .mapa-cob.leaflet-container a.leaflet-popup-close-button { color: var(--adm-muted); }
        .mapa-cob.leaflet-container a.leaflet-popup-close-button:hover { color: var(--adm-text); }
        .mapa-cob .leaflet-tooltip.mapa-etq { background: var(--adm-raised); color: var(--adm-text); border: 1px solid var(--adm-border-strong); border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.35); white-space: nowrap; }
        .mapa-cob .leaflet-tooltip-top.mapa-etq::before { border-top-color: var(--adm-border-strong); }
        .mapa-cob .leaflet-tooltip-bottom.mapa-etq::before { border-bottom-color: var(--adm-border-strong); }
        .mapa-cob .leaflet-tooltip-left.mapa-etq::before { border-left-color: var(--adm-border-strong); }
        .mapa-cob .leaflet-tooltip-right.mapa-etq::before { border-right-color: var(--adm-border-strong); }
        .mapa-cob .leaflet-tooltip.mapa-etq.leaflet-interactive { cursor: pointer; }
        .mapa-cob .leaflet-tooltip.mapa-etq.leaflet-interactive:hover { border-color: var(--adm-text-2); }
        .mapa-cob .mapa-etq-punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
        .mapa-cob .mapa-etq-salida { border-left: 3px solid #22A06B; }
        .mapa-cob .mapa-etq-unidad { border-left: 3px solid #008CFF; }
        .mapa-cob .mapa-etq-obra { border-left: 3px solid #E0A32E; }
        /* Tema oscuro (2026-10-26): las teselas de OSM invertidas a los tonos del panel; los colores de las rutas resaltan. */
        .mapa-cob.mapa-oscuro.leaflet-container { background: #0d0e11; }
        .mapa-cob.mapa-oscuro .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.55); }
        :root[data-theme="light"] .mapa-cob.mapa-oscuro .leaflet-tile-pane { filter: none; }
        .mc-pin { position: relative; display: grid; place-items: center; border-radius: 50%; background: var(--c); color: #fff; font-size: 15px; border: 2px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,.55); }
        .mc-pulso { font-size: 17px; }
        .mc-pulso::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--c); animation: mc-pulso 1.8s ease-out infinite; }
        @keyframes mc-pulso { from { transform: scale(.75); opacity: .9; } to { transform: scale(1.7); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .mc-pulso::after { animation: none; opacity: .5; } }
      `}</style>
      <div
        ref={caja}
        className={`mapa-cob${temaVivo === 'oscuro' ? ' mapa-oscuro' : ''}`}
        // isolation: Leaflet pinta sus capas con z-index 400–1000; sin aislarlas quedaban encima de los modales del panel.
        style={{ height: alto, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--adm-border)', position: 'relative', zIndex: 0, isolation: 'isolate' }}
      />
    </>
  );
}
