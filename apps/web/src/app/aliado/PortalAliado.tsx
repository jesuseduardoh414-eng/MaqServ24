'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TIPOS_ALIADO, esLineaServicio, ofertaDe, tiposDeAliado } from '@maqserv/config';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '@maqserv/ui';
import { Icon, type IconName } from '@/components/Icon';
import { OfrecerEquipo } from './OfrecerEquipo';
import { telHref } from '@/lib/telefono';
// `confirmar` ya es la función de "Sigue libre" de este portal: el diálogo va con otro nombre.
import { confirmar as confirmarDialogo, pedirTexto } from '@/components/Dialogos';

/**
 * EL PANEL DEL ALIADO (rediseño 2026-09-24).
 *
 * Pensado para un teléfono a media obra: lo que espera respuesta va arriba y
 * en grande. El rediseño agrega lo que el aliado preguntaba por teléfono y
 * la API ya sabía: cuánto paga cada trabajo, en qué va lo que trae, qué le
 * falta para recibir trabajo, y su historial.
 *
 * DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Rechazar PIDE motivo; aceptar pide CUÁNDO LLEGA. El "no" sin motivo no
 *    sirve para nada, y el "sí" sin fecha no deja medir su puntualidad.
 *    Antes ambos iban por `window.prompt`; ahora son formularios en la tarjeta.
 *
 * 2. Se le enseña su propio historial. Si el sistema lo ordena con esos
 *    números, tiene derecho a verlos, y es la única forma de discutirlos.
 *
 * 3. "Para recibir trabajo" es una lista de lo que falta, no una calificación:
 *    papeles, sello, equipos y confirmación. Un aliado nuevo llega sin nada y
 *    tiene que saber qué hacer primero.
 */

export interface DatosPortal {
  aliado: {
    id: number;
    name: string;
    contactName: string | null;
    level: string;
    verified: boolean;
    docsStatus: string;
    coverage: string[];
    categories: string[];
    categoryLabels?: string[];
    joinedAt?: string | null;
    monthsInNetwork: number | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
    responseMinutes: number | null;
  };
  porContestar: Array<{
    assignmentId: number;
    quoteNumber: string;
    category: string | null;
    address: string | null;
    site: string | null;
    detail: string | null;
    requirements: string[];
    /** Lo que pide el cliente, con las preguntas de su línea. */
    pedido?: Array<{ label: string; valor: string }>;
    offeredAt: string;
    total?: number | null;
  }>;
  enCurso: Array<{
    quoteNumber: string;
    category: string | null;
    state: string | null;
    stateLabel?: string;
    progress?: number;
    committedAt?: string | null;
    total?: number | null;
    site: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    requirements: string[];
    pedido?: Array<{ label: string; valor: string }>;
  }>;
  equipos: Array<{
    id: number;
    name: string;
    state: string;
    location: string | null;
    diasSinConfirmar: number | null;
    confirmacion: string;
  }>;
  documentos: {
    estado: string;
    avisos: Array<{ documentId: number; kind: string; name: string | null; expiresAt: string; texto: string; urgencia: string }>;
    diasAviso: number;
    lista: Array<{ id: number; kind: string; kindLabel: string; name: string | null; expiresAt: string | null }>;
    tipos: Array<{ clave: string; label: string }>;
  };
  /** Lo que ofreció desde aquí y MAQSER24 aún no publica. */
  propuestas?: Array<{ id: number; name: string; brand: string | null; image: string | null; createdAt: string | null }>;
  recientes?: Array<{
    quoteNumber: string;
    category: string | null;
    site: string | null;
    answer: string;
    reason: string | null;
    respondedAt: string | null;
    stateLabel: string;
    progress: number;
    total: number | null;
  }>;
  cumplimiento: {
    resumen: string;
    ofrecidos: number;
    aceptados: number;
    completados: number;
    cancelados: number;
    minutosRespuestaReal: number | null;
    minutosRespuestaDeclarado: number | null;
    confiable: boolean;
  };
}

/** Cómo contactar a MAQSER24 desde el portal (sale de Diseño → Contacto). */
export interface ContactoMaqser {
  phone: string | null;
  email: string | null;
  hours: string | null;
}


// ───────────────────────── estilos ─────────────────────────

/**
 * Estandarización (2026-09-30): el portal usa las piezas `ms-*` del sistema
 * de diseño (EstilosSistema) como la cuenta del cliente. Aquí solo va lo
 * propio del portal, con prefijo `al-`.
 *
 * Los campos van a 16 px en teléfono: por debajo de eso, iOS hace zoom al
 * enfocar el campo (el sistema los deja en 14.5 px).
 */
const CSS = `
.al-cols{ display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:32px; align-items:start; }
.al-main, .al-side{ min-width:0; }
.al-sec{ margin-bottom:40px; scroll-margin-top:84px; }
.al-dos{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px 16px; }
.al-ofrece{ list-style:none; margin:10px 0 0; padding:0; display:grid; gap:4px; font-size:13px; color:var(--color-text-muted); line-height:1.5; }
.al-ofrece b{ color:var(--color-text); font-weight:600; }
.al-pide{ margin-top:14px; padding:12px 14px; border-radius:10px; background:rgba(127,127,127,.06); border:1px solid var(--color-border); }
.al-pide dl{ margin:8px 0 0; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px 16px; }
.al-pide dl > div{ min-width:0; }
.al-pide dt{ font-size:12px; color:var(--color-text-muted); }
.al-pide dd{ margin:2px 0 0; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.al-side .al-dos{ grid-template-columns:minmax(0,1fr); }
.al-stack{ display:grid; gap:12px; }

.al-head{ display:flex; gap:16px; align-items:center; margin-bottom:24px; }
.al-avatar{ width:56px; height:56px; border-radius:12px; flex-shrink:0; display:grid; place-items:center; background:var(--color-surface); color:var(--color-text); font-family:var(--font-display); font-weight:700; font-size:19px; letter-spacing:.02em; border:1px solid var(--color-border); }
.al-head-txt{ min-width:0; }
.al-chips{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
.al-meta{ display:flex; gap:6px 18px; flex-wrap:wrap; }
.al-meta span{ display:inline-flex; align-items:flex-start; gap:6px; min-width:0; overflow-wrap:anywhere; }
.al-meta svg{ flex-shrink:0; margin-top:3px; }

.al-kpis{ padding:18px 22px; margin-bottom:32px; }
.al-kpi{ display:block; color:inherit; text-decoration:none; border-radius:8px; padding:4px 6px; margin:-4px -6px; transition:background .18s ease; }
.al-kpi:hover{ background:color-mix(in srgb, var(--color-text) 5%, transparent); }
.al-kpi:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.al-kpi .ms-stat-l{ display:flex; align-items:center; gap:6px; margin:0 0 4px; }
.al-stat-txt{ font-size:20px; line-height:1.5; }

.al-msg{ margin-bottom:20px; }
.al-msg-ico{ display:flex; margin-top:2px; }
.al-msg[data-ok="true"] .al-msg-ico{ color:var(--color-success); }
.al-msg[data-ok="false"] .al-msg-ico{ color:var(--color-error); }

.al-barra{ height:6px; border-radius:999px; background:color-mix(in srgb, var(--color-text) 10%, transparent); overflow:hidden; }
.al-barra > span{ display:block; height:100%; border-radius:999px; }

.al-pasos{ list-style:none; padding:0; margin:16px 0 0; display:grid; gap:12px; }
.al-pasos li{ display:flex; gap:11px; align-items:flex-start; }
.al-paso-ico{ width:22px; height:22px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; margin-top:1px; border:1.5px solid var(--color-border); }
.al-paso-ico[data-on="true"]{ background:var(--color-success); border-color:var(--color-success); color:var(--color-bg); }
.al-paso-t{ font-size:14.5px; font-weight:600; }
.al-paso-t[data-on="true"]{ text-decoration:line-through; color:var(--color-text-muted); font-weight:500; }
.al-paso-a{ display:block; font-size:13px; color:var(--color-text-muted); margin-top:2px; line-height:1.5; }

.al-card-top{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start; }
.al-card-top > div{ min-width:0; }
.al-nueva{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.al-folio{ font-size:13px; color:var(--color-text-muted); }
.al-card-t{ margin:8px 0 0; font-size:18px; font-weight:700; line-height:1.3; overflow-wrap:anywhere; }
.al-importe{ text-align:right; }
.al-importe b{ display:block; font-family:var(--font-display); font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; }
.al-detalle{ margin-top:14px; padding:12px 14px; border-radius:8px; background:var(--color-bg); border:1px solid var(--color-border); font-size:14px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.al-acciones{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
.al-acciones > .ms-btn{ flex:1 1 150px; }
.al-acciones > .ms-btn-sec.al-cancelar{ flex:0 1 auto; }
.al-form{ display:grid; gap:14px; margin-top:16px; }

.al-dato-l{ font-size:13px; color:var(--color-text-muted); }
.al-dato-v{ font-size:14.5px; margin-top:3px; overflow-wrap:anywhere; }
.al-dato-v a{ color:var(--color-primary); font-weight:600; }

.al-exige{ margin-top:12px; font-size:13px; color:var(--color-warning); display:flex; gap:6px; align-items:flex-start; }
.al-exige svg{ flex-shrink:0; margin-top:2px; }
.al-avance{ margin-top:16px; display:grid; gap:6px; }

.al-equipo{ grid-template-columns:minmax(0,1fr) auto; }
.al-equipo-t{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.al-equipo-t b{ font-size:15px; overflow-wrap:anywhere; }
.al-equipo-m{ font-size:13px; margin-top:6px; display:flex; gap:4px 14px; flex-wrap:wrap; color:var(--color-text-muted); }
.al-equipo-m span{ display:inline-flex; align-items:center; gap:5px; }
.al-equipo-m .al-viejo{ color:var(--color-warning); }
.al-equipo-acts{ display:flex; gap:8px; flex-wrap:wrap; }

.al-lista{ padding:0; overflow:hidden; }
.al-lista-h{ padding:16px 20px 12px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.al-lista-i{ display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:13px 20px; border-top:1px solid var(--color-border); }
.al-lista-i > div, .al-lista-i > span{ min-width:0; }
.al-lista-i img{ width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid var(--color-border); flex-shrink:0; }
.al-lista-t{ font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.al-lista-s{ display:block; font-size:13px; color:var(--color-text-muted); overflow-wrap:anywhere; }
.al-lista-pie{ padding:16px 20px; border-top:1px solid var(--color-border); }
.al-revision{ border-color:color-mix(in srgb, var(--color-warning) 40%, var(--color-border)); }

.al-cifras{ display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; margin-top:18px; }
.al-cifra{ padding:12px 14px; border-radius:8px; background:var(--color-bg); border:1px solid var(--color-border); }
.al-cifra .ms-stat-n{ font-size:24px; }
.al-cifra .ms-stat-l{ margin:0 0 2px; }

.al-contacto .ms-btn{ white-space:normal; overflow-wrap:anywhere; text-align:center; min-width:0; }
.al-vacio{ padding:28px 24px 30px; }

@media (max-width: 980px){
  .al-cols{ grid-template-columns:minmax(0,1fr); gap:0; }
}
@media (max-width: 720px){
  .al-dos{ grid-template-columns:minmax(0,1fr); }
  .al-pide dl{ grid-template-columns:minmax(0,1fr); }
}
@media (max-width: 640px){
  .al-root .ms-input, .al-root .ms-textarea, .al-root .ms-select{ font-size:16px; }
  .al-head{ align-items:flex-start; }
  .al-avatar{ width:48px; height:48px; font-size:17px; }
  .al-kpis{ padding:16px 18px; }
  .al-stats{ grid-template-columns:repeat(2, minmax(0,1fr)); }
  .al-sec{ margin-bottom:32px; }
  .al-equipo{ grid-template-columns:minmax(0,1fr); }
  .al-equipo-acts > .ms-btn{ flex:1 1 140px; }
  .al-lista-h, .al-lista-i, .al-lista-pie{ padding-left:16px; padding-right:16px; }
  .al-importe{ text-align:left; }
}
`;

/**
 * El siguiente paso que el aliado reporta, según dónde va el servicio
 * (2026-09-25). Un botón a la vez: en obra no hay tiempo para menús.
 */
const SIGUIENTE: Record<string, { estado: string; texto: string; ayuda: string } | undefined> = {
  asignado: { estado: 'en_traslado', texto: 'Ya salió la unidad', ayuda: 'Al tocarlo, el cliente recibe "tu unidad va en camino".' },
  en_traslado: { estado: 'en_sitio', texto: 'Ya llegué a la obra', ayuda: 'Queda registrada la hora real de llegada.' },
  en_sitio: { estado: 'en_curso', texto: 'Empecé el trabajo', ayuda: 'Desde aquí corre el servicio o la renta.' },
  en_curso: { estado: 'terminado', texto: 'Terminé el trabajo', ayuda: 'MAQSER24 registra horas o viajes y cierra el servicio.' },
};

/** Icono de cada paso de avance (solo presentación). */
const ICONO_AVANCE: Record<string, IconName> = {
  en_traslado: 'truck',
  en_sitio: 'mapPin',
  en_curso: 'clock',
  terminado: 'check',
};

/** Tono del chip: verde ok, ámbar advierte, rojo vencido, azul dato; '' neutro. */
type Tono = 'ok' | 'warn' | 'bad' | 'info' | '';

const VERDE = 'var(--color-success)';
const AMBAR = 'var(--color-warning)';
const ROJO = 'var(--color-error)';
const AZUL = 'var(--color-primary)';

const dinero = (n: number | null | undefined) =>
  n ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : null;

function hace(iso: string | null | undefined): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

/** Mañana a las 8:00, en el formato de un input datetime-local. */
function mananaOcho(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`;
}

const ESTADO_EQUIPO: Record<string, { label: string; tono: Tono }> = {
  disponible: { label: 'Disponible', tono: 'ok' },
  limitada: { label: 'Disponible', tono: 'ok' },
  'por-confirmar': { label: 'Por confirmar', tono: 'warn' },
  reservado: { label: 'Reservado', tono: 'info' },
  'en-traslado': { label: 'En traslado', tono: 'info' },
  'en-servicio': { label: 'En servicio', tono: 'info' },
  mantenimiento: { label: 'Mantenimiento', tono: 'warn' },
  inactivo: { label: 'Inactivo', tono: 'bad' },
  agotado: { label: 'Sin unidades', tono: 'bad' },
};

const ESTADO_DOCS: Record<string, { label: string; tono: Tono; color: string }> = {
  'al-dia': { label: 'Al día', tono: 'ok', color: VERDE },
  'por-vencer': { label: 'Por vencer', tono: 'warn', color: AMBAR },
  vencido: { label: 'Vencido', tono: 'bad', color: ROJO },
  'sin-documentos': { label: 'Sin papeles', tono: 'bad', color: ROJO },
};

// ───────────────────────── piezas ─────────────────────────

function Chip({ children, tono = '' }: { children: React.ReactNode; tono?: Tono }) {
  return <span className={`ms-chip ms-chip-dot${tono ? ` ms-chip-${tono}` : ''}`}>{children}</span>;
}

/** Encabezado de sección: título en tipo oración, descripción y acción opcional. */
function Titulo({ children, desc, extra, chip }: { children: React.ReactNode; desc?: React.ReactNode; extra?: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <div className="ms-sec-head">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="ms-h2">{children}</h2>
          {chip}
        </div>
        {desc ? <p className="ms-h2-desc">{desc}</p> : null}
      </div>
      {extra}
    </div>
  );
}

function Barra({ valor, color = AZUL }: { valor: number; color?: string }) {
  return (
    <div className="al-barra">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%`, background: color }} />
    </div>
  );
}

/**
 * Lo que pide el cliente, ordenado con las preguntas de su línea: lo que el
 * documento dice que cada proveedor necesita para decidir (fechas y equipo;
 * viajes, destino y frecuencia; cantidad, destino y ventana de entrega).
 */
function LoQuePide({ pedido }: { pedido?: Array<{ label: string; valor: string }> }) {
  if (!pedido?.length) return null;
  return (
    <div className="al-pide">
      <span className="al-dato-l">Lo que pide</span>
      <dl>
        {pedido.map((p) => (
          <div key={p.label}><dt>{p.label}</dt><dd>{p.valor}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="al-dato-l">{label}</div>
      <div className="al-dato-v">{valor || '—'}</div>
    </div>
  );
}

// ───────────────────────── portal ─────────────────────────

/**
 * No recibe token. La credencial del aliado vive en una cookie httpOnly que el
 * proxy adjunta; el JavaScript de esta pantalla nunca la ve.
 */
export function PortalAliado({ datos, contacto }: { datos: DatosPortal; contacto?: ContactoMaqser }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<number | string | null>(null);
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);
  const [editando, setEditando] = useState(false);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipoDoc, setTipoDoc] = useState(datos.documentos.tipos[0]?.clave ?? '');
  /** Tarjeta abierta para aceptar (pide llegada) o rechazar (pide motivo). */
  const [respondiendo, setRespondiendo] = useState<{ id: number; modo: 'aceptar' | 'rechazar' } | null>(null);
  const [llegada, setLlegada] = useState(mananaOcho());
  const [motivo, setMotivo] = useState('');
  /** Formulario guiado para ofrecer un equipo. */
  const [ofreciendo, setOfreciendo] = useState(false);

  const { aliado, porContestar, enCurso, equipos, documentos, cumplimiento } = datos;
  const recientes = datos.recientes ?? [];
  const propuestas = datos.propuestas ?? [];
  const lineasOferta = aliado.categories.map((slug, i) => ({ slug, label: aliado.categoryLabels?.[i] ?? slug }));
  const lineas = aliado.categoryLabels?.length ? aliado.categoryLabels : aliado.categories;
  // Lo que MAQSER24 le habilitó al darlo de alta: servicios, productos o ambos.
  const ofreceServicios = aliado.categories.some((c) => esLineaServicio(c));
  const ofreceProductos = aliado.categories.some((c) => !esLineaServicio(c));
  const queOfrece = ofreceServicios && ofreceProductos ? 'servicios y productos' : ofreceProductos ? 'productos' : 'servicios';
  const botonOfrecer = ofreceServicios && ofreceProductos ? 'Ofrecer servicio o producto' : ofreceProductos ? 'Ofrecer un producto' : 'Ofrecer un servicio';
  /*
   * QUÉ TIPO DE PROVEEDOR ES (documento, sección 14; 2026-10-08): rentadora,
   * de servicios o de materiales, según sus líneas. Cambia cómo se le habla
   * ("tus equipos", "tus unidades", "tus materiales") y le recuerda qué le
   * ofrece MAQSER24 a alguien como él.
   */
  const tipos = tiposDeAliado(aliado.categories);
  const oferta = ofertaDe(tipos);
  const ofertaCorta = tipos.length === 1 ? oferta.charAt(0).toUpperCase() + oferta.slice(1) : 'Tu oferta';
  const API = '/api/proxy';

  const avisar = (texto: string, ok = true) => setMsg({ texto, ok });

  async function llamar(url: string, body?: unknown) {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      avisar(j?.message ?? 'No se pudo guardar. Intenta otra vez.', false);
      return false;
    }
    return true;
  }

  async function contestar(assignmentId: number, estado: 'aceptado' | 'rechazado') {
    if (estado === 'rechazado' && !motivo.trim()) {
      avisar('Cuéntanos por qué no puedes: nos sirve para no volver a ofrecerte lo mismo.', false);
      return;
    }
    setOcupado(assignmentId); setMsg(null);
    const ok = await llamar(`${API}/aliado/solicitudes/${assignmentId}`, {
      estado,
      ...(estado === 'rechazado' ? { motivo: motivo.trim() } : {}),
      ...(estado === 'aceptado' && llegada ? { llegada: new Date(llegada).toISOString() } : {}),
    });
    setOcupado(null);
    if (ok) {
      setRespondiendo(null); setMotivo(''); setLlegada(mananaOcho());
      avisar(estado === 'aceptado' ? 'Listo, quedó tuyo. Te mandamos los datos de la obra por correo.' : 'Gracias por avisarnos.');
      router.refresh();
    }
  }

  async function confirmar(productId: number) {
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/confirmar`);
    setOcupado(null);
    if (ok) { avisar('Confirmado. Gracias.'); router.refresh(); }
  }

  /** "Ya salió", "Llegué"…: le avisa al cliente (campana y correo) y al panel. */
  async function reportarAvance(quoteNumber: string, estado: string) {
    const paso = Object.values(SIGUIENTE).find((x) => x?.estado === estado);
    if (paso && !(await confirmarDialogo({ titulo: `¿${paso.texto}?`, mensaje: paso.ayuda, confirmar: `Sí, ${paso.texto.charAt(0).toLowerCase()}${paso.texto.slice(1)}` }))) return;
    setOcupado(quoteNumber); setMsg(null);
    const ok = await llamar(`${API}/aliado/servicios/${encodeURIComponent(quoteNumber)}/avance`, { estado });
    setOcupado(null);
    if (ok) { avisar('Listo: el cliente y MAQSER24 ya lo saben.'); router.refresh(); }
  }

  async function moverEquipo(productId: number, actual: string | null) {
    const donde = await pedirTexto({
      titulo: '¿Dónde está ahora este equipo?',
      mensaje: 'Municipio, obra o patio. Así MAQSER24 sabe a qué obras le queda cerca.',
      valor: actual ?? '',
      placeholder: 'Ej. Patio en Apodaca',
      confirmar: 'Guardar ubicación',
    });
    if (donde === null) return;
    setOcupado(productId); setMsg(null);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/ubicacion`, { location: donde });
    setOcupado(null);
    if (ok) { avisar('Ubicación actualizada.'); router.refresh(); }
  }

  async function guardarDatos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGuardando(true); setMsg(null);
    const ok = await llamar(`${API}/aliado/perfil`, {
      contactName: String(fd.get('contactName') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      email: String(fd.get('email') ?? ''),
      city: String(fd.get('city') ?? ''),
      address: String(fd.get('address') ?? ''),
      coverage: String(fd.get('coverage') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    setGuardando(false);
    if (ok) { avisar('Listo, tus datos quedaron actualizados.'); setEditando(false); router.refresh(); }
  }

  /** Va por FormData por la foto; el Content-Type NO se fija a mano (boundary). */
  async function subirDocumento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('kind', tipoDoc);
    setGuardando(true); setMsg(null);
    const r = await fetch(`${API}/aliado/documentos`, { method: 'POST', body: fd });
    setGuardando(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      avisar(j?.message ?? 'No se pudo subir. Intenta otra vez.', false);
      return;
    }
    const d = await r.json();
    avisar(d?.estadoDocumentos === 'al-dia' ? 'Recibido. Tu expediente quedó al día.' : 'Recibido. Todavía tienes papeles por renovar.');
    setSubiendoDoc(false);
    form.reset();
    router.refresh();
  }

  // ── Para recibir trabajo: qué le falta, en orden ──
  const equiposConfirmados = equipos.filter((e) => e.diasSinConfirmar !== null && e.diasSinConfirmar <= 14).length;
  const pasos: Array<{ hecho: boolean; texto: string; ayuda: string }> = [
    { hecho: Boolean(aliado.phone && aliado.email && aliado.coverage.length), texto: 'Tus datos y tu cobertura', ayuda: 'Teléfono, correo y los municipios a los que llegas.' },
    { hecho: documentos.lista.length > 0, texto: 'Entregar tus papeles', ayuda: 'Póliza de seguro, constancia fiscal y DC-3 de tus operadores.' },
    { hecho: aliado.verified, texto: 'Sello de verificado', ayuda: 'Lo da MAQSER24 al revisar tus papeles vigentes.' },
    { hecho: equipos.length > 0, texto: `Ofrecer tus ${queOfrece}`, ayuda: propuestas.length ? 'Ya enviaste lo que ofreces: MAQSER24 lo está revisando para publicarlo.' : `Toca "${botonOfrecer}" y responde las preguntas: MAQSER24 lo revisa y lo publica.` },
    { hecho: equipos.length > 0 && equiposConfirmados === equipos.length, texto: 'Disponibilidad confirmada', ayuda: `Toca "Sigue libre" en cada uno de tus ${oferta} al menos cada 14 días.` },
  ];
  const listos = pasos.filter((p) => p.hecho).length;
  const docs = ESTADO_DOCS[documentos.estado] ?? { label: documentos.estado, tono: 'warn' as Tono, color: AMBAR };
  const iniciales = aliado.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const meses = aliado.monthsInNetwork === null
    ? null
    : aliado.monthsInNetwork === 0
      ? 'Nuevo en la red'
      : `${aliado.monthsInNetwork} ${aliado.monthsInNetwork === 1 ? 'mes' : 'meses'} en la red`;

  const kpis: Array<{ n: number | string; label: string; color: string; icono: IconName; ancla: string }> = [
    { n: porContestar.length, label: 'Por contestar', color: porContestar.length ? AZUL : 'var(--color-text-muted)', icono: 'bell', ancla: '#solicitudes' },
    { n: enCurso.length, label: 'En curso', color: enCurso.length ? VERDE : 'var(--color-text-muted)', icono: 'truck', ancla: '#en-curso' },
    { n: equipos.length, label: ofertaCorta, color: 'var(--color-text)', icono: 'box', ancla: '#equipos' },
    { n: docs.label, label: 'Papeles', color: docs.color, icono: 'shield', ancla: '#papeles' },
  ];

  return (
    <div className="ms-wrap al-root">
      {/* Escritorio: dos columnas, lo accionable a la izquierda (solicitudes,
          lo que trae, equipos) y la consulta a la derecha (papeles, cómo va,
          sus datos). En tableta y teléfono, una sola columna en ese orden. */}
      <style>{CSS}</style>

      {/* ── Encabezado ── */}
      <header className="al-head">
        <span className="al-avatar" aria-hidden>{iniciales || 'A'}</span>
        <div className="al-head-txt">
          <p className="ms-kicker">Panel de aliado</p>
          <h1 className="ms-title">{aliado.name}</h1>
          <div className="al-chips">
            {aliado.verified ? <Chip tono="ok">Verificado</Chip> : <Chip>Sin sello</Chip>}
            <Chip>Nivel {aliado.level}</Chip>
            {tipos.map((t) => <Chip key={t} tono="info">{TIPOS_ALIADO[t].nombre}</Chip>)}
          </div>
          <div className="ms-desc al-meta">
            <span><Icon name="mapPin" size={14} />{aliado.coverage.length ? aliado.coverage.join(', ') : 'Sin zonas registradas'}</span>
            {lineas.length ? <span><Icon name="grid" size={14} />{lineas.join(' · ')}</span> : null}
            {meses ? <span><Icon name="clock" size={14} />{meses}</span> : null}
          </div>
          {/* Lo que MAQSER24 le ofrece a alguien como él, con las palabras del documento. */}
          {tipos.length > 0 ? (
            <ul className="al-ofrece">
              {tipos.map((t) => (
                <li key={t}><b>Como {TIPOS_ALIADO[t].nombre.toLowerCase()}:</b> {TIPOS_ALIADO[t].ofrece}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {msg ? (
        <div role="status" className={`ms-alert al-msg ${msg.ok ? 'ms-alert-ok' : 'ms-alert-bad'}`} data-ok={msg.ok}>
          <span className="al-msg-ico"><Icon name={msg.ok ? 'check' : 'warning'} size={16} /></span>
          <span>{msg.texto}</span>
        </div>
      ) : null}

      {/* ── Resumen ── */}
      <nav className="ms-panel al-kpis" aria-label="Resumen">
        <div className="ms-stats al-stats">
          {kpis.map((k) => (
            <a key={k.label} href={k.ancla} className="al-kpi">
              <span className="ms-stat-l"><Icon name={k.icono} size={14} />{k.label}</span>
              <span className={`ms-stat-n${typeof k.n === 'number' ? '' : ' al-stat-txt'}`} style={{ color: k.color }}>{k.n}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="al-cols">
      <div className="al-main">

      {/* ── Para recibir trabajo ── */}
      {listos < pasos.length ? (
        <section className="ms-panel al-sec">
          <div className="al-card-top" style={{ alignItems: 'center', marginBottom: 12 }}>
            <h2 className="ms-h3">Para empezar a recibir trabajo</h2>
            <span className="ms-small ms-muted ms-num">{listos} de {pasos.length}</span>
          </div>
          <Barra valor={listos / pasos.length} color={VERDE} />
          <ol className="al-pasos">
            {pasos.map((p) => (
              <li key={p.texto}>
                <span className="al-paso-ico" data-on={p.hecho} aria-hidden>
                  {p.hecho ? <Icon name="check" size={13} /> : null}
                </span>
                <span>
                  <span className="al-paso-t" data-on={p.hecho}>{p.texto}</span>
                  {!p.hecho ? <span className="al-paso-a">{p.ayuda}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ── Solicitudes por contestar ── */}
      <section id="solicitudes" className="al-sec">
        <Titulo>
          {porContestar.length > 0
            ? `${porContestar.length} solicitud${porContestar.length === 1 ? '' : 'es'} esperando tu respuesta`
            : 'Solicitudes de trabajo'}
        </Titulo>

        {porContestar.length === 0 ? (
          <div className="ms-empty al-vacio">
            <span className="ms-ico" aria-hidden><Icon name="bell" size={19} /></span>
            <p className="ms-h3" style={{ marginTop: 10 }}>Nada pendiente por ahora</p>
            <p className="ms-empty-p">Cuando un cliente pida algo de tus {oferta}, aparece aquí y te avisamos por correo al instante.</p>
          </div>
        ) : null}

        <div className="al-stack">
          {porContestar.map((s) => {
            const abierta = respondiendo?.id === s.assignmentId ? respondiendo.modo : null;
            return (
              <article key={s.assignmentId} className="ms-panel al-nueva">
                <div className="al-card-top">
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip tono="info">Nueva</Chip>
                      <span className="al-folio">{hace(s.offeredAt)} · Folio {s.quoteNumber}</span>
                    </div>
                    <h3 className="al-card-t">{s.category ?? 'Servicio'}</h3>
                  </div>
                  {dinero(s.total) ? (
                    <div className="al-importe">
                      <span className="al-dato-l">Importe</span>
                      <b>{dinero(s.total)}</b>
                    </div>
                  ) : null}
                </div>

                <div className="al-dos" style={{ marginTop: 16 }}>
                  <Dato label="Obra" valor={s.site} />
                  <Dato label="Dirección" valor={s.address ?? 'Por confirmar'} />
                </div>

                <LoQuePide pedido={s.pedido} />

                {s.detail ? <div className="al-detalle">{s.detail}</div> : null}

                {s.requirements.length > 0 ? (
                  <div className="ms-alert ms-alert-warn" style={{ marginTop: 12, fontSize: 13.5 }}>
                    <span style={{ color: AMBAR, display: 'flex', marginTop: 2 }}><Icon name="warning" size={15} /></span>
                    <span><strong>Esta obra exige:</strong> {s.requirements.join(' · ')}</span>
                  </div>
                ) : null}

                {abierta === 'aceptar' ? (
                  <div className="al-form">
                    <label className="ms-field">
                      <span className="ms-label">¿Cuándo llegas a la obra?</span>
                      <input type="datetime-local" value={llegada} onChange={(e) => setLlegada(e.target.value)} className="ms-input" />
                      <span className="ms-hint">Es tu compromiso con el cliente y contra él medimos tu puntualidad.</span>
                    </label>
                    <div className="al-acciones" style={{ marginTop: 0 }}>
                      <button type="button" className="ms-btn" disabled={ocupado === s.assignmentId} onClick={() => contestar(s.assignmentId, 'aceptado')}>
                        <Icon name="check" size={16} />Confirmar que lo tomo
                      </button>
                      <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setRespondiendo(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : abierta === 'rechazar' ? (
                  <div className="al-form">
                    <label className="ms-field">
                      <span className="ms-label">¿Por qué no puedes tomarlo?</span>
                      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="La máquina está en otra obra, no llego a esa zona…" className="ms-textarea" style={{ minHeight: 80 }} />
                    </label>
                    <div className="al-acciones" style={{ marginTop: 0 }}>
                      <button type="button" className="ms-btn" disabled={ocupado === s.assignmentId} onClick={() => contestar(s.assignmentId, 'rechazado')}>
                        Enviar respuesta
                      </button>
                      <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setRespondiendo(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="al-acciones">
                    <button type="button" className="ms-btn" onClick={() => { setRespondiendo({ id: s.assignmentId, modo: 'aceptar' }); setMsg(null); }}>
                      <Icon name="check" size={16} />Sí puedo
                    </button>
                    <button type="button" className="ms-btn ms-btn-sec" onClick={() => { setRespondiendo({ id: s.assignmentId, modo: 'rechazar' }); setMotivo(''); setMsg(null); }}>
                      <Icon name="x" size={16} />No puedo
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── En curso ── */}
      {enCurso.length > 0 ? (
        <section id="en-curso" className="al-sec">
          <Titulo desc="Reporta cada avance: el cliente y MAQSER24 se enteran al instante.">Lo que traes ahora</Titulo>
          <div className="al-stack">
            {enCurso.map((s) => {
              const sig = SIGUIENTE[s.state ?? 'asignado'];
              return (
                <article key={s.quoteNumber} className="ms-panel">
                  <div className="al-card-top" style={{ alignItems: 'center' }}>
                    <div>
                      <h3 className="al-card-t" style={{ margin: 0, fontSize: 16 }}>{s.site ?? s.category ?? 'Servicio'}</h3>
                      <div className="al-folio" style={{ marginTop: 2 }}>
                        {s.category ?? ''}{s.category ? ' · ' : ''}Folio {s.quoteNumber}{dinero(s.total) ? ` · ${dinero(s.total)}` : ''}
                      </div>
                    </div>
                    <Chip tono="info">{s.stateLabel ?? 'Asignado'}</Chip>
                  </div>
                  <div style={{ marginTop: 14 }}><Barra valor={s.progress ?? 0} /></div>
                  <div className="al-dos" style={{ marginTop: 16 }}>
                    <Dato label="Llegada comprometida" valor={fechaHora(s.committedAt)} />
                    <Dato label="Dirección" valor={s.address} />
                    <Dato label="Quién te recibe" valor={s.contactName} />
                    <Dato
                      label="Teléfono en obra"
                      valor={s.contactPhone ? <a href={`tel:${s.contactPhone}`}>{s.contactPhone}</a> : null}
                    />
                  </div>
                  <LoQuePide pedido={s.pedido} />
                  {s.requirements.length > 0 ? (
                    <div className="al-exige">
                      <Icon name="warning" size={14} /><span>Exige: {s.requirements.join(' · ')}</span>
                    </div>
                  ) : null}
                  {/* Reporta el avance: el cliente y MAQSER24 se enteran al instante. */}
                  {sig ? (
                    <div className="al-avance">
                      <button
                        type="button"
                        className="ms-btn ms-btn-block"
                        disabled={ocupado === s.quoteNumber}
                        onClick={() => void reportarAvance(s.quoteNumber, sig.estado)}
                      >
                        <Icon name={ICONO_AVANCE[sig.estado] ?? 'arrowRight'} size={16} />{sig.texto}
                      </button>
                      <span className="ms-hint">{sig.ayuda}</span>
                    </div>
                  ) : s.state === 'terminado' ? (
                    <p className="ms-hint" style={{ marginTop: 14, fontSize: 13 }}>Reportaste que terminaste. MAQSER24 registra horas o viajes y cierra el servicio.</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Equipos ── */}
      <section id="equipos" className="al-sec">
        <Titulo
          desc={equipos.length > 0 ? 'Si confirmas seguido, te llegan más solicitudes: solo proponemos lo que sabemos que está libre.' : undefined}
          extra={!ofreciendo && lineasOferta.length > 0 ? (
            <button type="button" className="ms-btn ms-btn-sm" onClick={() => { setOfreciendo(true); setMsg(null); }}>
              <Icon name="box" size={15} />{botonOfrecer}
            </button>
          ) : null}
        >
          {ofreceProductos && !ofreceServicios ? 'Tus productos' : ofreceProductos ? 'Tus servicios y productos' : `Tus ${oferta}`}
        </Titulo>

        {ofreciendo ? (
          <div style={{ marginBottom: 14 }}>
            <OfrecerEquipo
              lineas={lineasOferta}
              onCerrar={() => setOfreciendo(false)}
              onEnviado={(nombre) => {
                setOfreciendo(false);
                avisar(`Recibimos "${nombre}". MAQSER24 lo revisa y te avisamos por correo cuando esté publicado.`);
                router.refresh();
              }}
            />
          </div>
        ) : null}

        {propuestas.length > 0 ? (
          <div className="ms-panel al-lista al-revision" style={{ marginBottom: 12 }}>
            <div className="al-lista-h">
              <h3 className="ms-h3">En revisión por MAQSER24</h3>
            </div>
            {propuestas.map((e) => (
              <div key={e.id} className="al-lista-i" style={{ flexWrap: 'nowrap' }}>
                {e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" />
                ) : null}
                <div style={{ flex: 1 }}>
                  <div className="al-lista-t">{e.name}</div>
                  <span className="al-lista-s">{e.brand ? `${e.brand} · ` : ''}enviado {hace(e.createdAt)}</span>
                </div>
                <Chip tono="warn">Por revisar</Chip>
              </div>
            ))}
          </div>
        ) : null}
        {equipos.length === 0 ? (
          <div className="ms-empty al-vacio">
            <span className="ms-ico" aria-hidden><Icon name="box" size={19} /></span>
            <p className="ms-h3" style={{ marginTop: 10 }}>Todavía no tienes {queOfrece} publicados</p>
            <p className="ms-empty-p">
              Toca <strong style={{ color: 'var(--color-text)' }}>&quot;{botonOfrecer}&quot;</strong>, responde las preguntas y sube fotos:
              MAQSER24 lo revisa y, al publicarlo, aparece aquí para que confirmes si sigue libre.
            </p>
          </div>
        ) : (
          <div className="ms-rows">
            {equipos.map((e) => {
              const viejo = e.diasSinConfirmar === null || e.diasSinConfirmar > 14;
              const est = ESTADO_EQUIPO[e.state] ?? { label: e.state, tono: 'warn' as Tono };
              return (
                <div key={e.id} className="ms-row al-equipo">
                  <div style={{ minWidth: 0 }}>
                    <div className="al-equipo-t">
                      <b>{e.name}</b>
                      <Chip tono={est.tono}>{est.label}</Chip>
                    </div>
                    <div className="al-equipo-m">
                      <span className={viejo ? 'al-viejo' : undefined}><Icon name={viejo ? 'warning' : 'clock'} size={13} />{e.confirmacion}</span>
                      <span><Icon name="mapPin" size={13} />{e.location || 'Sin ubicación'}</span>
                    </div>
                  </div>
                  <div className="al-equipo-acts">
                    <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" onClick={() => moverEquipo(e.id, e.location)} disabled={ocupado === e.id}>
                      <Icon name="mapPin" size={14} />Dónde está
                    </button>
                    <button type="button" className="ms-btn ms-btn-sm" onClick={() => confirmar(e.id)} disabled={ocupado === e.id}>
                      <Icon name="check" size={14} />Sigue libre
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Cómo vas + historial ── */}
      <section className="al-sec">
        <Titulo>Cómo vas con nosotros</Titulo>
        <div className="ms-panel">
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{cumplimiento.resumen}</p>
          <div className="al-cifras">
            {([
              ['Te ofrecimos', cumplimiento.ofrecidos, 'var(--color-text)'],
              ['Aceptaste', cumplimiento.aceptados, AZUL],
              ['Completaste', cumplimiento.completados, VERDE],
              ['Cancelaste', cumplimiento.cancelados, cumplimiento.cancelados ? ROJO : 'var(--color-text)'],
            ] as const).map(([t, n, c]) => (
              <div key={t} className="al-cifra">
                <span className="ms-stat-l">{t}</span>
                <span className="ms-stat-n" style={{ color: c }}>{n}</span>
              </div>
            ))}
          </div>
          <p className="ms-hint" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
            {cumplimiento.minutosRespuestaReal !== null
              ? `Contestas en ~${cumplimiento.minutosRespuestaReal} min${cumplimiento.minutosRespuestaDeclarado !== null ? ` (tenemos anotado ${cumplimiento.minutosRespuestaDeclarado})` : ''}. `
              : ''}
            Entre más rápido contestes y más puntual llegues, más arriba apareces cuando buscamos a quién ofrecerle.
          </p>
        </div>

        {recientes.length > 0 ? (
          <div className="ms-panel al-lista" style={{ marginTop: 12 }}>
            <div className="al-lista-h"><h3 className="ms-h3">Tus últimos trabajos</h3></div>
            {recientes.map((r) => {
              const acepto = r.answer === 'aceptado';
              return (
                <div key={`${r.quoteNumber}-${r.respondedAt}`} className="al-lista-i">
                  <div>
                    <div className="al-lista-t">{r.site ?? r.category ?? 'Servicio'}</div>
                    <span className="al-lista-s">
                      Folio {r.quoteNumber}{r.respondedAt ? ` · ${hace(r.respondedAt)}` : ''}{!acepto && r.reason ? ` · “${r.reason}”` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {acepto && dinero(r.total) ? <span className="ms-num" style={{ fontSize: 13.5, fontWeight: 700 }}>{dinero(r.total)}</span> : null}
                    <Chip tono={acepto ? (r.stateLabel === 'Cerrado' ? 'ok' : 'info') : ''}>
                      {acepto ? r.stateLabel : r.answer === 'retirado' ? 'Te retiraste' : 'No lo tomaste'}
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      </div>

      <aside className="al-side">

      {/* ── Papeles ── */}
      <section id="papeles" className="al-sec">
        <Titulo
          chip={<Chip tono={docs.tono}>{docs.label}</Chip>}
          desc="Con tus papeles vigentes obtienes el sello de verificado y sales primero en las propuestas. Si uno vence, pierdes el sello; sube el renovado aquí y vuelve solo."
        >
          Tus papeles
        </Titulo>

        {documentos.avisos.length > 0 ? (
          <div className={`ms-alert ${documentos.avisos.some((d) => d.urgencia === 'vencido') ? 'ms-alert-bad' : 'ms-alert-warn'}`} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {documentos.avisos.map((d) => (
              <div key={d.documentId} style={{ fontSize: 13.5, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip tono={d.urgencia === 'vencido' ? 'bad' : 'warn'}>{d.texto}</Chip>
                <span>{d.name || d.kind}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="ms-panel al-lista">
          {documentos.lista.length === 0 ? (
            <p className="ms-muted" style={{ margin: 0, padding: '18px 20px', fontSize: 14, lineHeight: 1.6 }}>
              Todavía no tienes papeles entregados. Empieza por la <strong style={{ color: 'var(--color-text)' }}>póliza de seguro</strong> y la{' '}
              <strong style={{ color: 'var(--color-text)' }}>constancia de situación fiscal</strong>.
            </p>
          ) : (
            documentos.lista.map((d, i) => {
              const vencido = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) < new Date() : false;
              return (
                <div key={d.id} className="al-lista-i" style={i ? undefined : { borderTop: 'none' }}>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: vencido ? ROJO : VERDE, display: 'flex', flexShrink: 0 }}><Icon name={vencido ? 'warning' : 'check'} size={15} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="al-lista-t">{d.kindLabel}</span>
                      {d.name && d.name !== d.kindLabel ? <span className="al-lista-s">{d.name}</span> : null}
                    </span>
                  </span>
                  <span className="ms-num" style={{ fontSize: 13, color: vencido ? ROJO : 'var(--color-text-muted)' }}>
                    {d.expiresAt ? `${vencido ? 'Venció' : 'Vence'} ${d.expiresAt}` : 'Sin vencimiento'}
                  </span>
                </div>
              );
            })
          )}

          <div className="al-lista-pie">
            {!subiendoDoc ? (
              <button type="button" className="ms-btn ms-btn-sec ms-btn-block" onClick={() => setSubiendoDoc(true)}>
                <Icon name="shield" size={15} />Subir o renovar un papel
              </button>
            ) : (
              <form onSubmit={subirDocumento} style={{ display: 'grid', gap: 14 }}>
                <label className="ms-field">
                  <span className="ms-label">¿Qué papel es?</span>
                  <ShSelect value={tipoDoc} onValueChange={setTipoDoc}>
                    <ShSelectTrigger aria-label="Tipo de papel"><ShSelectValue /></ShSelectTrigger>
                    <ShSelectContent>
                      {documentos.tipos.map((t) => <ShSelectItem key={t.clave} value={t.clave}>{t.label}</ShSelectItem>)}
                    </ShSelectContent>
                  </ShSelect>
                </label>
                <label className="ms-field">
                  <span className="ms-label">¿Hasta cuándo vale?</span>
                  <input type="date" name="expiresAt" className="ms-input" />
                  <span className="ms-hint">Si no vence, déjalo vacío.</span>
                </label>
                <label className="ms-field">
                  <span className="ms-label">Foto del documento</span>
                  {/* Foto y no archivo: en obra se le toma foto a la póliza. */}
                  <input type="file" name="file" accept="image/*" className="ms-input" style={{ padding: '10px 13px' }} />
                </label>
                <div className="al-acciones" style={{ marginTop: 0 }}>
                  <button type="submit" className="ms-btn" disabled={guardando}>
                    {guardando ? 'Subiendo…' : 'Subir'}
                  </button>
                  <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setSubiendoDoc(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Datos + contacto ── */}
      <div className="al-dos" style={{ alignItems: 'start', gap: 0 }}>
        <section className="al-sec">
          <Titulo>Tus datos</Titulo>
          <div className="ms-panel">
            {!editando ? (
              <>
                <div style={{ display: 'grid', gap: 14 }}>
                  <Dato label="Contacto" valor={aliado.contactName} />
                  <Dato label="Teléfono" valor={aliado.phone} />
                  <Dato label="Correo" valor={aliado.email} />
                  <Dato label="Ciudad" valor={aliado.city} />
                  <Dato label="Zonas que cubres" valor={aliado.coverage.join(', ')} />
                </div>
                <button type="button" className="ms-btn ms-btn-sec ms-btn-block" style={{ marginTop: 18 }} onClick={() => setEditando(true)}>
                  <Icon name="user" size={15} />Corregir mis datos
                </button>
              </>
            ) : (
              <form onSubmit={guardarDatos} style={{ display: 'grid', gap: 14 }}>
                {([
                  ['contactName', 'Nombre de quien contesta', aliado.contactName, 'text'],
                  ['phone', 'Teléfono', aliado.phone, 'tel'],
                  ['email', 'Correo', aliado.email, 'email'],
                  ['city', 'Ciudad', aliado.city, 'text'],
                  ['address', 'Dirección de tu base', aliado.address, 'text'],
                ] as const).map(([name, label, valor, tipo]) => (
                  <label key={name} className="ms-field">
                    <span className="ms-label">{label}</span>
                    <input name={name} type={tipo} defaultValue={valor ?? ''} className="ms-input" />
                  </label>
                ))}
                <label className="ms-field">
                  <span className="ms-label">Zonas que cubres</span>
                  <input name="coverage" defaultValue={aliado.coverage.join(', ')} placeholder="Apodaca, Escobedo, García" className="ms-input" />
                  <span className="ms-hint">Separadas por coma.</span>
                </label>
                <p className="ms-hint">
                  Para cambiar las líneas de servicio que atiendes, escríbenos: eso lo revisamos con tu expediente.
                </p>
                <div className="al-acciones" style={{ marginTop: 0 }}>
                  <button type="submit" className="ms-btn" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setEditando(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="al-sec">
          <Titulo>¿Dudas? Estamos para ayudarte</Titulo>
          <div className="ms-panel al-contacto" style={{ display: 'grid', gap: 12 }}>
            <p className="ms-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              Para cambiar tus líneas de servicio, corregir un equipo publicado o aclarar una solicitud, contacta a MAQSER24.
            </p>
            {contacto?.phone ? (
              <a href={telHref(contacto.phone)} className="ms-btn">
                <Icon name="phone" size={16} />{contacto.phone}
              </a>
            ) : null}
            {contacto?.email ? (
              <a href={`mailto:${contacto.email}`} className="ms-btn ms-btn-sec">
                <Icon name="mail" size={16} />{contacto.email}
              </a>
            ) : null}
            {contacto?.hours ? (
              <div className="ms-small ms-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={14} />{contacto.hours}</div>
            ) : null}
            <p className="ms-hint" style={{ fontSize: 12 }}>
              Este enlace es personal: no lo compartas. Quien lo tenga entra como tú.
            </p>
          </div>
        </section>
      </div>

      </aside>
      </div>
    </div>
  );
}
