'use client';

import { useMemo, useState, type InputHTMLAttributes } from 'react';
import { ESTADOS_COBERTURA } from '@maqserv/config';
import { Modal } from '@/components/Modal';
import { Btn, EmptyState, FormField, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone } from '@/components/ui';
import { AvisoDiseno, accionDeDiseno as diseno } from '@/components/Diseno';
import { MapaCobertura, type PuntoMapa } from '@/app/proveedores/MapaCobertura';
import {
  ALIADOS, MUNICIPIOS, ZONAS, aliadosDeMunicipio, aliadosQueCubren, dinero, entidadesDe, fechaCorta, horas, kmEntre, municipioDe,
  normalizar, sinAliado, type EstadoZona, type Zona,
} from './datos-ejemplo';

const MOTIVO = 'Se conecta cuando el cotizador y la cobertura lean las zonas de aquí en vez de sus propias listas.';
const accionDeDiseno = (nombre: string) => diseno(nombre, MOTIVO);

/**
 * ZONAS — diseño (2026-10-09).
 *
 * Dónde opera MAQSER24, agrupado en zonas: cada zona es un grupo de
 * municipios con su flete base por viaje, su recargo de maquinaria, su tiempo
 * de respuesta objetivo y si se anuncia en el sitio. Es la pieza de
 * "Geolocalización" del documento institucional (sección 17: "relaciona obra,
 * proveedor, equipo, banco, ruta y cobertura") que hoy está repartida en
 * cuatro listas que no se hablan:
 *
 * - el cotizador de triturados tiene su propia tabla "Zona → flete del viaje"
 *   (bandas por distancia a las pedreras, `CATALOGO_TRITURADOS_DEFAULT.zonas`);
 * - el sitio anuncia solo `ESTADOS_COBERTURA` (Nuevo León);
 * - la operación ya va por `ESTADOS_OPERACION` (más Coahuila y Chihuahua);
 * - cada aliado guarda su lista de municipios.
 *
 * Con una sola tabla de zonas, el cotizador saca de aquí flete y recargo, el
 * sitio anuncia las zonas "En el sitio" y la cobertura se mide por zona: qué
 * municipios no tienen aliado y qué zonas dependen de uno solo.
 *
 * Vista de diseño con datos de ejemplo (ver ./datos-ejemplo.ts): filtros,
 * búsqueda por municipio y el editor funcionan sobre esos datos; guardar y
 * pausar responden con `accionDeDiseno`.
 */

type Filtro = 'todas' | EstadoZona;

const ESTADO: Record<EstadoZona, { texto: string; tono: Tone; ayuda: string }> = {
  sitio: { texto: 'En el sitio', tono: 'ok', ayuda: 'Se anuncia en el sitio público y se cotiza.' },
  interna: { texto: 'Solo interna', tono: 'info', ayuda: 'Se cotiza a quien la pida, pero el sitio no la anuncia.' },
  pausada: { texto: 'Pausada', tono: 'muted', ayuda: 'No toma solicitudes nuevas; lo que ya está en curso sigue.' },
};

const GRID = 'minmax(0,1.1fr) minmax(0,1.5fr) 84px 72px 88px 68px 96px 116px';

/** Los colores de MapaCobertura (obra / aliado), para que la leyenda coincida con el mapa. */
const COLOR_MUNICIPIO = '#E0A32E';
const COLOR_ALIADO = '#008CFF';

interface Fila extends Zona { entidad: string; aliados: number; huecos: string[] }

/** "Monterrey, San Nicolás, Guadalupe +5". Con búsqueda, lo que coincide va primero. */
function muestraMunicipios(ms: readonly string[], t: string) {
  const orden = t ? [...ms.filter((m) => normalizar(m).includes(t)), ...ms.filter((m) => !normalizar(m).includes(t))] : [...ms];
  // Cuatro caben enteros; "3 +1" sería esconder uno solo.
  const vis = orden.length <= 4 ? orden : orden.slice(0, 3);
  const resto = ms.length - vis.length;
  return `${vis.join(', ')}${resto > 0 ? ` +${resto}` : ''}`;
}

export function Zonas() {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ zona: Zona | null; municipios?: string[] } | null>(null);

  const filas: Fila[] = useMemo(() => ZONAS.map((z) => ({
    ...z,
    entidad: entidadesDe(z.municipios),
    aliados: aliadosQueCubren(z.municipios).length,
    huecos: sinAliado(z.municipios),
  })), []);

  // Métricas: solo las zonas activas (una pausada no cotiza ni se mide).
  const activas = filas.filter((f) => f.estado !== 'pausada');
  const municipiosActivos = activas.reduce((a, f) => a + f.municipios.length, 0);
  const huecosActivos = activas.reduce((a, f) => a + f.huecos.length, 0);
  const enSitio = filas.filter((f) => f.estado === 'sitio');
  const municipiosSitio = enSitio.flatMap((f) => f.municipios);
  const promedioAliados = activas.reduce((a, f) => a + f.aliados, 0) / Math.max(1, activas.length);
  const deUnSolo = activas.filter((f) => f.aliados <= 1).length;

  const t = normalizar(q);
  const visibles = filas.filter((f) => {
    if (filtro !== 'todas' && f.estado !== filtro) return false;
    return !t || normalizar(f.nombre).includes(t) || normalizar(f.entidad).includes(t) || f.municipios.some((m) => normalizar(m).includes(t));
  });
  // Buscar un municipio que no está en ninguna zona es justo la pregunta que esta pantalla debe contestar.
  const sueltos = t ? MUNICIPIOS.filter((m) => normalizar(m.nombre).includes(t) && !ZONAS.some((z) => z.municipios.includes(m.nombre))).map((m) => m.nombre) : [];

  const abrir = (z: Zona) => setEditor({ zona: z });

  return (
    <div>
      <style>{`
        .zn-row { display: grid; grid-template-columns: ${GRID}; gap: 14px; align-items: center; }
        .zn-row.adm-trow { cursor: pointer; }
        .zn-num { text-align: right; font-variant-numeric: tabular-nums; font-size: 13.5px; }
        .zn-lbl { display: none; color: var(--adm-muted); }
        .zn-edit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 26px; align-items: start; }
        .zn-col { display: grid; gap: 18px; align-content: start; min-width: 0; }
        .zn-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .zn-chip { height: 26px; padding: 0 3px 0 9px; gap: 4px; font-size: 12.5px; font-weight: 500; color: var(--adm-text); }
        .zn-chip button {
          width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent;
          display: grid; place-items: center; color: var(--adm-muted); cursor: pointer;
        }
        .zn-chip button:hover { background: rgba(255, 255, 255, 0.08); color: var(--adm-text); }
        .zn-nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: end; }
        .zn-unit { position: relative; }
        .zn-unit > span { position: absolute; top: 50%; transform: translateY(-50%); font-size: 13.5px; color: var(--adm-faint); pointer-events: none; }
        .zn-unit > .zn-pre { left: 12px; }
        .zn-unit > .zn-suf { right: 12px; }
        .zn-unit input { -moz-appearance: textfield; }
        .zn-unit input::-webkit-outer-spin-button, .zn-unit input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .zn-h4 { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--adm-muted); }
        .zn-li { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--adm-border); }
        .zn-dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
        @media (max-width: 1100px) {
          .zn-thead { display: none !important; }
          .zn-row { display: flex; flex-wrap: wrap; gap: 6px 16px; }
          .zn-row > :nth-child(1), .zn-row > :nth-child(2) { flex: 1 1 100%; }
          .zn-num { text-align: left; }
          .zn-lbl { display: inline; }
          .zn-row .zn-real { display: inline; margin-left: 6px; }
        }
        @media (max-width: 860px) { .zn-edit { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 520px) { .zn-nums { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Zonas"
        subtitle="Dónde opera MAQSER24, en grupos de municipios: con qué flete y recargo se cotiza cada zona, cuáles se anuncian en el sitio y qué tan cubiertas están."
        actions={<Btn variant="primary" icon="ph-plus" onClick={() => setEditor({ zona: null })}>Nueva zona</Btn>}
      />

      <AvisoDiseno falta="Para conectarla falta que el cotizador y la cobertura lean las zonas de aquí en vez de sus propias listas." />

      <Stats>
        <Stat label="Zonas activas" icon="ph-map-pin-area" tone="accent" value={activas.length} hint={`de ${filas.length} · ${filas.length - activas.length} ${filas.length - activas.length === 1 ? 'pausada' : 'pausadas'}`} />
        <Stat
          label="Municipios cubiertos"
          icon="ph-buildings"
          tone="info"
          value={`${municipiosActivos - huecosActivos} de ${municipiosActivos}`}
          hint={huecosActivos > 0 ? `${huecosActivos} sin aliado` : 'todos con aliado'}
          hintTone={huecosActivos > 0 ? 'warn' : 'ok'}
          title="Municipios de las zonas activas que al menos un aliado tiene en su lista"
        />
        <Stat label="Anunciadas en el sitio" icon="ph-globe-simple" tone="ok" value={enSitio.length} hint={`${municipiosSitio.length} municipios · ${entidadesDe(municipiosSitio)}`} />
        <Stat
          label="Aliados por zona"
          icon="ph-handshake"
          tone="muted"
          value={promedioAliados.toLocaleString('es-MX', { maximumFractionDigits: 1 })}
          hint={deUnSolo > 0 ? `${deUnSolo} zonas con uno solo` : 'promedio en zonas activas'}
          hintTone={deUnSolo > 0 ? 'warn' : undefined}
          title="Promedio de aliados que cubren al menos un municipio de cada zona activa"
        />
      </Stats>

      <Toolbar end={`${visibles.length} de ${filas.length}`}>
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar zona o municipio…" aria-label="Buscar zona o municipio" />
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          ariaLabel="Filtrar por estado"
          items={[
            { key: 'todas', label: 'Todas', count: filas.length },
            { key: 'sitio', label: 'En el sitio', count: filas.filter((f) => f.estado === 'sitio').length },
            { key: 'interna', label: 'Solo interna', count: filas.filter((f) => f.estado === 'interna').length },
            { key: 'pausada', label: 'Pausadas', count: filas.filter((f) => f.estado === 'pausada').length },
          ]}
        />
      </Toolbar>

      <Panel
        flush
        clip
        footer={
          <span>
            Flete base por viaje de volteo 14 m³ puesto en obra, sin IVA · recargo sobre renta y flete de maquinaria · respuesta objetivo y, debajo, la real
            (mediana de 90 días) · solicitudes de los últimos 90 días.
          </span>
        }
      >
        <div className="adm-thead zn-row zn-thead">
          <div>Zona</div>
          <div>Municipios</div>
          <div className="zn-num" title="Flete base por viaje">Flete</div>
          <div className="zn-num" title="Recargo de maquinaria">Recargo</div>
          <div className="zn-num" title="Tiempo de respuesta objetivo">Respuesta</div>
          <div className="zn-num" title="Aliados activos que cubren la zona">Aliados</div>
          <div className="zn-num" title="Solicitudes de los últimos 90 días">Solicitudes</div>
          <div>Estado</div>
        </div>
        {visibles.length === 0 ? (
          sueltos.length > 0 ? (
            <EmptyState
              icon="ph-map-pin-simple-area"
              title={`${sueltos.join(', ')} ${sueltos.length === 1 ? 'no está' : 'no están'} en ninguna zona`}
              sub="Se puede cotizar a mano, pero sin flete ni recargo de zona, y el sitio no lo anuncia."
            >
              <Btn icon="ph-plus" onClick={() => setEditor({ zona: null, municipios: sueltos })}>Crear zona con {sueltos.length === 1 ? sueltos[0] : 'ellos'}</Btn>
            </EmptyState>
          ) : (
            <EmptyState icon="ph-map-trifold" title="Nada por aquí" sub="Prueba con otro filtro o búsqueda." />
          )
        ) : visibles.map((f) => {
          const e = ESTADO[f.estado];
          const tarde = f.respuestaReal > f.respuestaObjetivo;
          return (
            <div
              key={f.id}
              className="adm-trow zn-row"
              role="button"
              tabIndex={0}
              onClick={() => abrir(f)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(f); } }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">{f.nombre}</div>
                <div className="adm-cell-sub">{f.entidad}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--adm-text)' }}>
                  <span className="adm-num">{f.municipios.length}</span> municipios
                  {f.huecos.length > 0 ? <span style={{ color: 'var(--adm-warn)' }}> · {f.huecos.length} sin aliado</span> : null}
                </div>
                <div className="adm-cell-sub adm-ellipsis" title={f.municipios.join(', ')}>{muestraMunicipios(f.municipios, t)}</div>
              </div>
              <div className="zn-num"><span className="zn-lbl">Flete </span>{dinero(f.fleteViaje)}</div>
              <div className="zn-num" style={f.recargoMaquinaria === 0 ? { color: 'var(--adm-faint)' } : undefined}>
                <span className="zn-lbl">Recargo </span>{f.recargoMaquinaria}%
              </div>
              <div className="zn-num">
                <span className="zn-lbl">Respuesta </span>{horas(f.respuestaObjetivo)}
                <div className="adm-cell-sub zn-real" style={tarde ? { color: 'var(--adm-warn)' } : undefined} title="Mediana de los últimos 90 días">
                  real {horas(f.respuestaReal)}
                </div>
              </div>
              <div className="zn-num" style={f.aliados <= 1 ? { color: 'var(--adm-warn)' } : undefined} title={f.aliados <= 1 ? 'Depende de un solo aliado' : undefined}>
                <span className="zn-lbl">Aliados </span>{f.aliados}
              </div>
              <div className="zn-num"><span className="zn-lbl">Solicitudes </span>{f.solicitudes90}</div>
              <div><StatusText tone={e.tono} title={e.ayuda}>{e.texto}</StatusText></div>
            </div>
          );
        })}
      </Panel>

      <Note style={{ marginTop: 20 }}>
        <b style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Para qué sirve una zona.</b> Agrupa municipios para cotizar fletes, decidir qué se anuncia en el
        sitio y medir cobertura. Cada municipio va en una sola zona; un aliado puede cubrir varias.
      </Note>

      {editor ? (
        <EditorZona
          key={editor.zona?.id ?? 'nueva'}
          zona={editor.zona}
          municipiosIniciales={editor.municipios}
          onCerrar={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}

/* ── Editor de una zona (o una nueva) ─────────────────────────────────── */

function EditorZona({ zona, municipiosIniciales, onCerrar }: { zona: Zona | null; municipiosIniciales?: string[]; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '');
  // Una zona nueva nace "Solo interna": se anuncia cuando alguien la revisa, no al crearla.
  const [estado, setEstado] = useState<EstadoZona>(zona?.estado ?? 'interna');
  const [municipios, setMunicipios] = useState<string[]>(zona?.municipios ?? municipiosIniciales ?? []);
  const [flete, setFlete] = useState(zona ? String(zona.fleteViaje) : '');
  const [recargo, setRecargo] = useState(zona ? String(zona.recargoMaquinaria) : '');
  const [respuesta, setRespuesta] = useState(zona ? String(zona.respuestaObjetivo) : '');
  const [nuevo, setNuevo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  function agregar() {
    const t = normalizar(nuevo);
    if (!t) return;
    const m = MUNICIPIOS.find((x) => normalizar(x.nombre) === t);
    if (!m) { setAviso(`«${nuevo.trim()}» no está en el catálogo de municipios. Escríbelo como aparece en la lista.`); return; }
    if (municipios.includes(m.nombre)) { setAviso(`${m.nombre} ya está en esta zona.`); return; }
    setMunicipios([...municipios, m.nombre]);
    setNuevo('');
    setAviso(null);
  }

  const cubren = useMemo(() => aliadosQueCubren(municipios), [municipios]);
  const huecos = useMemo(() => sinAliado(municipios), [municipios]);

  // Memorizado: MapaCobertura rehace el mapa cada vez que cambia la referencia de `puntos`.
  const puntos = useMemo<PuntoMapa[]>(() => [
    // Aliados primero: su círculo queda debajo de los puntos de los municipios.
    ...cubren.map((a) => ({ id: a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, radioKm: a.radioKm, tipo: 'aliado' as const, detalle: `${a.base} · ${a.lineas}` })),
    ...municipios.flatMap((n, i) => {
      const m = municipioDe(n);
      if (!m) return [];
      const k = aliadosDeMunicipio(n).length;
      return [{ id: 1000 + i, nombre: n, lat: m.lat, lng: m.lng, tipo: 'obra' as const, detalle: k === 0 ? 'Ningún aliado lo cubre' : `Lo ${k === 1 ? 'cubre 1 aliado' : `cubren ${k} aliados`}` }];
    }),
  ], [cubren, municipios]);

  // Un municipio va en una sola zona: si ya está en otra, al guardar se mueve.
  const movidos = municipios
    .map((n) => ({ n, z: ZONAS.find((z) => z.id !== zona?.id && z.municipios.includes(n)) }))
    .filter((x): x is { n: string; z: Zona } => Boolean(x.z));

  // Anunciar una zona de un estado que el sitio no anuncia es abrir ese estado en el sitio.
  const nuevosEnSitio = estado === 'sitio'
    ? [...new Set(municipios.map((n) => municipioDe(n)?.entidad).filter((e): e is NonNullable<typeof e> => Boolean(e) && !(ESTADOS_COBERTURA as readonly string[]).includes(e as string)))]
    : [];

  const enLista = (l: readonly string[]) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);

  /** Por qué un municipio no tiene aliado: alguien llega pero no lo tiene en su lista, o nadie llega. */
  function porQueSinAliado(n: string) {
    const m = municipioDe(n);
    if (!m) return 'No está en el catálogo de municipios.';
    const conDistancia = ALIADOS.map((a) => ({ a, km: Math.round(kmEntre(a, m)) })).sort((x, y) => x.km - y.km);
    const dentro = conDistancia.find((x) => x.km <= x.a.radioKm);
    if (dentro) return `Queda dentro del alcance de ${dentro.a.nombre} (${dentro.km} km), pero no lo tiene en su lista.`;
    const cerca = conDistancia[0];
    return `Nadie llega. El aliado más cercano, ${cerca.a.nombre}, está a ${cerca.km} km en línea recta.`;
  }

  return (
    <Modal
      abierto
      titulo={zona ? zona.nombre : 'Nueva zona'}
      subtitulo={zona
        ? `${entidadesDe(zona.municipios)} · ${zona.solicitudes90} solicitudes en 90 días · actualizada el ${fechaCorta(zona.actualizada)} por ${zona.actualizadaPor}`
        : 'Un grupo de municipios que se cotiza con el mismo flete y recargo.'}
      onCerrar={onCerrar}
      ancho={940}
      pie={
        <>
          {zona && zona.estado !== 'pausada' ? <Btn variant="ghost" icon="ph-pause" onClick={() => accionDeDiseno(`Pausar ${zona.nombre}`)}>Pausar zona</Btn> : null}
          {zona && zona.estado === 'pausada' ? <Btn variant="ghost" icon="ph-play" onClick={() => accionDeDiseno(`Reactivar ${zona.nombre}`)}>Reactivar</Btn> : null}
          <Btn variant="primary" icon="ph-check" onClick={() => accionDeDiseno(zona ? 'Guardar zona' : 'Crear zona')}>{zona ? 'Guardar' : 'Crear zona'}</Btn>
        </>
      }
    >
      <div className="zn-edit">
        {/* Izquierda: lo que se edita. */}
        <div className="zn-col">
          <FormField label="Nombre">
            <input className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Periferia oriente" />
          </FormField>

          {/* Un div y no FormField (<label>): un label que envuelve botones "hace clic" en el primero al tocar su texto. */}
          <div className="adm-field">
            <span className="adm-label">Estado</span>
            <div>
              <Segmented<EstadoZona>
                value={estado}
                onChange={setEstado}
                ariaLabel="Estado de la zona"
                items={[
                  { key: 'sitio', label: 'En el sitio' },
                  { key: 'interna', label: 'Solo interna' },
                  { key: 'pausada', label: 'Pausada' },
                ]}
              />
            </div>
            <span className="adm-help">{ESTADO[estado].ayuda}</span>
            {zona?.nota && estado === zona.estado ? <span className="adm-help" style={{ color: 'var(--adm-text-2)' }}>{zona.nota}</span> : null}
          </div>

          {nuevosEnSitio.length > 0 ? (
            <Note tone="info">
              Anunciarla agrega {enLista(nuevosEnSitio)} al sitio, que hoy solo anuncia {enLista(ESTADOS_COBERTURA)}.
            </Note>
          ) : null}

          <div className="adm-field">
            <span className="adm-label">
              Municipios <span className="adm-num" style={{ color: 'var(--adm-faint)' }}>{municipios.length}</span>
            </span>
            {municipios.length > 0 ? (
              <div className="zn-chips">
                {municipios.map((n) => (
                  <span key={n} className="adm-chip zn-chip">
                    {n}
                    <button type="button" aria-label={`Quitar ${n}`} title={`Quitar ${n}`} onClick={() => setMunicipios(municipios.filter((x) => x !== n))}>
                      <i className="ph ph-x" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="adm-help">Todavía ninguno.</span>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <input
                className="adm-input"
                list="zn-catalogo"
                value={nuevo}
                onChange={(e) => { setNuevo(e.target.value); setAviso(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                placeholder="Agregar municipio…"
                aria-label="Agregar municipio"
              />
              <Btn icon="ph-plus" onClick={agregar}>Agregar</Btn>
            </div>
            {/* Sugerencias: el catálogo, diciendo si el municipio ya está en otra zona. */}
            <datalist id="zn-catalogo">
              {MUNICIPIOS.filter((m) => !municipios.includes(m.nombre)).map((m) => {
                const otra = ZONAS.find((z) => z.id !== zona?.id && z.municipios.includes(m.nombre));
                return <option key={m.nombre} value={m.nombre} label={otra ? `${m.entidad} · en ${otra.nombre}` : `${m.entidad} · sin zona`} />;
              })}
            </datalist>
            {aviso ? <span className="adm-help" style={{ color: 'var(--adm-warn)' }}>{aviso}</span> : null}
          </div>

          {movidos.length > 0 ? (
            <Note tone="warn">
              {movidos.map((x, i) => (
                <span key={x.n}>{i > 0 ? '; ' : ''}<b style={{ fontWeight: 600 }}>{x.n}</b> está en {x.z.nombre}</span>
              ))}
              . Al guardar {movidos.length === 1 ? 'pasa' : 'pasan'} a esta zona: un municipio va en una sola.
            </Note>
          ) : null}

          <div>
            <div className="zn-nums">
              <FormField label="Flete base por viaje">
                <ConUnidad pre="$" value={flete} onChange={(e) => setFlete(e.target.value)} placeholder="2,200" step={100} />
              </FormField>
              <FormField label="Recargo maquinaria">
                <ConUnidad suf="%" value={recargo} onChange={(e) => setRecargo(e.target.value)} placeholder="0" max={100} />
              </FormField>
              <FormField label="Respuesta objetivo">
                <ConUnidad suf="h" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="4" />
              </FormField>
            </div>
            <p className="adm-help" style={{ margin: '8px 0 0' }}>
              El flete es por viaje de volteo 14 m³ puesto en obra, sin IVA. El recargo se suma a la renta y al flete de maquinaria. La respuesta se
              mide de la solicitud a la primera propuesta.
            </p>
          </div>
        </div>

        {/* Derecha: cómo queda cubierta, al momento. */}
        <div className="zn-col" style={{ gap: 10 }}>
          {puntos.length > 0 ? (
            <MapaCobertura puntos={puntos} alto={220} />
          ) : (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', border: '1px solid var(--adm-border)', borderRadius: 12 }}>
              <EmptyState icon="ph-map-trifold" title="Sin municipios todavía" sub="Agrega municipios para verlos en el mapa." />
            </div>
          )}
          <div className="adm-meta" style={{ marginTop: 0 }}>
            <span><span className="zn-dot" style={{ background: COLOR_MUNICIPIO }} aria-hidden />Municipio de la zona</span>
            <span><span className="zn-dot" style={{ background: COLOR_ALIADO }} aria-hidden />Aliado y hasta dónde llega</span>
          </div>

          <section style={{ marginTop: 6 }}>
            <h3 style={H3}>En esta zona</h3>

            <div className="zn-h4">Aliados que la cubren <span className="adm-num" style={{ color: 'var(--adm-faint)' }}>{cubren.length}</span></div>
            {cubren.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 0', borderTop: '1px solid var(--adm-border)', fontSize: 13.5, color: 'var(--adm-faint)' }}>
                {municipios.length === 0 ? 'Aparecen al agregar municipios.' : 'Ningún aliado tiene estos municipios en su lista.'}
              </p>
            ) : cubren.map((a) => {
              const cuantos = a.municipios.filter((m) => municipios.includes(m)).length;
              return (
                <div key={a.id} className="zn-li">
                  <div style={{ minWidth: 0 }}>
                    <div className="adm-ellipsis" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{a.nombre}</div>
                    <div className="adm-cell-sub">{a.base} · {a.lineas}</div>
                  </div>
                  <span className="adm-num" style={{ flexShrink: 0, fontSize: 13, color: 'var(--adm-text-2)' }}>
                    {cuantos === municipios.length ? 'todos' : `${cuantos} de ${municipios.length}`}
                  </span>
                </div>
              );
            })}

            {municipios.length > 0 && huecos.length === 0 ? (
              <div style={{ marginTop: 12 }}><StatusText tone="ok">Todos tienen aliado</StatusText></div>
            ) : null}

            {huecos.length > 0 ? (
              <>
                <div className="zn-h4" style={{ color: 'var(--adm-warn)' }}>Sin aliado <span className="adm-num">{huecos.length}</span></div>
                {huecos.map((n) => (
                  <div key={n} className="zn-li">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-warn)' }}>{n}</div>
                      <div className="adm-cell-sub" style={{ lineHeight: 1.5 }}>{porQueSinAliado(n)}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <Btn size="sm" variant="ghost" icon="ph-magnifying-glass" onClick={() => accionDeDiseno('Buscar aliado para los municipios sin cobertura')}>
                    Buscar aliado
                  </Btn>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </Modal>
  );
}

/** Campo numérico con su unidad dentro ($, %, h). */
function ConUnidad({ pre, suf, style, ...props }: InputHTMLAttributes<HTMLInputElement> & { pre?: string; suf?: string }) {
  return (
    <div className="zn-unit">
      {pre ? <span className="zn-pre" aria-hidden>{pre}</span> : null}
      <input
        className="adm-input adm-num"
        type="number"
        inputMode="decimal"
        min={0}
        {...props}
        style={{ ...style, paddingLeft: pre ? 24 : undefined, paddingRight: suf ? 30 : undefined }}
      />
      {suf ? <span className="zn-suf" aria-hidden>{suf}</span> : null}
    </div>
  );
}

const H3 = { margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' } as const;
