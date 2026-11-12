'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { presentacionEstado, resumenDetalle } from '@maqserv/config';
import { Btn, Chip, EmptyState, PageHeader, Stat, Stats, StatusText, btnClass } from '@/components/ui';
import { colorVivo } from '@/components/modo';
import { anotarSolo } from '@/lib/trato';
import type { EquipoRow, ProviderRow } from '../proveedores/ProvidersManager';
import { BuscadorProveedores } from '../proveedores/BuscadorProveedores';
import { textoPrecio } from '../proveedores/EquipoDelAliado';
import { waDe } from '../proveedores/wa';

/**
 * SERVICIOS DE PROVEEDORES (2026-11-12, el dueño: "quita lo de mi flota, el
 * administrador ya sabe lo que es de él; en Proveedores solo los proveedores,
 * ahí también los puede agregar; y en otro módulo los servicios de los
 * proveedores").
 *
 * Toma el lugar de «Mi flota» en el menú. Arriba, la búsqueda por servicio y
 * municipio (la misma de «Asignar» en Servicios). Sin nada escrito, todo lo que
 * dan los proveedores, agrupado por tipo: quién lo da, cuánto cobra, cuántas
 * unidades, cómo está y su contacto. Los proveedores y sus equipos se dan de
 * alta y se corrigen en Proveedores (su ficha); aquí solo se consulta.
 */

interface Fila {
  e: EquipoRow;
  p: ProviderRow;
}

export function ServiciosProveedores({ provs, buscar, donde }: { provs: ProviderRow[]; buscar?: string; donde?: string }) {
  const router = useRouter();
  // Solo proveedores dados de alta (no solicitudes) y sin el interno de MAQSER24.
  const activos = useMemo(() => provs.filter((p) => p.status === 1 && !p.propio), [provs]);
  const filas = useMemo<Fila[]>(() => activos.flatMap((p) => (p.equipment ?? []).map((e) => ({ e, p }))), [activos]);
  const grupos = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) {
      const clave = f.e.tipo || f.e.category || 'Sin clasificar';
      m.set(clave, [...(m.get(clave) ?? []), f]);
    }
    // Dentro de cada tipo: preferentes, con papeles y con precio primero.
    const peso = (f: Fila) => (f.p.level === 'preferente' ? 4 : 0) + (f.p.verified ? 2 : 0) + (textoPrecio(f.e.precio) ? 1 : 0);
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([tipo, xs]) => ({ tipo, filas: [...xs].sort((a, b) => peso(b) - peso(a) || a.p.name.localeCompare(b.p.name, 'es')) }));
  }, [filas]);
  const sinEquipos = useMemo(() => activos.filter((p) => !(p.equipment ?? []).length), [activos]);
  const sinPrecio = filas.filter((f) => !textoPrecio(f.e.precio)).length;
  const conServicios = activos.length - sinEquipos.length;

  const verFicha = (p: ProviderRow, pestana: 'datos' | 'equipos' = 'equipos') =>
    router.push(`/proveedores?ver=${p.id}${pestana === 'equipos' ? '&dato=equipos' : ''}`);

  const todos = activos.length === 0 ? (
    <EmptyState icon="ph-address-book" title="Todavía no tienes proveedores" sub="Dalos de alta en Proveedores; luego agrega sus servicios con todo lo que cobran. Aquí aparece todo lo que dan.">
      <Btn variant="primary" href="/proveedores" icon="ph-handshake">Ir a Proveedores</Btn>
    </EmptyState>
  ) : (
    <div className="sp-todo">
      {grupos.length === 0 ? (
        <p className="sp-nota">Tus proveedores todavía no tienen servicios capturados. Agrégalos con «Agregar servicio».</p>
      ) : (
        grupos.map((g) => (
          <section key={g.tipo} className="sp-grupo" aria-label={g.tipo}>
            <h3 className="sp-tipo">{g.tipo}<span>{g.filas.length}</span></h3>
            <ul className="sp-filas">
              {g.filas.map((f) => <FilaServicio key={f.e.id} f={f} onVer={verFicha} />)}
            </ul>
          </section>
        ))
      )}
      {sinEquipos.length ? (
        <p className="sp-nota">
          Sin servicios capturados:{' '}
          {sinEquipos.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? ', ' : ''}
              <button type="button" className="sp-link" onClick={() => verFicha(p)}>{p.name}</button>
              {p.categoryLabels?.length ? ` (${p.categoryLabels.join(', ')})` : ''}
            </span>
          ))}
          . Agrégalos con «Agregar servicio».
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      <style>{CSS}</style>
      <PageHeader
        eyebrow={['2 · Cotizar', 'Servicios de proveedores']}
        title="Servicios de proveedores"
        subtitle="Lo que dan tus proveedores, para lo que MAQSER24 no maneja: quién lo da, cuánto cobra, en qué condiciones y hasta dónde llega. Toca el nombre de un servicio para ver o corregir todo lo suyo."
        actions={
          <>
            <Btn href="/proveedores" icon="ph-handshake">Ir a Proveedores</Btn>
            {activos.length ? <Btn variant="primary" href="/servicios-proveedores/nuevo" icon="ph-plus">Agregar servicio</Btn> : null}
          </>
        }
      />
      <Stats>
        <Stat label="Servicios" icon="ph-address-book" tone="accent" value={filas.length} />
        <Stat label="Proveedores que los dan" icon="ph-handshake" tone="muted" value={conServicios} hint={activos.length ? `de ${activos.length}` : undefined} />
        <Stat label="Sin precio" icon="ph-currency-dollar" tone={sinPrecio > 0 ? 'warn' : 'muted'} value={sinPrecio} hint={sinPrecio > 0 ? 'pídeselo y anótalo en su ficha' : undefined} />
      </Stats>
      <BuscadorProveedores provs={activos} servicioInicial={buscar} dondeInicial={donde} onVer={verFicha} sinBuscar={todos} />
    </div>
  );
}

function FilaServicio({ f, onVer }: { f: Fila; onVer: (p: ProviderRow, pestana?: 'datos' | 'equipos') => void }) {
  const { e, p } = f;
  const precio = textoPrecio(e.precio);
  const disp = presentacionEstado(e.availability);
  const n = Math.max(1, e.units ?? 1);
  const wa = waDe(p.phone);
  const tel = (p.phone ?? '').replace(/[^\d+]/g, '');
  const saludo = p.contactName?.trim() ? ` ${p.contactName.trim().split(' ')[0]}` : '';
  const mensaje = `Hola${saludo}, te escribo de MAQSER24. ¿Tienes disponible ${e.name}? ¿En cuánto me lo dejas?`;
  // Sus condiciones (mínimo, flete, IVA, pago…), capturadas en su formulario.
  const condiciones = resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10));
  return (
    <li className="sp-fila">
      <div className="sp-f-que">
        <a className="sp-nombre" href={`/servicios-proveedores/${e.id}`} title="Ver y corregir todo lo de este servicio">{e.name}</a>
        <small>{[e.brand, `${n} ${n === 1 ? 'unidad' : 'unidades'}`, e.location].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="sp-f-quien">
        <button type="button" className="sp-link" onClick={() => onVer(p, 'datos')}>{p.name}</button>
        <small>
          {[p.contactName, p.city ? `base en ${p.city}` : null].filter(Boolean).join(' · ')}
          {p.level === 'preferente' ? ' · ★ preferente' : ''}
        </small>
      </div>
      <div className={precio ? 'sp-f-precio' : 'sp-f-precio sp-sin'}>
        {precio ? <>Cobra {precio}</> : 'Sin precio'}
        {e.precioNota ? <small>{e.precioNota}</small> : null}
      </div>
      <div className="sp-f-estado">
        {e.pending ? <Chip tone="warn">Nuevo</Chip> : <StatusText color={colorVivo(disp)} title={disp.nota}>{disp.nombre}</StatusText>}
      </div>
      <div className="sp-f-acc">
        {tel ? (
          <a className={btnClass('ghost', 'sm')} href={`tel:${tel}`} title={`Llamar a ${p.name}`} aria-label={`Llamar a ${p.name}`}
            onClick={() => void anotarSolo({ aliado: p.id, con: 'aliado', canal: 'llamada', nota: `Por ${e.name}` })}>
            <i className="ph ph-phone" aria-hidden />
          </a>
        ) : null}
        {wa ? (
          <a className={btnClass('ghost', 'sm')} href={`https://wa.me/${wa}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer"
            title={`WhatsApp a ${p.name}`} aria-label={`WhatsApp a ${p.name}`}
            onClick={() => void anotarSolo({ aliado: p.id, con: 'aliado', canal: 'whatsapp', nota: `Por ${e.name}` })}>
            <i className="ph ph-whatsapp-logo" aria-hidden />
          </a>
        ) : null}
        <Btn size="sm" variant="ghost" icon="ph-identification-card" onClick={() => onVer(p, 'equipos')}>Ficha</Btn>
      </div>
      {/* Sus condiciones (mínimo, flete, extras, IVA, pago…) a todo lo ancho, debajo. */}
      {condiciones.length ? <div className="sp-f-cond">{condiciones.join(' · ')}</div> : null}
    </li>
  );
}

const CSS = `
.sp-todo { display: grid; gap: 18px; margin-top: 16px; }
.sp-grupo { display: grid; gap: 8px; }
.sp-tipo { margin: 0; font-size: 13px; font-weight: 650; text-transform: uppercase; letter-spacing: .04em; color: var(--adm-muted); display: flex; align-items: center; gap: 8px; }
.sp-tipo > span { font-size: 12px; font-weight: 600; color: var(--adm-faint); letter-spacing: 0; }
.sp-filas { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.sp-fila { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1.1fr) auto auto; gap: 6px 16px; align-items: center;
  padding: 10px 12px; border: 1px solid var(--adm-border); border-radius: 10px; }
.sp-f-que, .sp-f-quien, .sp-f-precio { display: grid; gap: 2px; min-width: 0; font-size: 13.5px; }
.sp-f-que small, .sp-f-quien small, .sp-f-precio small { font-size: 12.5px; color: var(--adm-muted); }
.sp-f-precio.sp-sin { color: var(--adm-faint); }
.sp-f-acc { display: flex; gap: 4px; justify-content: flex-end; }
.sp-link { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--adm-text); cursor: pointer; text-align: left; }
.sp-link:hover { color: var(--adm-accent); }
.sp-nombre { font-weight: 650; color: var(--adm-text); text-decoration: none; }
.sp-nombre:hover { color: var(--adm-accent); text-decoration: underline; }
.sp-f-cond { grid-column: 1 / -1; font-size: 12.5px; color: var(--adm-text-2); padding-top: 6px; border-top: 1px dashed var(--adm-border); }
.sp-nota { margin: 0; font-size: 13px; color: var(--adm-muted); }
@media (max-width: 900px) {
  .sp-fila { grid-template-columns: minmax(0, 1fr) auto; }
  .sp-f-quien, .sp-f-precio { grid-column: 1 / -1; }
  .sp-f-estado { grid-column: 2; grid-row: 1; }
  .sp-f-acc { grid-column: 1 / -1; justify-content: flex-start; }
}
`;
