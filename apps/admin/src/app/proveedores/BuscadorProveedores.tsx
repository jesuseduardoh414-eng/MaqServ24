'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { centroDeMunicipio, kmCarretera, normalizarNombre, presentacionEstado, resumenDetalle } from '@maqserv/config';
import { Btn, Chip, StatusText, btnClass } from '@/components/ui';
import { colorVivo } from '@/components/modo';
import { anotarSolo } from '@/lib/trato';
import type { EquipoRow, ProviderRow } from './ProvidersManager';
import { textoPrecio } from './EquipoDelAliado';
import { waDe } from './wa';

/**
 * LA LIBRETA DE PROVEEDORES: BUSCAR QUIÉN DA UN SERVICIO (2026-11-12).
 *
 * El dueño: "MAQSER24 opera solo, pero si un cliente le pide algún servicio
 * que él no maneje, puede irse a sus proveedores, buscar ese servicio y que
 * aparezcan los proveedores que lo manejan; debe ver toda la información de ese
 * proveedor y de su servicio".
 *
 * Se escribe el servicio («grúa 30 t», «pipa», «retro») y, si se sabe, el
 * municipio de la obra. Salen los proveedores con un equipo que coincide (en su
 * nombre, tipo, línea, marca o ficha técnica), primero los que llegan a esa
 * obra; entre ellos, preferentes, con papeles, con más trabajos hechos con
 * nosotros y con precio capturado. Con cada uno: contacto (llamar y WhatsApp,
 * que se anotan solos en su trato), sus equipos que coinciden con su precio, y
 * su ficha completa. Busca en lo que ya se cargó: no pide nada al servidor.
 *
 * Vive en «Servicios de proveedores» (2026-11-12): Proveedores quedó solo para
 * los proveedores (alta, ficha, papeles); sin nada escrito se ve `sinBuscar`.
 */

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'en', 'y', 'a', 'un', 'una', 'que']);

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();

/** «grúas 30 t» → ['grua', '30'] (sin plurales ni palabras vacías; la «t» suelta no aporta). */
function palabrasDe(q: string): string[] {
  return norm(q)
    .split(' ')
    .filter((w) => w && !PALABRAS_VACIAS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map((w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

const textoDeEquipo = (e: EquipoRow) =>
  norm([e.name, e.tipo, e.category, e.brand, ...(e.specs ?? []).map((s) => `${s.label} ${s.valor}`)].join(' '));

/** La palabra al principio de una palabra del texto: «retro» encuentra «retroexcavadora», «excavadora» no. */
const tiene = (texto: string, w: string) => ` ${texto}`.includes(` ${w}`);

/**
 * Qué tanto coincide (0 = nada). LO PRINCIPAL MANDA (2026-11-12): la primera
 * palabra es lo que se pide («retroexcavadora», «grúa», «pipa») y tiene que
 * estar; las demás («c/ cucharón», «30 t») solo ordenan. Antes se pedían todas
 * y «Retroexcavadora c/ cucharón» no encontraba una «Retroexcavadora 4x4».
 */
function puntosDe(texto: string, palabras: string[]): number {
  if (!palabras.length || !tiene(texto, palabras[0])) return 0;
  return palabras.filter((w) => tiene(texto, w)).length / palabras.length;
}

/**
 * Varias cosas en un pedido (2026-11-12): «Excavadora 20 t c/ martillo, Vibrocompactador 10 t»
 * se busca por partes; un equipo coincide si es cualquiera de ellas (la que mejor).
 */
function partesDe(q: string): string[][] {
  return q.split(/[,;]|\s·\s/).map(palabrasDe).filter((p) => p.length > 0);
}
const mejorPuntos = (texto: string, partes: string[][]) => Math.max(0, ...partes.map((p) => puntosDe(texto, p)));
const coincideAlguna = (texto: string, partes: string[][]) => mejorPuntos(texto, partes) > 0;

export interface Llegada {
  cubre: boolean;
  km: number | null;
}

/** ¿Llega a esa obra? La misma regla que al asignar: su lista de municipios o su radio desde la base. */
export function llegaA(p: ProviderRow, donde: string, centro: { lat: number; lng: number } | null): Llegada | null {
  if (!donde.trim()) return null;
  const z = normalizarNombre(donde);
  const enLista = p.coverage.some((m) => {
    const c = normalizarNombre(m);
    return c.length > 2 && (z.includes(c) || c.includes(z));
  });
  const km = centro && p.lat != null && p.lng != null ? kmCarretera({ lat: p.lat, lng: p.lng }, centro) : null;
  const enRadio = km != null && !!p.coverageRadiusKm && km <= p.coverageRadiusKm;
  return { cubre: enLista || enRadio, km };
}

export interface Resultado {
  p: ProviderRow;
  equipos: EquipoRow[];
  /** Coincide por su línea de servicio, sin un equipo que lo diga. */
  soloLinea: boolean;
  llegada: Llegada | null;
  puntaje: number;
}

/**
 * La búsqueda en sí (la usan la libreta y «Asignar» en Servicios): proveedores
 * activos con un equipo que coincide con el servicio, ordenados. Sin palabras, nada.
 */
export function buscarProveedores(provs: ProviderRow[], servicio: string, donde: string): Resultado[] {
  const partes = partesDe(servicio);
  if (!partes.length) return [];
  const centro = donde.trim() ? centroDeMunicipio(donde) : null;
  const out: Resultado[] = [];
  for (const p of provs) {
    if (p.status !== 1 || p.propio) continue;
    const conPuntos = (p.equipment ?? [])
      .map((e) => ({ e, n: mejorPuntos(textoDeEquipo(e), partes) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    const equipos = conPuntos.map((x) => x.e);
    const soloLinea = !equipos.length && coincideAlguna(norm((p.categoryLabels ?? []).join(' ')), partes);
    if (!equipos.length && !soloLinea) continue;
    const llegada = llegaA(p, donde, centro);
    const conPrecio = equipos.some((e) => textoPrecio(e.precio));
    const puntaje =
      // Lo que más pesa, entre los que llegan: qué tan igual es su equipo a lo pedido.
      (conPuntos[0]?.n ?? 0) * 40 +
      (llegada?.cubre ? 100 : 0) +
      (p.level === 'preferente' ? 30 : 0) +
      (p.verified ? 25 : 0) +
      Math.min(p.trabajos ?? 0, 5) * 6 +
      (conPrecio ? 10 : 0) +
      (equipos.length ? 10 : 0) -
      (llegada?.km != null ? Math.min(llegada.km, 300) / 30 : 0);
    out.push({ p, equipos, soloLinea, llegada, puntaje });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje || a.p.name.localeCompare(b.p.name, 'es'));
}

export function BuscadorProveedores({ provs, servicioInicial = '', dondeInicial = '', onVer, sinBuscar }: {
  provs: ProviderRow[];
  /** Lo que se ve mientras no se escribe nada (todos los servicios). */
  sinBuscar?: ReactNode;
  servicioInicial?: string;
  dondeInicial?: string;
  /** Abrir su ficha completa (expediente), en la pestaña que convenga. */
  onVer: (p: ProviderRow, pestana: 'datos' | 'equipos') => void;
}) {
  const [servicio, setServicio] = useState(servicioInicial);
  const [donde, setDonde] = useState(dondeInicial);
  const caja = useRef<HTMLDivElement>(null);

  // Llegando desde una solicitud («Buscar proveedor»): la búsqueda ya viene escrita y se ve de entrada.
  useEffect(() => {
    if (servicioInicial) caja.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [servicioInicial]);

  const activos = useMemo(() => provs.filter((p) => p.status === 1 && !p.propio), [provs]);

  // Sugerencias: los tipos, líneas y nombres de lo que tiene la libreta; y los municipios que cubren.
  const sugerencias = useMemo(() => {
    const s = new Set<string>();
    for (const p of activos) for (const e of p.equipment ?? []) for (const x of [e.tipo, e.category]) if (x) s.add(x);
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [activos]);
  const municipios = useMemo(() => {
    const s = new Set<string>();
    for (const p of activos) for (const m of p.coverage) if (m.trim()) s.add(m.trim());
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [activos]);

  const palabras = useMemo(() => palabrasDe(servicio), [servicio]);
  const centro = useMemo(() => (donde.trim() ? centroDeMunicipio(donde) : null), [donde]);

  const resultados = useMemo<Resultado[]>(() => buscarProveedores(activos, servicio, donde), [activos, servicio, donde]);

  const llegan = resultados.filter((r) => r.llegada?.cubre).length;
  const lugar = centro?.nombre ?? donde.trim();

  return (
    <section ref={caja} className="bp" aria-label="Buscar proveedor para un servicio" style={{ scrollMarginTop: 80 }}>
      <style>{CSS}</style>
      <div className="bp-cab">
        <i className="ph ph-magnifying-glass" aria-hidden />
        <div>
          <h2 className="bp-tit">Buscar proveedor para un servicio</h2>
          <p className="bp-sub">Para lo que MAQSER24 no maneja: escribe el servicio y, si lo sabes, dónde es la obra.</p>
        </div>
      </div>
      <div className="bp-campos">
        <label className="bp-campo">
          <span>¿Qué servicio buscas?</span>
          <input
            className="adm-input"
            list="bp-servicios"
            value={servicio}
            maxLength={80}
            placeholder="Ej. grúa 30 t, pipa de agua, retroexcavadora"
            onChange={(e) => setServicio(e.target.value)}
          />
        </label>
        <label className="bp-campo">
          <span>¿Dónde es la obra?</span>
          <input
            className="adm-input"
            list="bp-municipios"
            value={donde}
            maxLength={80}
            placeholder="Municipio (opcional)"
            onChange={(e) => setDonde(e.target.value)}
          />
        </label>
        {servicio || donde ? <Btn variant="ghost" icon="ph-x" onClick={() => { setServicio(''); setDonde(''); }}>Limpiar</Btn> : null}
      </div>
      <datalist id="bp-servicios">{sugerencias.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="bp-municipios">{municipios.map((m) => <option key={m} value={m} />)}</datalist>

      {palabras.length ? (
        <>
          <p className="bp-cuenta" role="status">
            {resultados.length === 0
              ? `Nadie en tu libreta da «${servicio.trim()}». Prueba con otra palabra (por ejemplo el tipo de máquina).`
              : `${resultados.length} ${resultados.length === 1 ? 'proveedor da' : 'proveedores dan'} «${servicio.trim()}»${lugar ? ` · ${llegan} ${llegan === 1 ? 'llega' : 'llegan'} a ${lugar}` : ''}.`}
          </p>
          <div className="bp-lista">
            {resultados.map((r) => <Tarjeta key={r.p.id} r={r} servicio={servicio.trim()} lugar={lugar} onVer={onVer} />)}
          </div>
        </>
      ) : sinBuscar ?? null}
    </section>
  );
}

function Tarjeta({ r, servicio, lugar, onVer }: { r: Resultado; servicio: string; lugar: string; onVer: (p: ProviderRow, pestana: 'datos' | 'equipos') => void }) {
  const { p, equipos, llegada } = r;
  const wa = waDe(p.phone);
  const tel = (p.phone ?? '').replace(/[^\d+]/g, '');
  const saludo = p.contactName?.trim() ? ` ${p.contactName.trim().split(' ')[0]}` : '';
  const mensaje = `Hola${saludo}, te escribo de MAQSER24. ¿Tienes disponible ${servicio}${lugar ? ` para una obra en ${lugar}` : ''}? ¿En cuánto me lo dejas?`;
  const trabajos = p.trabajos ?? 0;
  return (
    <article className="bp-t">
      <div className="bp-t-cab">
        <button type="button" className="bp-t-nombre" onClick={() => onVer(p, 'datos')}>{p.name}</button>
        <span className="bp-t-chips">
          {p.level === 'preferente' ? <Chip tone="accent"><i className="ph ph-star" aria-hidden /> Preferente</Chip> : null}
          {p.verified ? <Chip tone="ok"><i className="ph ph-seal-check" aria-hidden /> Papeles al día</Chip> : <Chip tone="warn">Sin sello</Chip>}
          <Chip tone="muted">{trabajos ? `${trabajos} ${trabajos === 1 ? 'trabajo' : 'trabajos'} con nosotros` : 'Aún no trabaja con nosotros'}</Chip>
        </span>
      </div>
      <p className="bp-t-linea">
        {[p.contactName, p.phone, p.city ? `base en ${p.city}` : null].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
        {llegada ? (
          <span className={llegada.cubre ? 'bp-si' : 'bp-no'}>
            {' · '}
            {llegada.cubre ? `Llega a ${lugar}` : `No llega a ${lugar}`}
            {llegada.km != null ? ` (~${Math.round(llegada.km)} km)` : ''}
          </span>
        ) : null}
      </p>

      {equipos.length ? (
        <ul className="bp-eqs">
          {equipos.map((e) => {
            const precio = textoPrecio(e.precio);
            const disp = presentacionEstado(e.availability);
            const n = Math.max(1, e.units ?? 1);
            const ficha = (e.specs ?? []).slice(0, 3).map((s) => `${s.label}: ${s.valor}`).join(' · ');
            return (
              <li key={e.id} className="bp-eq">
                <div className="bp-eq-top">
                  <a className="bp-eq-nombre" href={`/servicios-proveedores/${e.id}`} title="Ver todo lo de este servicio">{e.name}</a>
                  {e.pending ? <Chip tone="warn">Nuevo</Chip> : <StatusText color={colorVivo(disp)} title={disp.nota}>{disp.nombre}</StatusText>}
                </div>
                <span className="bp-eq-sub">
                  {[e.tipo, e.brand, `${n} ${n === 1 ? 'unidad' : 'unidades'}`, e.location, ficha].filter(Boolean).join(' · ')}
                </span>
                <span className={precio ? 'bp-eq-precio' : 'bp-eq-precio bp-sin'}>
                  <i className="ph ph-currency-dollar" aria-hidden />
                  {precio ? <>Cobra {precio}</> : 'Sin precio capturado: pídeselo y anótalo en su ficha'}
                  {e.precioNota ? <span className="bp-eq-nota"> · {e.precioNota}</span> : null}
                </span>
                {resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).length ? <span className="bp-eq-sub">{resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).join(' · ')}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bp-t-linea" style={{ color: 'var(--adm-muted)' }}>Da este servicio, pero todavía no tiene el equipo capturado.</p>
      )}

      <div className="bp-t-acc">
        {/* Enlaces normales (no `Btn href`): así el clic se anota solo en su trato. */}
        {tel ? (
          <a className={btnClass('secondary', 'sm')} href={`tel:${tel}`} onClick={() => void anotarSolo({ aliado: p.id, con: 'aliado', canal: 'llamada', nota: `Por ${servicio}` })}>
            <i className="ph ph-phone" aria-hidden />Llamar
          </a>
        ) : null}
        {wa ? (
          <a
            className={btnClass('secondary', 'sm')}
            href={`https://wa.me/${wa}?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void anotarSolo({ aliado: p.id, con: 'aliado', canal: 'whatsapp', nota: `Por ${servicio}` })}
          >
            <i className="ph ph-whatsapp-logo" aria-hidden />WhatsApp
          </a>
        ) : null}
        <Btn size="sm" variant="ghost" icon="ph-identification-card" onClick={() => onVer(p, 'equipos')}>Ficha completa</Btn>
      </div>
    </article>
  );
}

const CSS = `
.bp { border: 1px solid var(--adm-border); border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; background: var(--adm-surface, transparent); }
.bp-cab { display: flex; gap: 12px; align-items: flex-start; }
.bp-cab > i { font-size: 20px; color: var(--adm-accent); margin-top: 2px; }
.bp-tit { margin: 0; font-size: 16px; font-weight: 650; }
.bp-sub { margin: 2px 0 0; font-size: 13px; color: var(--adm-muted); }
.bp-campos { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; }
.bp-campo { display: grid; gap: 5px; min-width: 0; }
.bp-campo > span { font-size: 12.5px; color: var(--adm-muted); font-weight: 500; }
.bp-cuenta { margin: 14px 0 10px; font-size: 13px; color: var(--adm-muted); }
.bp-lista { display: grid; gap: 10px; }
.bp-t { border: 1px solid var(--adm-border); border-radius: 10px; padding: 12px 14px; display: grid; gap: 8px; }
.bp-t-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.bp-t-nombre { background: none; border: 0; padding: 0; font: inherit; font-size: 15px; font-weight: 650; color: var(--adm-text); cursor: pointer; text-align: left; }
.bp-t-nombre:hover { color: var(--adm-accent); }
.bp-t-chips { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.bp-t-linea { margin: 0; font-size: 13px; color: var(--adm-text); }
.bp-si { color: var(--adm-ok); font-weight: 500; }
.bp-no { color: var(--adm-warn); font-weight: 500; }
.bp-eqs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.bp-eq { display: grid; gap: 3px; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--adm-text) 4%, transparent); }
.bp-eq-top { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.bp-eq-nombre { font-weight: 600; font-size: 13.5px; color: var(--adm-text); text-decoration: none; }
.bp-eq-nombre:hover { color: var(--adm-accent); text-decoration: underline; }
.bp-eq-sub { font-size: 12.5px; color: var(--adm-muted); }
.bp-eq-precio { font-size: 13px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.bp-eq-precio > i { position: relative; top: 2px; color: var(--adm-muted); }
.bp-eq-precio.bp-sin { color: var(--adm-faint); }
.bp-eq-nota { color: var(--adm-muted); }
.bp-t-acc { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 720px) {
  .bp-campos { grid-template-columns: 1fr; }
}
`;
