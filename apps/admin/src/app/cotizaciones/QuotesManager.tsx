'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import {
  Btn, Chip, EmptyState, IconBtn, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone,
} from '@/components/ui';
import { QuoteRespond } from './QuoteRespond';
import { QuoteMatches } from './QuoteMatches';
import { QuoteContact } from './QuoteContact';

export interface QuoteItem {
  id: number;
  quoteNumber: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  subtotal: number;
  freightCost: number;
  tax: number;
  total: number;
  status: string;
  /** Estado comercial real (la vigencia ya aplicada): pendiente, vigente, vencida, aceptada, rechazada. */
  state: 'pendiente' | 'vigente' | 'vencida' | 'aceptada' | 'rechazada';
  validUntil: string | null;
  daysToExpire: number | null;
  included: string | null;
  excluded: string | null;
  conditions: string | null;
  respondedBy: string | null;
  acceptedAt: string | null;
  serviceCategory: string | null;
  /** Formulario "Cotizar" (sin precio) o cotizador del sitio (con precio, ya aceptada). */
  origen: 'formulario' | 'cotizador' | 'maquina';
  productInterested: string | null;
  address: string | null;
  region: string | null;
  serviceState: string | null;
  serviceLabel: string | null;
  requirements: Record<string, unknown> | null;
  comments: string | null;
  createdAt: string | null;
  /** Primer contacto con el cliente: alimenta el indicador de primera respuesta. */
  firstContactAt: string | null;
  firstContactVia: string | null;
  firstContactBy: string | null;
  /** Calculados en el servidor para no romper la hidratación. */
  days: number;
  dateLabel: string;
  createdLabel: string | null;
  firstContactLabel: string | null;
  respondedLabel: string | null;
  acceptedLabel: string | null;
  validUntilLabel: string | null;
}

/**
 * SOLICITUDES (rediseño, 2026-10-08).
 *
 * Antes la pantalla solo sabía "Pendiente" y "Cotizada": no decía si el
 * cliente ya había aceptado, si el precio se venció ni si ya estaba en
 * Servicios, aunque la API lo mandaba. Ahora cada solicitud cae en una ETAPA
 * del recorrido —Por cotizar → Esperando al cliente → En servicio → Cerrada,
 * o Perdida— y las etapas son el filtro. Cada fila ofrece solo lo que se
 * puede hacer en su etapa, y el detalle cuenta su historia completa.
 *
 * Kit del panel (2026-10-08): el recorrido se lee arriba como métricas en
 * texto plano (cuántas hay en cada etapa y qué significa) y el filtro pasa a
 * los segmentos de la barra de herramientas. Antes eran cinco tarjetas que
 * hacían las dos cosas a la vez y ocupaban media pantalla.
 */
type Etapa = 'por_cotizar' | 'esperando' | 'en_servicio' | 'cerrada' | 'perdida';
type Filtro = Etapa | 'todas';
type Sort = 'recent' | 'oldest' | 'amount';

function etapaDe(q: QuoteItem): Etapa {
  if (q.serviceState === 'cerrado') return 'cerrada';
  if (q.serviceState === 'cancelado') return 'perdida';
  if (q.serviceState || q.state === 'aceptada') return 'en_servicio';
  if (q.state === 'pendiente') return 'por_cotizar';
  if (q.state === 'vigente') return 'esperando';
  return 'perdida';
}

/** El color de cada tono, para lo que no es un componente del kit (puntos de la historia). */
const TONO: Record<Tone, string> = {
  accent: 'var(--adm-accent)',
  ok: 'var(--adm-ok)',
  warn: 'var(--adm-warn)',
  bad: 'var(--adm-bad)',
  info: 'var(--adm-info)',
  muted: 'var(--adm-faint)',
};
const URGENT_DAYS = 3; // sin precio a partir de aquí, la espera del cliente se marca
const PAGE_SIZE = 10;
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ageLabel = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`);

const ETAPAS: Array<{ key: Etapa; label: string; hint: string; tone: Tone; icon: string }> = [
  { key: 'por_cotizar', label: 'Por cotizar', hint: 'Llegó sin precio: hay que responder', tone: 'accent', icon: 'ph-tray-arrow-down' },
  { key: 'esperando', label: 'Esperando al cliente', hint: 'Ya tiene precio; el cliente decide', tone: 'warn', icon: 'ph-hourglass-medium' },
  { key: 'en_servicio', label: 'En servicio', hint: 'Aceptada: se sigue en Servicios', tone: 'info', icon: 'ph-truck' },
  { key: 'cerrada', label: 'Cerradas', hint: 'Servicio terminado y cerrado', tone: 'ok', icon: 'ph-check-circle' },
];
const PERDIDA = { key: 'perdida' as const, label: 'Perdidas', hint: 'Vencidas, rechazadas o canceladas', tone: 'bad' as Tone, icon: 'ph-x-circle' };

const ORIGEN: Record<QuoteItem['origen'], { label: string; title: string }> = {
  formulario: { label: 'Formulario', title: 'Llegó por "Cotizar" del sitio, sin precio' },
  cotizador: { label: 'Cotizador web', title: 'El cliente vio el precio en el cotizador y lo mandó' },
  maquina: { label: 'Cotizador de máquinas', title: 'Eligió una máquina con su precio en el sitio' },
};

/** Lo que pidió, en una línea: la línea de servicio. */
function necesidad(q: QuoteItem): string | null {
  return q.productInterested?.split(' · ')[0]?.trim() || q.serviceCategory || null;
}

/** El detalle corto: los conceptos del cotizador, o lo primero que escribió el cliente. */
function resumen(q: QuoteItem): string | null {
  const conceptos = q.comments?.match(/Conceptos:\s*(.+)/)?.[1];
  if (conceptos) return conceptos;
  const servicio = q.requirements?.servicio;
  if (typeof servicio === 'string' && servicio) return servicio;
  const nec = necesidad(q);
  return q.comments
    ?.split('\n')
    .map((l) => l.replace(/^[·\s-]+/, '').trim())
    .find((l) => l && l !== nec && !l.startsWith('Solicitud del cotizador')) ?? null;
}

/** El estado de la etapa: dice dónde está y, si aplica, cuánto le queda. */
function chipDe(q: QuoteItem, e: Etapa): { texto: string; tone: Tone } {
  if (e === 'por_cotizar') return { texto: 'Por cotizar', tone: q.days >= URGENT_DAYS ? 'warn' : 'accent' };
  if (e === 'esperando') {
    const d = q.daysToExpire;
    return { texto: d === null ? 'Esperando al cliente' : d <= 0 ? 'Vence hoy' : `Vence en ${d} d`, tone: 'warn' };
  }
  if (e === 'en_servicio') return { texto: q.serviceLabel ?? 'Aceptada', tone: 'info' };
  if (e === 'cerrada') return { texto: 'Cerrada', tone: 'ok' };
  return { texto: q.serviceState === 'cancelado' ? 'Cancelada' : q.state === 'vencida' ? 'Vencida' : 'Rechazada', tone: 'bad' };
}

const REQ_OCULTOS = new Set(['origen', 'cotizador', 'folio', 'quoterId']);
const REQ_NOMBRES: Record<string, string> = { obra: 'Obra', obra_ubicacion: 'Ubicación de la obra', fecha_inicio: 'Fecha de inicio' };
const humano = (k: string) => REQ_NOMBRES[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');

export function QuotesManager({ items }: { items: QuoteItem[] }) {
  const conEtapa = useMemo(() => items.map((q) => ({ q, e: etapaDe(q) })), [items]);
  const cuenta = (e: Filtro) => (e === 'todas' ? conEtapa.length : conEtapa.filter((x) => x.e === e).length);

  const [filtro, setFiltro] = useState<Filtro>(() => (items.some((q) => etapaDe(q) === 'por_cotizar') ? 'por_cotizar' : 'todas'));
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [page, setPage] = useState(1);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const detalle = detalleId === null ? null : conEtapa.find((x) => x.q.id === detalleId) ?? null;

  useEffect(() => {
    if (detalleId === null) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setDetalleId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detalleId]);

  const filtered = useMemo(() => {
    let list = conEtapa.slice();
    if (filtro !== 'todas') list = list.filter((x) => x.e === filtro);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(({ q }) =>
        [q.quoteNumber, q.name, q.company ?? '', q.email, q.phone, q.productInterested ?? '', String(q.requirements?.folio ?? '')]
          .join(' ').toLowerCase().includes(term),
      );
    }
    if (sort === 'recent') list.sort((a, b) => a.q.days - b.q.days || b.q.id - a.q.id);
    else if (sort === 'oldest') list.sort((a, b) => b.q.days - a.q.days || a.q.id - b.q.id);
    else list.sort((a, b) => b.q.total - a.q.total);
    return list;
  }, [conEtapa, filtro, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const elegir = (f: Filtro) => { setFiltro(f); setPage(1); };

  const etapaActiva = filtro === 'todas' ? null : [...ETAPAS, PERDIDA].find((e) => e.key === filtro) ?? null;

  return (
    <div>
      <style>{`
        .sl-row{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,2fr) minmax(0,.8fr) minmax(0,.95fr) auto; gap:16px; align-items:center; }
        .sl-open{ all:unset; cursor:pointer; display:block; min-width:0; border-radius:6px; }
        .sl-open:focus-visible{ outline:2px solid var(--adm-accent); outline-offset:4px; }
        .sl-open:hover .sl-name{ color:var(--adm-accent); }
        .sl-dl{ display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.6fr); gap:6px 14px; margin:0; font-size:13.5px; }
        .sl-dl dt{ color:var(--adm-muted); }
        .sl-dl dd{ margin:0; color:var(--adm-text); min-width:0; overflow-wrap:anywhere; }
        .sl-h3{ margin:0 0 10px; font-family:inherit; font-size:11.5px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--adm-faint); }
        .sl-tl{ list-style:none; margin:0; padding:0; display:grid; gap:0; }
        .sl-tl li{ display:grid; grid-template-columns:18px minmax(0,1fr) auto; gap:10px; align-items:start; padding:6px 0; font-size:13.5px; }
        /* La fila tiene cinco columnas y la de acciones lleva hasta tres botones:
           bajo 1200px pasa a dos columnas y bajo 620px a una. */
        @media (max-width: 1200px){
          .sl-row{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); row-gap:12px; }
          .sl-thead{ display:none !important; }
        }
        @media (max-width: 620px){ .sl-row{ grid-template-columns:minmax(0,1fr); } }
      `}</style>

      <PageHeader
        eyebrow="1 · Recibir"
        title="Solicitudes"
        subtitle="Todo lo que piden los clientes, desde que llega hasta que pasa a servicio. Elige una etapa para ver lo que hay en ella; abre una solicitud para ver su historia completa."
      />

      {/* ── El recorrido: cuántas hay en cada etapa ─────────────────── */}
      <Stats>
        {[...ETAPAS, PERDIDA].map((e) => (
          <Stat key={e.key} label={e.label} icon={e.icon} tone={e.tone} value={cuenta(e.key)} hint={e.hint} />
        ))}
      </Stats>

      {/* ── Filtro por etapa, búsqueda y orden ──────────────────────── */}
      <Toolbar end={`${filtered.length} de ${cuenta('todas')}`}>
        <Segmented<Filtro>
          ariaLabel="Filtrar por etapa"
          value={filtro}
          onChange={elegir}
          items={[
            { key: 'todas', label: 'Todas', count: cuenta('todas') },
            ...[...ETAPAS, PERDIDA].map((e) => ({ key: e.key, label: e.label, count: cuenta(e.key) })),
          ]}
        />
        <SearchBox
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar cliente, folio o lo que pidió…"
          aria-label="Buscar solicitud"
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--adm-muted)' }}>
          Ordenar
          <AdminSelect
            size="sm"
            className="w-auto min-w-[150px] h-9"
            ariaLabel="Ordenar"
            value={sort}
            onChange={(v) => { setSort(v as Sort); setPage(1); }}
            options={[
              { value: 'recent', label: 'Más recientes' },
              { value: 'oldest', label: 'Más antiguas' },
              { value: 'amount', label: 'Mayor monto' },
            ]}
          />
        </label>
      </Toolbar>

      {/* ── Lista ─────────────────────────────────────────────────── */}
      <Panel
        flush
        clip
        footer={
          <>
            <span>
              {filtered.length === 0 ? '0' : `${start + 1}–${start + pageItems.length}`} de{' '}
              <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{filtered.length}</span> solicitudes
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBtn icon="ph-caret-left" label="Página anterior" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
              <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-text-2)', fontWeight: 500, padding: '0 4px' }}>Página {safePage} / {totalPages}</span>
              <IconBtn icon="ph-caret-right" label="Página siguiente" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
            </div>
          </>
        }
      >
        <div className="adm-thead sl-row sl-thead">
          <div>Solicitud</div>
          <div>Cliente y lo que pide</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div>Etapa</div>
          <div />
        </div>

        {pageItems.map(({ q, e }) => {
          const chip = chipDe(q, e);
          const nec = necesidad(q);
          const res = resumen(q);
          const urgente = e === 'por_cotizar' && q.days >= URGENT_DAYS;
          return (
            <div key={q.id} className="adm-trow sl-row">
              <div style={{ minWidth: 0 }}>
                <div className="adm-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{q.quoteNumber}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                  <Chip title={ORIGEN[q.origen].title}>{ORIGEN[q.origen].label}</Chip>
                  <span style={{ fontSize: 12, color: urgente ? 'var(--adm-warn)' : 'var(--adm-faint)', fontWeight: urgente ? 600 : 400 }}>{ageLabel(q.days)}</span>
                </div>
              </div>

              <button type="button" className="sl-open" onClick={() => setDetalleId(q.id)} aria-label={`Ver la solicitud ${q.quoteNumber}`}>
                <div className="sl-name adm-cell-title adm-ellipsis" style={{ transition: 'color .15s' }}>
                  {q.company || q.name}{q.company && q.name && q.company !== q.name ? <span style={{ color: 'var(--adm-muted)', fontWeight: 500 }}> · {q.name}</span> : null}
                </div>
                {nec ? <div className="adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text-2)', marginTop: 3 }}>{nec}{res ? <span style={{ color: 'var(--adm-muted)' }}> — {res}</span> : null}</div> : null}
                <div className="adm-cell-sub adm-ellipsis">{q.phone || q.email}{q.region ? ` · ${q.region}` : ''}</div>
              </button>

              <div style={{ textAlign: 'right' }}>
                {q.total > 0 ? (
                  <>
                    <div className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' }}>{money(q.total)}</div>
                    {q.freightCost > 0 ? <div className="adm-cell-sub">incl. traslado</div> : null}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--adm-faint)' }}>Sin precio</div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 4, justifyItems: 'start', minWidth: 0 }}>
                <StatusText tone={chip.tone}>{chip.texto}</StatusText>
                {e === 'por_cotizar' && q.firstContactAt ? <span style={{ fontSize: 12, color: 'var(--adm-ok)' }}>✓ Ya se le habló</span> : null}
                {e === 'en_servicio' ? <span style={{ fontSize: 12, color: 'var(--adm-faint)' }}>en Servicios</span> : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                {e === 'por_cotizar' ? (
                  <>
                    {/* Primero se registra el contacto, luego quién puede, luego el precio. */}
                    <QuoteContact quoteId={q.id} firstContactAt={q.firstContactAt} firstContactVia={q.firstContactVia} />
                    <QuoteMatches quoteId={q.id} />
                    <QuoteRespond quoteId={q.id} subtotal={q.subtotal} />
                  </>
                ) : e === 'en_servicio' ? (
                  <>
                    <Btn size="sm" variant="ghost" onClick={() => setDetalleId(q.id)}>Detalle</Btn>
                    <Btn size="sm" href="/servicios">Ir a Servicios <i className="ph ph-arrow-right" aria-hidden /></Btn>
                  </>
                ) : (
                  <Btn size="sm" onClick={() => setDetalleId(q.id)}>Ver detalle</Btn>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <EmptyState
            icon={etapaActiva?.icon ?? 'ph-tray'}
            title={items.length === 0 ? 'Aún no llega ninguna solicitud' : search ? 'Sin resultados' : `Nada en "${etapaActiva?.label ?? 'esta etapa'}"`}
            sub={items.length === 0 ? 'Cuando un cliente pida algo en el sitio, aparecerá aquí.' : search ? 'Prueba con otro término.' : 'Elige otra etapa arriba.'}
          />
        ) : null}
      </Panel>

      {/* ── Detalle: la historia completa de una solicitud ─────────── */}
      {detalle ? <Detalle q={detalle.q} e={detalle.e} onClose={() => setDetalleId(null)} /> : null}
    </div>
  );
}

function Detalle({ q, e, onClose }: { q: QuoteItem; e: Etapa; onClose: () => void }) {
  const chip = chipDe(q, e);
  const reqs = Object.entries(q.requirements ?? {}).filter(([k, v]) => !REQ_OCULTOS.has(k) && v !== null && v !== '' && typeof v !== 'object');
  const folioDoc = typeof q.requirements?.folio === 'string' ? q.requirements.folio : null;
  const quoterId = typeof q.requirements?.quoterId === 'number' ? q.requirements.quoterId : null;

  // La historia, en el orden en que pasó. Lo que no ha pasado se ve apagado.
  const pasos: Array<{ label: string; cuando: string | null; detalle?: string | null }> = [
    { label: 'Llegó la solicitud', cuando: q.createdLabel, detalle: ORIGEN[q.origen].label },
    { label: 'Primer contacto', cuando: q.firstContactLabel, detalle: q.firstContactAt ? [q.firstContactVia, q.firstContactBy].filter(Boolean).join(' · ') : null },
    { label: 'Cotizada', cuando: q.respondedLabel, detalle: q.respondedBy },
    { label: 'Aceptada por el cliente', cuando: q.acceptedLabel },
    e === 'perdida'
      ? { label: chip.texto, cuando: '—', detalle: q.state === 'vencida' ? 'Se pasó la vigencia sin respuesta del cliente' : null }
      : { label: e === 'cerrada' ? 'Servicio cerrado' : 'En servicio', cuando: e === 'cerrada' ? 'Cerrado' : e === 'en_servicio' ? 'En curso' : null, detalle: q.serviceLabel ? `Estado: ${q.serviceLabel}` : null },
  ];
  const color = TONO[chip.tone];

  // Panel lateral y no el Modal del kit: se lee junto a la lista y desde aquí
  // se abren los modales de responder y de "¿Quién puede?".
  return (
    <div role="dialog" aria-modal="true" aria-label={`Solicitud ${q.quoteNumber}`} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(ev) => ev.stopPropagation()}
        style={{ width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', background: 'var(--adm-card)', borderLeft: '1px solid var(--adm-border-strong)', boxShadow: '-30px 0 80px -20px rgba(0,0,0,0.8)', padding: '22px 24px 28px', display: 'grid', gap: 24, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="adm-mono" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{q.quoteNumber}</span>
              <Chip tone={chip.tone}>{chip.texto}</Chip>
            </div>
            <h2 style={{ margin: '8px 0 0', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--adm-text)' }}>{q.company || q.name}</h2>
            {necesidad(q) ? <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--adm-text-2)' }}>{necesidad(q)}</p> : null}
          </div>
          <IconBtn icon="ph-x" label="Cerrar" plain onClick={onClose} style={{ marginTop: -4, marginRight: -6 }} />
        </div>

        <section>
          <h3 className="sl-h3">Historia</h3>
          <ol className="sl-tl">
            {pasos.map((p) => {
              const hecho = Boolean(p.cuando);
              return (
                <li key={p.label}>
                  <span style={{ width: 10, height: 10, marginTop: 5, borderRadius: '50%', background: hecho ? color : 'transparent', border: `2px solid ${hecho ? color : 'var(--adm-border-strong)'}` }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ color: hecho ? 'var(--adm-text)' : 'var(--adm-faint)', fontWeight: 500 }}>{p.label}</span>
                    {p.detalle ? <span style={{ display: 'block', fontSize: 12.5, color: 'var(--adm-muted)', marginTop: 1 }}>{p.detalle}</span> : null}
                  </span>
                  <span className="adm-num" style={{ fontSize: 12.5, color: hecho ? 'var(--adm-muted)' : 'var(--adm-faint)' }}>{p.cuando ?? 'Pendiente'}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <h3 className="sl-h3">Cliente</h3>
          <dl className="sl-dl">
            <dt>Contacto</dt><dd>{q.name}</dd>
            {q.company ? (<><dt>Empresa</dt><dd>{q.company}</dd></>) : null}
            <dt>Teléfono</dt><dd className={q.phone ? 'adm-mono' : undefined}>{q.phone || '—'}</dd>
            <dt>Correo</dt><dd>{q.email || '—'}</dd>
            {q.address ? (<><dt>Dirección</dt><dd>{q.address}</dd></>) : null}
            {q.region ? (<><dt>Municipio</dt><dd>{q.region}</dd></>) : null}
          </dl>
        </section>

        {reqs.length > 0 || q.comments ? (
          <section>
            <h3 className="sl-h3">Lo que pidió</h3>
            {reqs.length > 0 ? (
              <dl className="sl-dl" style={{ marginBottom: q.comments ? 12 : 0 }}>
                {reqs.map(([k, v]) => (<Fragment key={k}><dt>{humano(k)}</dt><dd>{String(v)}</dd></Fragment>))}
              </dl>
            ) : null}
            {q.comments ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.55, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--adm-border)', borderRadius: 8 }}>{q.comments}</p>
            ) : null}
          </section>
        ) : null}

        <section>
          <h3 className="sl-h3">Importe</h3>
          {q.total > 0 ? (
            <div style={{ display: 'grid', gap: 2 }}>
              {[
                ['Subtotal', q.subtotal],
                ...(q.freightCost > 0 ? [['Traslado', q.freightCost] as const] : []),
                ...(q.tax > 0 ? [['IVA', q.tax] as const] : []),
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13.5, color: 'var(--adm-muted)' }}>
                  <span>{l}</span><span className="adm-num" style={{ color: 'var(--adm-text)' }}>{money(v as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--adm-border)' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Total</span>
                <strong className="adm-num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--adm-text)' }}>{money(q.total)}</strong>
              </div>
              {q.validUntilLabel ? <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginTop: 6 }}>Precio válido hasta el {q.validUntilLabel}</div> : null}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-muted)' }}>Todavía sin precio. Respóndela para enviarle la cotización al cliente.</p>
          )}
        </section>

        {q.included || q.excluded || q.conditions ? (
          <section>
            <h3 className="sl-h3">Términos de la cotización</h3>
            {([['Incluye', q.included], ['No incluye', q.excluded], ['Condiciones', q.conditions]] as const).map(([l, v]) => v ? (
              <details key={l} style={{ borderTop: '1px solid var(--adm-border)', padding: '8px 0' }}>
                <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text-2)' }}>{l}</summary>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--adm-text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</p>
              </details>
            ) : null)}
          </section>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {e === 'por_cotizar' ? (
            <>
              <QuoteContact quoteId={q.id} firstContactAt={q.firstContactAt} firstContactVia={q.firstContactVia} />
              <QuoteMatches quoteId={q.id} />
              {/* Aquí sí es la acción principal: el panel es de una sola solicitud. */}
              <QuoteRespond quoteId={q.id} subtotal={q.subtotal} principal />
            </>
          ) : null}
          {e === 'en_servicio' || e === 'cerrada' ? <Btn size="sm" href="/servicios">Ver en Servicios <i className="ph ph-arrow-right" aria-hidden /></Btn> : null}
          {quoterId ? <Btn size="sm" href={`/cotizador/historial/${quoterId}`} icon="ph-file-text">Documento {folioDoc ?? ''}</Btn> : null}
        </div>
      </div>
    </div>
  );
}
