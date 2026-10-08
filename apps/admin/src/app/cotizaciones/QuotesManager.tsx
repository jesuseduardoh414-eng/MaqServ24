'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminSelect } from '@/components/AdminSelect';
import { D, FONT } from '@/components/editor-kit';
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
 * o Perdida— y las etapas, arriba, son el filtro. Cada fila ofrece solo lo que
 * se puede hacer en su etapa, y el detalle cuenta su historia completa.
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

const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const RED = '#e5484d';
const AMBER = '#f0b14f';
const SOFT = '#8A8A8F';
const FAINT = '#5C5C61';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const URGENT_DAYS = 3; // sin precio a partir de aquí, la espera del cliente se marca
const PAGE_SIZE = 10;
const tinte = (c: string, pct = 12) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ageLabel = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`);

const ETAPAS: Array<{ key: Etapa; label: string; hint: string; color: string; icon: string }> = [
  { key: 'por_cotizar', label: 'Por cotizar', hint: 'Llegó sin precio: hay que responder', color: D.accent, icon: 'ph-tray-arrow-down' },
  { key: 'esperando', label: 'Esperando al cliente', hint: 'Ya tiene precio; el cliente decide', color: AMBER, icon: 'ph-hourglass-medium' },
  { key: 'en_servicio', label: 'En servicio', hint: 'Aceptada: se sigue en Servicios', color: BLUE, icon: 'ph-truck' },
  { key: 'cerrada', label: 'Cerradas', hint: 'Servicio terminado y cerrado', color: GREEN, icon: 'ph-check-circle' },
];
const PERDIDA = { key: 'perdida' as const, label: 'Perdidas', hint: 'Vencidas, rechazadas o canceladas', color: RED, icon: 'ph-x-circle' };

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

/** El chip de la etapa: dice dónde está y, si aplica, cuánto le queda. */
function chipDe(q: QuoteItem, e: Etapa): { texto: string; color: string } {
  if (e === 'por_cotizar') return { texto: 'Por cotizar', color: q.days >= URGENT_DAYS ? AMBER : D.accent };
  if (e === 'esperando') {
    const d = q.daysToExpire;
    return { texto: d === null ? 'Esperando al cliente' : d <= 0 ? 'Vence hoy' : `Vence en ${d} d`, color: AMBER };
  }
  if (e === 'en_servicio') return { texto: q.serviceLabel ?? 'Aceptada', color: BLUE };
  if (e === 'cerrada') return { texto: 'Cerrada', color: GREEN };
  return { texto: q.serviceState === 'cancelado' ? 'Cancelada' : q.state === 'vencida' ? 'Vencida' : 'Rechazada', color: RED };
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
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" />
      <style>{`
        .sl-steps{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)) minmax(0,.85fr); gap:10px; }
        .sl-step{ position:relative; text-align:left; border:1px solid ${D.inputBorder}; background:${D.card}; border-radius:14px; padding:14px 16px; cursor:pointer; font-family:inherit; color:inherit; transition:border-color .15s, background .15s; min-width:0; }
        .sl-step:hover{ border-color:rgba(255,255,255,0.16); background:#17171a; }
        .sl-step[aria-pressed="true"]{ background:#17171a; }
        .sl-step-n{ font:700 26px ${MONO}; letter-spacing:-.5px; line-height:1; margin-top:10px; }
        .sl-arrow{ position:absolute; right:-9px; top:50%; transform:translateY(-50%); width:16px; height:16px; border-radius:50%; background:#0b0b0d; border:1px solid ${D.inputBorder}; display:grid; place-items:center; color:${FAINT}; font-size:9px; z-index:1; }
        .sl-row{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,2fr) minmax(0,.8fr) minmax(0,.95fr) auto; gap:16px; align-items:center; padding:16px 22px; border-top:1px solid ${D.cardBorder}; }
        .sl-row:hover{ background:rgba(255,255,255,0.02); }
        .sl-open{ all:unset; cursor:pointer; display:block; min-width:0; border-radius:6px; }
        .sl-open:focus-visible{ outline:2px solid ${D.accent}; outline-offset:4px; }
        .sl-open:hover .sl-name{ color:${D.accent}; }
        .sl-ellip{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sl-chip{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; border-radius:20px; padding:4px 10px; white-space:nowrap; }
        .sl-btn{ display:inline-flex; align-items:center; gap:6px; font-family:inherit; font-size:12.5px; font-weight:600; padding:7px 12px; border-radius:9px; cursor:pointer; white-space:nowrap; text-decoration:none; background:transparent; color:#B4B4B9; border:1px solid rgba(255,255,255,0.12); }
        .sl-btn:hover{ background:rgba(255,255,255,0.05); color:#f5f5f4; }
        .sl-tool{ display:flex; align-items:center; background:${D.card}; border:1px solid ${D.inputBorder}; border-radius:11px; height:42px; padding:0 13px; }
        .sl-pg{ width:36px; height:36px; background:#1A1A1D; color:#B4B4B9; border:1px solid rgba(255,255,255,0.1); border-radius:9px; cursor:pointer; font-size:15px; }
        .sl-pg:disabled{ cursor:default; opacity:.4; }
        .sl-dl{ display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.6fr); gap:6px 14px; margin:0; font-size:13px; }
        .sl-dl dt{ color:${SOFT}; }
        .sl-dl dd{ margin:0; color:#EDEDEC; min-width:0; overflow-wrap:anywhere; }
        .sl-h3{ margin:0 0 10px; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#7A7A7F; }
        .sl-tl{ list-style:none; margin:0; padding:0; display:grid; gap:0; }
        .sl-tl li{ display:grid; grid-template-columns:18px minmax(0,1fr) auto; gap:10px; align-items:start; padding:6px 0; font-size:13px; }
        @media (max-width: 1200px){
          .sl-steps{ grid-template-columns:repeat(2, minmax(0,1fr)); }
          .sl-arrow{ display:none; }
          .sl-row{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); row-gap:12px; }
          .sl-head{ display:none !important; }
        }
        @media (max-width: 620px){ .sl-steps{ grid-template-columns:minmax(0,1fr); } .sl-row{ grid-template-columns:minmax(0,1fr); } }
        @media (prefers-reduced-motion: reduce){ .sl-step{ transition:none; } }
      `}</style>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SOFT, fontWeight: 500 }}>
        <span>1 · Recibir</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Solicitudes</span>
      </div>
      <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Solicitudes</h1>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, color: SOFT, maxWidth: '78ch' }}>
        Todo lo que piden los clientes, desde que llega hasta que pasa a servicio. Elige una etapa para ver lo que hay en ella;
        abre una solicitud para ver su historia completa.
      </p>

      {/* ── Etapas: el recorrido y el filtro a la vez ───────────────── */}
      <div className="sl-steps" style={{ marginTop: 22 }}>
        {ETAPAS.map((e, i) => {
          const on = filtro === e.key;
          const n = cuenta(e.key);
          return (
            <button key={e.key} type="button" className="sl-step" aria-pressed={on} onClick={() => elegir(on ? 'todas' : e.key)}
              style={on ? { borderColor: e.color, boxShadow: `inset 0 0 0 1px ${e.color}` } : undefined}>
              {i < ETAPAS.length - 1 ? <span className="sl-arrow" aria-hidden><i className="ph-bold ph-caret-right" /></span> : null}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: tinte(e.color, 14), color: e.color, fontSize: 14 }}><i className={`ph ${e.icon}`} aria-hidden /></span>
                <span style={{ font: `700 10.5px ${MONO}`, color: FAINT }}>{i + 1}</span>
                <span className="sl-ellip" style={{ fontSize: 13, fontWeight: 700, color: on ? '#FBFBFA' : '#D4D4D8' }}>{e.label}</span>
              </span>
              <div className="sl-step-n" style={{ color: n > 0 ? e.color : '#4C4C51' }}>{n}</div>
              <div className="sl-ellip" style={{ fontSize: 11.5, color: SOFT, marginTop: 6 }}>{e.hint}</div>
            </button>
          );
        })}
        <button type="button" className="sl-step" aria-pressed={filtro === 'perdida'} onClick={() => elegir(filtro === 'perdida' ? 'todas' : 'perdida')}
          style={filtro === 'perdida' ? { borderColor: RED, boxShadow: `inset 0 0 0 1px ${RED}` } : { background: 'transparent', borderStyle: 'dashed' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: tinte(RED, 12), color: RED, fontSize: 14 }}><i className={`ph ${PERDIDA.icon}`} aria-hidden /></span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D4D4D8' }}>{PERDIDA.label}</span>
          </span>
          <div className="sl-step-n" style={{ color: cuenta('perdida') > 0 ? RED : '#4C4C51' }}>{cuenta('perdida')}</div>
          <div className="sl-ellip" style={{ fontSize: 11.5, color: SOFT, marginTop: 6 }}>{PERDIDA.hint}</div>
        </button>
      </div>

      {/* ── Herramientas ──────────────────────────────────────────── */}
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: '#B4B4B9', fontWeight: 600, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {etapaActiva ? (
            <>
              <span>{etapaActiva.label}</span>
              <button type="button" className="sl-btn" onClick={() => elegir('todas')} style={{ padding: '4px 10px', fontSize: 12 }}>Ver todas ({cuenta('todas')})</button>
            </>
          ) : (
            <span>Todas las solicitudes · {cuenta('todas')}</span>
          )}
        </div>
        <div className="sl-tool" style={{ flex: '1 1 240px', maxWidth: 360, gap: 9 }}>
          <i className="ph ph-magnifying-glass" style={{ color: '#6B6B71', fontSize: 14 }} aria-hidden />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar cliente, folio o lo que pidió…"
            aria-label="Buscar solicitud"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>
        <label className="sl-tool" style={{ gap: 8 }}>
          <span style={{ color: '#6B6B71', fontSize: 12.5, fontWeight: 600 }}>Ordenar</span>
          <AdminSelect
            size="sm"
            className="w-auto min-w-[150px]"
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
      </div>

      {/* ── Lista ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div className="sl-row sl-head" style={{ borderTop: 0, background: '#131315', padding: '13px 22px' }}>
          {['Solicitud', 'Cliente y lo que pide', 'Total', 'Etapa', ''].map((h, i) => (
            <div key={h || i} style={{ fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase', textAlign: i === 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {pageItems.map(({ q, e }) => {
          const chip = chipDe(q, e);
          const nec = necesidad(q);
          const res = resumen(q);
          const urgente = e === 'por_cotizar' && q.days >= URGENT_DAYS;
          return (
            <div key={q.id} className="sl-row">
              <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                <span style={{ width: 3, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: chip.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#EDEDEC' }}>{q.quoteNumber}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <span title={ORIGEN[q.origen].title} style={{ fontSize: 10.5, fontWeight: 700, color: '#B4B4B9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 5 }}>{ORIGEN[q.origen].label}</span>
                    <span style={{ fontSize: 11.5, color: urgente ? AMBER : FAINT, fontWeight: urgente ? 700 : 400 }}>{ageLabel(q.days)}</span>
                  </div>
                </div>
              </div>

              <button type="button" className="sl-open" onClick={() => setDetalleId(q.id)} aria-label={`Ver la solicitud ${q.quoteNumber}`}>
                <div className="sl-name sl-ellip" style={{ fontSize: 14, fontWeight: 700, color: '#EDEDEC', transition: 'color .15s' }}>
                  {q.company || q.name}{q.company && q.name && q.company !== q.name ? <span style={{ color: SOFT, fontWeight: 500 }}> · {q.name}</span> : null}
                </div>
                {nec ? <div className="sl-ellip" style={{ fontSize: 12.5, color: '#B4B4B9', marginTop: 4 }}>{nec}{res ? <span style={{ color: SOFT }}> — {res}</span> : null}</div> : null}
                <div className="sl-ellip" style={{ fontSize: 11.5, color: FAINT, marginTop: 3 }}>{q.phone || q.email}{q.region ? ` · ${q.region}` : ''}</div>
              </button>

              <div style={{ textAlign: 'right' }}>
                {q.total > 0 ? (
                  <>
                    <div style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 600, color: '#FBFBFA' }}>{money(q.total)}</div>
                    {q.freightCost > 0 ? <div style={{ fontSize: 11, color: FAINT, marginTop: 3 }}>incl. traslado</div> : null}
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: FAINT }}>Sin precio</div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 5, justifyItems: 'start', minWidth: 0 }}>
                <span className="sl-chip" style={{ background: tinte(chip.color), color: chip.color, border: `1px solid ${tinte(chip.color, 26)}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: chip.color }} />{chip.texto}
                </span>
                {e === 'por_cotizar' && q.firstContactAt ? <span style={{ fontSize: 11, color: GREEN }}>✓ Ya se le habló</span> : null}
                {e === 'en_servicio' ? <span style={{ fontSize: 11, color: FAINT }}>en Servicios</span> : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                {e === 'por_cotizar' ? (
                  <>
                    {/* Primero se registra el contacto, luego quién puede, luego el precio. */}
                    <QuoteContact quoteId={q.id} firstContactAt={q.firstContactAt} firstContactVia={q.firstContactVia} />
                    <QuoteMatches quoteId={q.id} />
                    <QuoteRespond quoteId={q.id} subtotal={q.subtotal} />
                  </>
                ) : e === 'en_servicio' ? (
                  <>
                    <button type="button" className="sl-btn" onClick={() => setDetalleId(q.id)}>Detalle</button>
                    <Link href="/servicios" className="sl-btn" style={{ color: BLUE, borderColor: tinte(BLUE, 35) }}>Ir a Servicios <i className="ph ph-arrow-right" aria-hidden /></Link>
                  </>
                ) : (
                  <button type="button" className="sl-btn" onClick={() => setDetalleId(q.id)}>Ver detalle</button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', borderTop: `1px solid ${D.cardBorder}` }}>
            <i className={`ph ${etapaActiva?.icon ?? 'ph-tray'}`} style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} aria-hidden />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>
              {items.length === 0 ? 'Aún no llega ninguna solicitud' : search ? 'Sin resultados' : `Nada en "${etapaActiva?.label ?? 'esta etapa'}"`}
            </div>
            <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5 }}>
              {items.length === 0 ? 'Cuando un cliente pida algo en el sitio, aparecerá aquí.' : search ? 'Prueba con otro término.' : 'Elige otra etapa arriba.'}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', background: '#131315', borderTop: `1px solid ${D.cardBorder}`, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
            {filtered.length === 0 ? '0' : `${start + 1}–${start + pageItems.length}`} de <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{filtered.length}</span> solicitudes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="sl-pg" aria-label="Página anterior" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
            <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {safePage} / {totalPages}</span>
            <button type="button" className="sl-pg" aria-label="Página siguiente" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
          </div>
        </div>
      </div>

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

  return (
    <div role="dialog" aria-modal="true" aria-label={`Solicitud ${q.quoteNumber}`} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(ev) => ev.stopPropagation()}
        style={{ width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', background: '#111113', borderLeft: `1px solid ${D.inputBorder}`, boxShadow: '-30px 0 80px -20px rgba(0,0,0,0.8)', padding: '22px 24px 28px', display: 'grid', gap: 22, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: SOFT }}>{q.quoteNumber}</span>
              <span className="sl-chip" style={{ background: tinte(chip.color), color: chip.color, border: `1px solid ${tinte(chip.color, 26)}` }}>{chip.texto}</span>
            </div>
            <h2 style={{ margin: '8px 0 0', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: '#FBFBFA' }}>{q.company || q.name}</h2>
            {necesidad(q) ? <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#B4B4B9' }}>{necesidad(q)}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="sl-btn" style={{ padding: 8 }}><i className="ph ph-x" aria-hidden /></button>
        </div>

        <section>
          <h3 className="sl-h3">Historia</h3>
          <ol className="sl-tl">
            {pasos.map((p) => {
              const hecho = Boolean(p.cuando);
              return (
                <li key={p.label}>
                  <span style={{ width: 10, height: 10, marginTop: 4, borderRadius: '50%', background: hecho ? chip.color : 'transparent', border: `2px solid ${hecho ? chip.color : '#3A3A3F'}` }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ color: hecho ? '#EDEDEC' : FAINT, fontWeight: 600 }}>{p.label}</span>
                    {p.detalle ? <span style={{ display: 'block', fontSize: 12, color: SOFT, marginTop: 1 }}>{p.detalle}</span> : null}
                  </span>
                  <span style={{ fontSize: 12, color: hecho ? SOFT : FAINT, fontFamily: MONO }}>{p.cuando ?? 'Pendiente'}</span>
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
            <dt>Teléfono</dt><dd>{q.phone || '—'}</dd>
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
              <p style={{ margin: 0, fontSize: 13, color: '#B4B4B9', whiteSpace: 'pre-wrap', lineHeight: 1.55, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>{q.comments}</p>
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
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: SOFT }}>
                  <span>{l}</span><span style={{ color: '#EDEDEC', fontFamily: MONO }}>{money(v as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: `1px solid ${D.cardBorder}` }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
                <strong style={{ fontSize: 22, fontWeight: 800, color: GREEN, fontFamily: MONO }}>{money(q.total)}</strong>
              </div>
              {q.validUntilLabel ? <div style={{ fontSize: 12, color: SOFT, marginTop: 6 }}>Precio válido hasta el {q.validUntilLabel}</div> : null}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: SOFT }}>Todavía sin precio. Respóndela para enviarle la cotización al cliente.</p>
          )}
        </section>

        {q.included || q.excluded || q.conditions ? (
          <section>
            <h3 className="sl-h3">Términos de la cotización</h3>
            {([['Incluye', q.included], ['No incluye', q.excluded], ['Condiciones', q.conditions]] as const).map(([l, v]) => v ? (
              <details key={l} style={{ borderTop: `1px solid ${D.cardBorder}`, padding: '8px 0' }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#D4D4D8' }}>{l}</summary>
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#B4B4B9', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</p>
              </details>
            ) : null)}
          </section>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {e === 'por_cotizar' ? (
            <>
              <QuoteContact quoteId={q.id} firstContactAt={q.firstContactAt} firstContactVia={q.firstContactVia} />
              <QuoteMatches quoteId={q.id} />
              <QuoteRespond quoteId={q.id} subtotal={q.subtotal} />
            </>
          ) : null}
          {e === 'en_servicio' || e === 'cerrada' ? <Link href="/servicios" className="sl-btn">Ver en Servicios <i className="ph ph-arrow-right" aria-hidden /></Link> : null}
          {quoterId ? <Link href={`/cotizador/historial/${quoterId}`} className="sl-btn">Documento {folioDoc ?? ''} <i className="ph ph-file-text" aria-hidden /></Link> : null}
        </div>
      </div>
    </div>
  );
}
