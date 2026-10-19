'use client';

import { useMemo, useState } from 'react';
import { FACTOR_CARRETERA } from '@maqserv/config';
import { Modal } from '@/components/Modal';
import { Btn, Chip, EmptyState, Note, PageHeader, Panel, Segmented, Stat, Stats, StatusText, Switch, Toolbar, type Tone } from '@/components/ui';
import { MapaCobertura, type PuntoMapa } from '@/app/proveedores/MapaCobertura';
import {
  LINEAS, ORDEN_LINEAS, alcance, fechaCorta, kmTexto,
  type Aliado, type DatosCobertura, type LineaId, type Municipio, type MunicipioId, type Solicitud,
} from './cobertura-lib';

/**
 * MAPA Y COBERTURA (diseño 2026-10-09; con datos reales desde 2026-10-14).
 *
 * Documento institucional, sección 17 (geolocalización): relacionar obra,
 * proveedor y cobertura. Aquí, para contestar una pregunta: ¿dónde está la
 * demanda que la red de aliados no alcanza? Cada aliado trae su base y su
 * radio calculado; cada solicitud, su municipio. Al cruzarlos salen los huecos
 * (nadie llega), los riesgos (llega uno solo: si está ocupado, se pierde la
 * venta) y, con eso, dónde reclutar.
 *
 * La cobertura se mide POR LÍNEA: que un fletero llegue a Santiago no sirve
 * de nada si lo que ahí piden es una excavadora. Con "Todas", cada municipio
 * toma el estado de su línea más débil. "Bien cubierto" es con 2 o más
 * aliados: la propuesta de la pregunta 6.2 del documento para Dirección.
 */

type Filtro = 'todas' | LineaId;
type Nivel = 'sin' | 'uno' | 'bien';

const NIVEL: Record<Nivel, { texto: string; tono: Tone; orden: number }> = {
  sin: { texto: 'Sin cobertura', tono: 'bad', orden: 0 },
  uno: { texto: 'Depende de uno', tono: 'warn', orden: 1 },
  bien: { texto: 'Bien cubierto', tono: 'ok', orden: 2 },
};
const nivelDe = (aliados: number): Nivel => (aliados === 0 ? 'sin' : aliados === 1 ? 'uno' : 'bien');

/** Los colores de los marcadores de MapaCobertura, para la leyenda. */
const AZUL_ALIADO = '#008CFF';
const AMBAR_OBRA = '#E0A32E';

const GRID = 'minmax(0,1.1fr) 104px minmax(0,1.45fr) minmax(0,1fr) minmax(0,1.15fr)';

const ESTADO_SOL: Record<Solicitud['estado'], { texto: string; tono: Tone }> = {
  cubierta: { texto: 'Se cubrió', tono: 'ok' },
  pendiente: { texto: 'Sin aliado todavía', tono: 'warn' },
  perdida: { texto: 'No se cubrió', tono: 'bad' },
};

interface Llegada { aliado: Aliado; km: number | null; como: 'lista' | 'distancia' }

interface CoberturaLinea {
  linea: LineaId;
  solicitudes: number;
  llegan: Llegada[];
  nivel: Nivel;
  /** El más cercano que NO llega y cuántos km le faltan: a quién pedirle que amplíe su zona. */
  cercaFuera: { aliado: Aliado; km: number; faltan: number } | null;
}

interface FilaMunicipio {
  m: Municipio;
  /** Las más nuevas primero. */
  sols: Solicitud[];
  sinCubrir: number;
  /** Solo las líneas que tienen demanda ahí, la más débil primero. */
  lineas: CoberturaLinea[];
  nivel: Nivel;
  /** Los que llegan para alguna de sus líneas, el más cercano primero. */
  aliados: Llegada[];
  cercano: { aliado: Aliado; km: number | null; llega: boolean } | null;
}

/** Sin ubicar, al final de "el más cercano". */
const kmOrden = (km: number | null) => km ?? Number.POSITIVE_INFINITY;

function filasDe(d: DatosCobertura, lineas: readonly LineaId[]): FilaMunicipio[] {
  const obraMuni = new Map(d.obras.map((o) => [o.id, o.municipio]));
  const filas: FilaMunicipio[] = [];
  for (const m of d.municipios) {
    const sols = d.solicitudes.filter((s) => lineas.includes(s.linea) && obraMuni.get(s.obra) === m.id);
    if (sols.length === 0) continue;

    const porLinea: CoberturaLinea[] = ORDEN_LINEAS.filter((l) => sols.some((s) => s.linea === l))
      .map((l) => {
        const deLinea = d.aliados.filter((a) => a.lineas.includes(l)).map((a) => ({ aliado: a, ...alcance(a, m) }));
        const llegan = deLinea.filter((x) => x.llega).map(({ aliado, km, como }) => ({ aliado, km, como })).sort((a, b) => kmOrden(a.km) - kmOrden(b.km));
        const fuera = deLinea.filter((x) => !x.llega && x.km != null && x.aliado.radioKm != null).sort((a, b) => kmOrden(a.km) - kmOrden(b.km))[0];
        return {
          linea: l,
          solicitudes: sols.filter((s) => s.linea === l).length,
          llegan,
          nivel: nivelDe(llegan.length),
          cercaFuera: fuera && fuera.km != null ? { aliado: fuera.aliado, km: fuera.km, faltan: fuera.km - (fuera.aliado.radioKm ?? 0) } : null,
        };
      })
      .sort((a, b) => NIVEL[a.nivel].orden - NIVEL[b.nivel].orden || b.solicitudes - a.solicitudes);

    const unicos = new Map<number, Llegada>();
    for (const l of porLinea) for (const x of l.llegan) if (!unicos.has(x.aliado.id)) unicos.set(x.aliado.id, x);
    const aliados = [...unicos.values()].sort((a, b) => kmOrden(a.km) - kmOrden(b.km));

    // Si nadie llega, "el más cercano" es el que se queda más cerca de llegar.
    const fueras = porLinea.map((l) => l.cercaFuera).filter((x): x is NonNullable<typeof x> => x !== null).sort((a, b) => a.km - b.km);
    const cercano = aliados[0] ? { aliado: aliados[0].aliado, km: aliados[0].km, llega: true }
      : fueras[0] ? { aliado: fueras[0].aliado, km: fueras[0].km, llega: false } : null;

    filas.push({
      m,
      sols: [...sols].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      sinCubrir: sols.filter((s) => s.estado !== 'cubierta').length,
      lineas: porLinea,
      nivel: porLinea[0].nivel,
      aliados,
      cercano,
    });
  }
  // Riesgo primero; dentro de cada grupo, donde más se pide.
  return filas.sort((a, b) => NIVEL[a.nivel].orden - NIVEL[b.nivel].orden || b.sols.length - a.sols.length || a.m.nombre.localeCompare(b.m.nombre));
}

const sol = (n: number) => (n === 1 ? 'solicitud' : 'solicitudes');
const cortos = (ls: CoberturaLinea[]) => ls.map((l) => LINEAS[l.linea]?.corto ?? l.linea).join(', ');

/** La razón del estado, en pocas palabras, para debajo del punto de color. */
function porQue(f: FilaMunicipio, filtro: Filtro): string {
  if (f.nivel === 'sin') return filtro === 'todas' ? `Falta ${cortos(f.lineas.filter((l) => l.nivel === 'sin'))}` : 'Nadie llega';
  if (f.nivel === 'uno') {
    const uno = f.lineas.filter((l) => l.nivel === 'uno');
    if (uno.length > 1) return `Uno solo en ${cortos(uno)}`;
    return `Solo ${uno[0].llegan[0].aliado.corto}${filtro === 'todas' ? ` en ${LINEAS[uno[0].linea]?.corto ?? ''}` : ''}`;
  }
  return filtro === 'todas' && f.lineas.length > 1 ? '2 o más en cada línea' : `${f.lineas[0].llegan.length} aliados llegan`;
}

/** Lo que falta en una línea floja: quién llega, o a quién le falta poco. */
function textoFalta(l: CoberturaLinea): string {
  if (l.nivel === 'uno') return `solo llega ${l.llegan[0].aliado.nombre}`;
  if (!l.cercaFuera) return 'nadie en la red ofrece esta línea cerca';
  return `nadie llega; al más cercano, ${l.cercaFuera.aliado.nombre}, le faltan ${Math.ceil(l.cercaFuera.faltan)} km`;
}

export function Cobertura({ datos }: { datos: DatosCobertura }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [verAliados, setVerAliados] = useState(true);
  const [verObras, setVerObras] = useState(true);
  const [viendo, setViendo] = useState<MunicipioId | null>(null);

  const muni = useMemo(() => new Map(datos.municipios.map((m) => [m.id, m])), [datos]);
  const lineas = useMemo<readonly LineaId[]>(() => (filtro === 'todas' ? ORDEN_LINEAS : [filtro]), [filtro]);
  const filas = useMemo(() => filasDe(datos, lineas), [datos, lineas]);

  const bien = filas.filter((f) => f.nivel === 'bien');
  const uno = filas.filter((f) => f.nivel === 'uno');
  const sin = filas.filter((f) => f.nivel === 'sin');
  const sumaSols = (fs: FilaMunicipio[]) => fs.reduce((a, f) => a + f.sols.length, 0);
  const huecos = filas.filter((f) => f.nivel !== 'bien');

  // Memorizado a propósito: MapaCobertura rehace el mapa cada vez que recibe
  // un arreglo nuevo, y sin esto lo rehacía en cada render.
  const puntos = useMemo<PuntoMapa[]>(() => {
    const p: PuntoMapa[] = [];
    if (verAliados) {
      for (const a of datos.aliados) {
        if (a.lat == null || a.lng == null || a.fuera) continue;
        if (!a.lineas.some((l) => lineas.includes(l))) continue;
        const base = a.municipio ? muni.get(a.municipio)?.nombre : null;
        p.push({
          id: a.id,
          nombre: a.nombre,
          lat: a.lat,
          lng: a.lng,
          tipo: 'aliado',
          // El radio es por carretera y el mapa lo dibuja en línea recta. Sin
          // convertirlo, el círculo sale ~30% más grande que su alcance real y
          // tapa justo los huecos que esta pantalla existe para enseñar.
          radioKm: a.radioKm != null ? Math.round(a.radioKm / FACTOR_CARRETERA) : null,
          detalle: `${a.lineas.map((l) => LINEAS[l]?.corto ?? l).join(', ') || 'Sin línea'}${base ? ` · base en ${base}` : ''}${a.radioKm != null ? ` · ${a.radioKm} km por carretera` : ''}`,
        });
      }
    }
    if (verObras) {
      // Ids de obra aparte de los de aliado: Leaflet no los usa, React sí.
      let n = 1_000_000;
      for (const o of datos.obras) {
        const ss = datos.solicitudes.filter((s) => s.obra === o.id && lineas.includes(s.linea));
        if (ss.length === 0) continue;
        const m = muni.get(o.municipio);
        if (!m) continue;
        const sinCubrir = ss.filter((s) => s.estado !== 'cubierta').length;
        p.push({
          id: n++,
          nombre: o.nombre,
          lat: o.lat ?? m.lat,
          lng: o.lng ?? m.lng,
          tipo: 'obra',
          detalle: `${o.cliente} · ${m.nombre} · ${ss.length} ${sol(ss.length)}${sinCubrir ? `, ${sinCubrir} sin aliado` : ''}${o.lat === null ? ' · sin coordenadas: va en el centro del municipio' : ''}`,
        });
      }
    }
    return p;
  }, [datos, muni, lineas, verAliados, verObras]);

  const nAliados = puntos.filter((p) => p.tipo === 'aliado').length;
  const nObras = puntos.filter((p) => p.tipo === 'obra').length;
  const sinCoordenadas = verObras
    ? datos.obras.filter((o) => o.lat === null && datos.solicitudes.some((s) => s.obra === o.id && lineas.includes(s.linea))).length
    : 0;
  const vacio = datos.aliados.length === 0 && datos.solicitudes.length === 0;

  const fila = viendo ? filas.find((f) => f.m.id === viendo) ?? null : null;

  return (
    <div>
      <style>{`
        .cv-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        .cv-row.adm-trow { cursor: pointer; }
        .cv-num { text-align: right; font-variant-numeric: tabular-nums; }
        .cv-movil { display: none; }
        .cv-etq { margin-right: 6px; font-size: 12px; font-weight: 400; color: var(--adm-faint); }
        .cv-aside { font-size: 13px; color: var(--adm-muted); white-space: nowrap; }
        .cv-capas { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .cv-leyenda { display: flex; align-items: center; gap: 6px 16px; flex-wrap: wrap; margin-top: 12px; font-size: 12.5px; color: var(--adm-muted); }
        .cv-leyenda > span { display: inline-flex; align-items: center; gap: 6px; }
        .cv-leyenda i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
        .cv-mapa-vacio { display: grid; place-items: center; border: 1px solid var(--adm-border); border-radius: 12px; }
        .cv-hueco { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 20px; padding: 16px 20px; border-bottom: 1px solid var(--adm-border); }
        .cv-hueco:last-child { border-bottom: 0; }
        .cv-link { background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--adm-text); text-align: left; transition: color .15s ease; }
        .cv-link:hover { color: var(--adm-accent); }
        .cv-faltas { display: grid; gap: 7px; margin-top: 10px; }
        .cv-falta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: 13px; line-height: 1.5; color: var(--adm-text-2); }
        .cv-mrow { display: grid; gap: 4px 14px; align-items: center; padding: 9px 0; border-top: 1px solid var(--adm-border); font-size: 13.5px; }
        .cv-mrow-linea { grid-template-columns: minmax(0, 1.3fr) 100px minmax(0, 1.3fr) 128px; }
        .cv-mrow-aliado { grid-template-columns: minmax(0, 1fr) auto; }
        .cv-mrow-sol { grid-template-columns: 116px minmax(0, 1fr) 148px; align-items: start; }
        @media (max-width: 1000px) {
          .cv-thead { display: none !important; }
          .cv-row { display: flex; flex-wrap: wrap; gap: 6px 20px; }
          .cv-row > * { max-width: 100%; }
          .cv-row > :first-child { flex: 1 1 100%; }
          .cv-num { text-align: left; }
          .cv-movil { display: inline; }
        }
        @media (max-width: 760px) {
          .cv-hueco { flex-direction: column; padding-left: 16px; padding-right: 16px; }
        }
        @media (max-width: 640px) {
          .cv-mrow-linea, .cv-mrow-sol { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      <PageHeader
        eyebrow={['2 · Cotizar', 'Geolocalización']}
        title="Mapa y cobertura"
        subtitle="Dónde llega la red de aliados contra dónde está la demanda de los últimos 90 días, para ver los huecos y saber dónde reclutar."
        actions={<Btn href="/proveedores" icon="ph-handshake">Ver aliados</Btn>}
      />

      {vacio ? (
        <Note style={{ marginBottom: 20 }}>
          Todavía no hay aliados activos ni solicitudes en los últimos 90 días. El mapa se llena solo: al dar de alta aliados en
          Proveedores (con su dirección y los municipios que cubren) y conforme lleguen solicitudes.
        </Note>
      ) : null}

      <Toolbar
        style={{ marginBottom: 26 }}
        end={
          <div className="cv-capas">
            <Switch on={verAliados} onClick={() => setVerAliados((v) => !v)} label="Aliados" />
            <Switch on={verObras} onClick={() => setVerObras((v) => !v)} label="Obras y solicitudes" />
          </div>
        }
      >
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          ariaLabel="Línea de servicio"
          items={[
            { key: 'todas', label: 'Todas', count: datos.solicitudes.length },
            // Nombre corto para que quepan todas en una fila; el completo, al pasar el cursor.
            ...ORDEN_LINEAS.map((l) => ({
              key: l,
              label: <span title={LINEAS[l].nombre}>{LINEAS[l].corto}</span>,
              count: datos.solicitudes.filter((s) => s.linea === l).length,
            })),
          ]}
        />
      </Toolbar>

      <Stats>
        <Stat label="Municipios con demanda" icon="ph-map-pin" tone="accent" value={filas.length} hint={`${sumaSols(filas)} solicitudes en 90 días`} />
        <Stat label="Bien cubiertos" icon="ph-check-circle" tone="ok" value={bien.length} hint="2 o más aliados" />
        <Stat
          label="Dependen de un solo aliado"
          title="Dependen de un solo aliado: si está ocupado, nadie más llega"
          icon="ph-warning"
          tone="warn"
          value={uno.length}
          hint={`${sumaSols(uno)} solicitudes`}
        />
        <Stat
          label="Sin cobertura"
          icon="ph-warning-circle"
          tone="bad"
          valueTone={sin.length > 0 ? 'bad' : undefined}
          value={sin.length}
          hint={sin.length > 0 ? `${sumaSols(sin)} solicitudes, ${sin.reduce((a, f) => a + f.sinCubrir, 0)} sin aliado` : 'ningún hueco'}
        />
      </Stats>

      <div>
        <Panel
          title="Red de aliados y demanda"
          icon="ph-map-trifold"
          desc="Azul: la base de cada aliado y hasta dónde llega. Ámbar: las obras con solicitudes de los últimos 90 días."
          action={<span className="cv-aside">{nAliados} {nAliados === 1 ? 'aliado' : 'aliados'} · {nObras} {nObras === 1 ? 'obra' : 'obras'}</span>}
        >
          {puntos.length === 0 ? (
            // MapaCobertura sin puntos dice "Nadie está ubicado todavía", que aquí no siempre es cierto.
            <div className="cv-mapa-vacio" style={{ height: 440 }}>
              <EmptyState
                icon="ph-map-trifold"
                title={!verAliados && !verObras ? 'Las dos capas están apagadas' : vacio ? 'Todavía no hay nada que enseñar' : 'Nada que enseñar en esta línea'}
                sub={!verAliados && !verObras ? 'Prende «Aliados» u «Obras y solicitudes» arriba.' : vacio ? 'Aparecerán los aliados ubicados y las obras de las solicitudes.' : 'Ningún aliado ubicado ni obra de esta línea con lo que está prendido.'}
              />
            </div>
          ) : (
            <MapaCobertura puntos={puntos} alto={440} />
          )}
          <div className="cv-leyenda">
            <span><i style={{ background: AZUL_ALIADO }} /> Aliado y hasta dónde llega</span>
            <span><i style={{ background: AMBAR_OBRA }} /> Obra con solicitudes</span>
          </div>
          <p className="adm-help" style={{ margin: '6px 0 0' }}>
            El círculo y el «Llega hasta» de cada globo son el alcance en línea recta; por carretera es 1.32 veces más, y esa es la
            distancia que usan las tablas y el emparejamiento.
            {sinCoordenadas > 0 ? ` ${sinCoordenadas} ${sinCoordenadas === 1 ? 'obra no tiene' : 'obras no tienen'} coordenadas y ${sinCoordenadas === 1 ? 'va' : 'van'} en el centro de su municipio.` : ''}
            {datos.sinUbicar > 0 ? ` ${datos.sinUbicar} ${datos.sinUbicar === 1 ? 'aliado no está ubicado' : 'aliados no están ubicados'}: no ${datos.sinUbicar === 1 ? 'sale' : 'salen'} en el mapa, pero cuenta${datos.sinUbicar === 1 ? '' : 'n'} por los municipios de su lista.` : ''}
            {datos.fueraDelMapa.length > 0 ? ` No aparece${datos.fueraDelMapa.length === 1 ? '' : 'n'} ${datos.fueraDelMapa.map((x) => `${x.nombre}${x.plaza ? ` (${x.plaza})` : ''}`).join(', ')}: su base está a más de 400 km y alejaría el mapa.` : ''}
            {datos.sinUbicacion > 0 ? ` ${datos.sinUbicacion} ${sol(datos.sinUbicacion)} no se ${datos.sinUbicacion === 1 ? 'cuenta' : 'cuentan'}: su ubicación no se reconoció como municipio.` : ''}
          </p>
        </Panel>

        <Panel
          title="Cobertura por municipio"
          icon="ph-list-checks"
          desc="Solicitudes de los últimos 90 días. Primero donde nadie llega y, dentro de cada grupo, donde más se pide. Toca un municipio para ver su detalle."
          flush
          clip
        >
          <div className="adm-thead cv-row cv-thead">
            <div>Municipio</div><div className="cv-num">Solicitudes</div><div>Aliados que llegan</div><div>El más cercano</div><div>Estado</div>
          </div>
          {filas.length === 0 ? (
            <EmptyState icon="ph-map-pin" title={filtro === 'todas' ? 'Sin solicitudes en los últimos 90 días' : 'Sin solicitudes de esta línea'} sub="La cobertura se mide contra la demanda: aparecerá cuando lleguen solicitudes." />
          ) : filas.map((f) => (
            <FilaTabla key={f.m.id} f={f} filtro={filtro} onAbrir={() => setViendo(f.m.id)} />
          ))}
        </Panel>

        <Panel
          title="Huecos para reclutar"
          icon="ph-user-plus"
          desc="Donde nadie llega o todo depende de un aliado: qué línea falta, cuánta demanda hay y quién se queda más cerca."
          action={huecos.length > 0 ? <span className="cv-aside">{huecos.length} {huecos.length === 1 ? 'municipio' : 'municipios'}</span> : null}
          flush
          clip
        >
          {huecos.length === 0 ? (
            <EmptyState
              icon="ph-check-circle"
              title={filas.length === 0 ? 'Sin demanda que medir' : 'Sin huecos en esta línea'}
              sub={filas.length === 0 ? 'Cuando lleguen solicitudes, aquí saldrá dónde falta red.' : 'Cada municipio con demanda tiene al menos dos aliados que llegan.'}
            />
          ) : huecos.map((f) => (
            <div key={f.m.id} className="cv-hueco">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', columnGap: 12 }}>
                  <button type="button" className="cv-link" onClick={() => setViendo(f.m.id)}>{f.m.nombre}</button>
                  <StatusText tone={NIVEL[f.nivel].tono}>{NIVEL[f.nivel].texto}</StatusText>
                </div>
                <div className="adm-meta">
                  <span>{f.sols.length} {sol(f.sols.length)} en 90 días</span>
                  {f.sinCubrir > 0 ? <span style={{ color: 'var(--adm-bad)' }}>{f.sinCubrir} sin aliado</span> : <span>todas cubiertas</span>}
                </div>
                <div className="cv-faltas">
                  {f.lineas.filter((l) => l.nivel !== 'bien').map((l) => (
                    <div key={l.linea} className="cv-falta">
                      <Chip tone={NIVEL[l.nivel].tono}>{LINEAS[l.linea]?.nombre ?? l.linea}</Chip>
                      <span>{l.solicitudes} {sol(l.solicitudes)} · {textoFalta(l)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Btn size="sm" icon="ph-user-plus" href="/proveedores">Agregar aliado</Btn>
            </div>
          ))}
        </Panel>
      </div>

      {fila ? <DetalleMunicipio datos={datos} f={fila} filtro={filtro} onCerrar={() => setViendo(null)} /> : null}
    </div>
  );
}

function FilaTabla({ f, filtro, onAbrir }: { f: FilaMunicipio; filtro: Filtro; onAbrir: () => void }) {
  const n = NIVEL[f.nivel];
  const nombres = f.aliados.map((x) => x.aliado.corto).join(', ');
  return (
    <div
      className="adm-trow cv-row"
      role="button"
      tabIndex={0}
      aria-label={`Ver el detalle de ${f.m.nombre}`}
      onClick={onAbrir}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onAbrir(); } }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="adm-cell-title adm-ellipsis">{f.m.nombre}</div>
        <div className="adm-cell-sub adm-ellipsis">
          {f.m.estado !== 'Nuevo León' ? `${f.m.estado} · ` : ''}{f.lineas.map((l) => LINEAS[l.linea]?.corto ?? l.linea).join(' · ')}
        </div>
      </div>
      <div className="cv-num">
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' }}>
          {f.sols.length}<span className="cv-movil" style={{ fontWeight: 400, color: 'var(--adm-muted)' }}> {sol(f.sols.length)}</span>
        </div>
        <div className="adm-cell-sub" style={f.sinCubrir > 0 ? { color: 'var(--adm-bad)' } : undefined}>
          {f.sinCubrir > 0 ? `${f.sinCubrir} sin aliado` : 'todas cubiertas'}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {f.aliados.length === 0 ? (
          <span style={{ fontSize: 13.5, color: 'var(--adm-faint)' }}><span className="cv-movil cv-etq">Llegan</span>Nadie</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)', flexShrink: 0 }}>
              <span className="cv-movil cv-etq">Llegan</span>{f.aliados.length}
            </span>
            <span className="adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text-2)', minWidth: 0 }} title={nombres}>{nombres}</span>
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        {f.cercano ? (
          <>
            <div className="adm-num" style={{ fontSize: 13.5, color: f.cercano.llega ? 'var(--adm-text)' : 'var(--adm-text-2)' }}>
              <span className="cv-movil cv-etq">Más cercano</span>{kmTexto(f.cercano.km)}
            </div>
            <div className="adm-cell-sub adm-ellipsis">{f.cercano.aliado.corto}{f.cercano.llega ? '' : ' · no llega'}</div>
          </>
        ) : <span style={{ color: 'var(--adm-faint)' }}>—</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <StatusText tone={n.tono}>{n.texto}</StatusText>
        <div className="adm-cell-sub adm-ellipsis">{porQue(f, filtro)}</div>
      </div>
    </div>
  );
}

function DetalleMunicipio({ datos, f, filtro, onCerrar }: { datos: DatosCobertura; f: FilaMunicipio; filtro: Filtro; onCerrar: () => void }) {
  const n = NIVEL[f.nivel];
  const sinNadie = f.lineas.filter((l) => l.nivel === 'sin');
  const muni = new Map(datos.municipios.map((m) => [m.id, m]));
  const obra = new Map(datos.obras.map((o) => [o.id, o]));
  const aliado = new Map(datos.aliados.map((a) => [a.id, a]));
  // Qué líneas de este municipio cubre cada aliado que llega.
  const cubreAqui = (id: number) => f.lineas.filter((l) => l.llegan.some((x) => x.aliado.id === id)).map((l) => LINEAS[l.linea]?.corto ?? l.linea).join(', ');
  return (
    <Modal
      abierto
      titulo={f.m.nombre}
      subtitulo={`${f.m.estado} · ${f.sols.length} ${sol(f.sols.length)} en los últimos 90 días${filtro === 'todas' ? '' : ` · solo ${LINEAS[filtro]?.nombre ?? filtro}`}`}
      onCerrar={onCerrar}
      ancho={720}
      pie={f.nivel !== 'bien' ? <Btn variant="primary" icon="ph-user-plus" href="/proveedores">Agregar aliado</Btn> : null}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusText tone={n.tono}>{n.texto}</StatusText>
          {f.sinCubrir > 0 ? <Chip tone="bad">{f.sinCubrir} sin aliado</Chip> : <Chip tone="ok">Todas cubiertas</Chip>}
          <Chip>{f.aliados.length === 0 ? 'Nadie llega' : `${f.aliados.length} ${f.aliados.length === 1 ? 'aliado llega' : 'aliados llegan'}`}</Chip>
        </div>

        <section>
          <h3 style={H3}>Por línea</h3>
          {f.lineas.map((l) => (
            <div key={l.linea} className="cv-mrow cv-mrow-linea">
              <span style={{ color: 'var(--adm-text)' }}>{LINEAS[l.linea]?.nombre ?? l.linea}</span>
              <span className="adm-num" style={{ color: 'var(--adm-text-2)' }}>{l.solicitudes} {sol(l.solicitudes)}</span>
              <span style={{ minWidth: 0, color: l.llegan.length ? 'var(--adm-text-2)' : 'var(--adm-faint)' }}>
                {l.llegan.length ? l.llegan.map((x) => x.aliado.corto).join(', ') : 'Nadie llega'}
              </span>
              <span><StatusText tone={NIVEL[l.nivel].tono}>{NIVEL[l.nivel].texto}</StatusText></span>
            </div>
          ))}
        </section>

        <section>
          <h3 style={H3}>Aliados que llegan</h3>
          {f.aliados.length === 0 ? (
            <p style={{ ...P, paddingTop: 9, borderTop: '1px solid var(--adm-border)' }}>Nadie de la red llega a {f.m.nombre}.</p>
          ) : f.aliados.map((x) => (
            <div key={x.aliado.id} className="cv-mrow cv-mrow-aliado">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{x.aliado.nombre}</div>
                <div className="adm-cell-sub">
                  {cubreAqui(x.aliado.id)}{x.aliado.municipio && muni.get(x.aliado.municipio) ? ` · base en ${muni.get(x.aliado.municipio)!.nombre}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="adm-num" style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{kmTexto(x.km)}</div>
                {/* Como en el emparejamiento: su lista manda; si no lo escribió, cuenta el radio. */}
                <div className="adm-cell-sub">{x.como === 'lista' ? 'lo tiene en su lista' : 'por distancia'}</div>
              </div>
            </div>
          ))}
          {sinNadie.map((l) => (l.cercaFuera ? (
            <p key={l.linea} style={{ ...P, marginTop: 10 }}>
              Para {(LINEAS[l.linea]?.nombre ?? l.linea).toLowerCase()}, el más cercano es {l.cercaFuera.aliado.nombre}, a {kmTexto(l.cercaFuera.km)} por
              carretera: le faltan {Math.ceil(l.cercaFuera.faltan)} km.
              {l.cercaFuera.faltan <= 10 ? ` Podría bastar con pedirle que agregue ${f.m.nombre} a su lista.` : ' Hace falta alguien de la zona.'}
            </p>
          ) : null))}
        </section>

        <section>
          <h3 style={H3}>Solicitudes recientes</h3>
          {f.sols.map((s) => {
            const o = obra.get(s.obra);
            const a = s.aliado !== null ? aliado.get(s.aliado) : undefined;
            const e = ESTADO_SOL[s.estado];
            return (
              <div key={s.folio} className="cv-mrow cv-mrow-sol">
                <div>
                  <div className="adm-mono" style={{ fontSize: 13, fontWeight: 600 }}>{s.folio}</div>
                  <div className="adm-cell-sub">{fechaCorta(s.fecha)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--adm-text)' }}>{o?.cliente ?? 'Cliente'} <span style={{ color: 'var(--adm-faint)' }}>· {o?.nombre ?? 'Obra'}</span></div>
                  <div className="adm-cell-sub">{LINEAS[s.linea]?.corto ?? s.linea}{s.detalle ? ` · ${s.detalle}` : ''}</div>
                  {s.nota ? <div className="adm-cell-sub" style={{ color: 'var(--adm-text-2)', lineHeight: 1.5 }}>{s.nota}</div> : null}
                </div>
                <div>
                  <StatusText tone={e.tono}>{e.texto}</StatusText>
                  {s.estado === 'cubierta' ? <div className="adm-cell-sub">{a ? `con ${a.corto}` : 'con un aliado dado de baja'}</div> : null}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </Modal>
  );
}

const H3 = { margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' } as const;
const P = { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-text-2)' } as const;
